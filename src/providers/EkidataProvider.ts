/**
 * 駅データ.jp プロバイダ。
 *
 * 駅データ.jp の CSV データを SQLite にインポートし、
 * TransitDataProvider インターフェースを通じて提供する。
 */
import * as SQLite from 'expo-sqlite';
import { Station, TransitDataSource } from '../types';
import { TransitDataProvider } from './TransitDataProvider';
import { Graph, EdgeInfo } from './types';
import { COMPANY_CSV, LINE_CSV, STATION_CSV, JOIN_CSV } from '../data/ekidata';

let db: SQLite.SQLiteDatabase | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('station_alarm.db');
  }
  return db;
}

/** CSV文字列を行配列にパース（ヘッダー除外） */
function parseCsvRows(csv: string): string[][] {
  return csv
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','));
}

/** ハーバーサイン公式で2点間の距離（km）を計算 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 路線名マップを返す（line_cd → line_name） */
async function getLineNameMap(database: SQLite.SQLiteDatabase): Promise<Map<number, string>> {
  const rows = await database.getAllAsync<{ line_cd: number; line_name: string }>(
    'SELECT line_cd, line_name FROM lines'
  );
  const map = new Map<number, string>();
  for (const row of rows) map.set(row.line_cd, row.line_name);
  return map;
}

/** DBの行を Station 型に変換 */
function rowToStation(
  row: { station_cd: number; station_name: string; line_cd: number; lat: number; lon: number },
  lineNameMap: Map<number, string>
): Station {
  return {
    id: String(row.station_cd),
    name: row.station_name,
    lineId: String(row.line_cd),
    lineName: lineNameMap.get(row.line_cd) ?? '',
    latitude: row.lat,
    longitude: row.lon,
    source: 'ekidata',
  };
}

async function importCsvData(database: SQLite.SQLiteDatabase): Promise<void> {
  // lines インポート
  for (const cols of parseCsvRows(LINE_CSV)) {
    if (cols.length < 3) continue;
    const line_cd = parseInt(cols[0], 10);
    const company_cd = parseInt(cols[1], 10);
    const line_name = cols[2];
    if (isNaN(line_cd)) continue;
    await database.runAsync(
      'INSERT OR IGNORE INTO lines (line_cd, line_name, company_cd) VALUES (?, ?, ?)',
      [line_cd, line_name, company_cd]
    );
  }

  // stations インポート
  for (const cols of parseCsvRows(STATION_CSV)) {
    if (cols.length < 14) continue;
    const station_cd = parseInt(cols[0], 10);
    const station_g_cd = parseInt(cols[1], 10);
    const station_name = cols[2];
    const line_cd = parseInt(cols[5], 10);
    const lon = parseFloat(cols[9]);
    const lat = parseFloat(cols[10]);
    const e_status = parseInt(cols[13], 10);
    if (isNaN(station_cd) || isNaN(lat) || isNaN(lon)) continue;
    await database.runAsync(
      'INSERT OR IGNORE INTO stations (station_cd, station_g_cd, station_name, line_cd, lat, lon, e_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [station_cd, station_g_cd, station_name, line_cd, lat, lon, e_status]
    );
  }

  // join_stations インポート
  for (const cols of parseCsvRows(JOIN_CSV)) {
    if (cols.length < 3) continue;
    const line_cd = parseInt(cols[0], 10);
    const cd1 = parseInt(cols[1], 10);
    const cd2 = parseInt(cols[2], 10);
    if (isNaN(line_cd) || isNaN(cd1) || isNaN(cd2)) continue;
    await database.runAsync(
      'INSERT OR IGNORE INTO join_stations (station_cd1, station_cd2, line_cd) VALUES (?, ?, ?)',
      [cd1, cd2, line_cd]
    );
  }
}

class EkidataProviderImpl implements TransitDataProvider {
  readonly source: TransitDataSource = 'ekidata';

  async initialize(): Promise<void> {
    const database = await getDatabase();

    await database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS lines (
        line_cd INTEGER PRIMARY KEY,
        line_name TEXT NOT NULL,
        company_cd INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stations (
        station_cd INTEGER PRIMARY KEY,
        station_g_cd INTEGER NOT NULL DEFAULT 0,
        station_name TEXT NOT NULL,
        line_cd INTEGER NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        e_status INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS join_stations (
        station_cd1 INTEGER NOT NULL,
        station_cd2 INTEGER NOT NULL,
        line_cd INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (station_cd1, station_cd2)
      );

      CREATE INDEX IF NOT EXISTS idx_stations_name ON stations(station_name);
    `);

    // マイグレーション: station_g_cd カラムが存在しない旧DBへの対応
    try {
      await database.execAsync(
        'ALTER TABLE stations ADD COLUMN station_g_cd INTEGER NOT NULL DEFAULT 0'
      );
    } catch {
      // 既にカラムが存在する場合は無視
    }

    // マイグレーション: join_stations.line_cd カラムが存在しない旧DBへの対応
    try {
      await database.execAsync(
        'ALTER TABLE join_stations ADD COLUMN line_cd INTEGER NOT NULL DEFAULT 0'
      );
    } catch {
      // 既にカラムが存在する場合は無視
    }

    // station_g_cd と join_stations.line_cd が正しくインポートされているか確認
    const stationRow = await database.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM stations WHERE station_g_cd > 0'
    );
    const joinRow = await database.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM join_stations WHERE line_cd > 0'
    );
    if (stationRow && stationRow.cnt >= 10000 && joinRow && joinRow.cnt > 0) return;

    // 全テーブルをクリアして再インポート
    await database.execAsync('DELETE FROM lines; DELETE FROM stations; DELETE FROM join_stations;');
    await importCsvData(database);
  }

  async searchStations(
    keyword: string,
    location?: { latitude: number; longitude: number } | null
  ): Promise<Station[]> {
    const database = await getDatabase();
    const lineNameMap = await getLineNameMap(database);
    const rows = await database.getAllAsync<{
      station_cd: number;
      station_g_cd: number;
      station_name: string;
      line_cds: string;
      lat: number;
      lon: number;
    }>(
      `SELECT MIN(station_cd) AS station_cd,
              station_g_cd,
              station_name,
              GROUP_CONCAT(DISTINCT line_cd) AS line_cds,
              AVG(lat) AS lat,
              AVG(lon) AS lon
       FROM stations
       WHERE station_name LIKE ? AND e_status = 0
       GROUP BY station_g_cd
       ORDER BY MIN(station_cd)
       LIMIT 20`,
      [`${keyword}%`]
    );

    const stations = rows.map((r) => {
      const lineCds = r.line_cds
        .split(',')
        .map(Number)
        .filter((n) => !isNaN(n));
      const lineNames = [...new Set(lineCds.map((cd) => lineNameMap.get(cd) ?? '').filter((n) => n))];
      return {
        id: String(r.station_cd),
        groupId: String(r.station_g_cd),
        name: r.station_name,
        lineId: String(lineCds[0] ?? 0),
        lineName: lineNames[0] ?? '',
        lineNames,
        latitude: r.lat,
        longitude: r.lon,
        source: 'ekidata' as const,
      };
    });

    if (location) {
      stations.sort((a, b) => {
        const distA = haversineDistance(location.latitude, location.longitude, a.latitude, a.longitude);
        const distB = haversineDistance(location.latitude, location.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }

    return stations;
  }

  async getStationById(id: string): Promise<Station | null> {
    const database = await getDatabase();
    const lineNameMap = await getLineNameMap(database);
    const stationCd = parseInt(id, 10);
    if (isNaN(stationCd)) return null;
    const row = await database.getFirstAsync<{
      station_cd: number;
      station_name: string;
      line_cd: number;
      lat: number;
      lon: number;
    }>(
      'SELECT station_cd, station_name, line_cd, lat, lon FROM stations WHERE station_cd = ?',
      [stationCd]
    );
    if (!row) return null;
    return rowToStation(row, lineNameMap);
  }

  async getStationByGroupId(groupId: string): Promise<Station | null> {
    const database = await getDatabase();
    const lineNameMap = await getLineNameMap(database);
    const gCd = parseInt(groupId, 10);
    if (isNaN(gCd)) return null;
    const rows = await database.getAllAsync<{
      station_cd: number;
      station_name: string;
      line_cd: number;
      lat: number;
      lon: number;
    }>(
      'SELECT station_cd, station_name, line_cd, lat, lon FROM stations WHERE station_g_cd = ? AND e_status = 0 ORDER BY station_cd',
      [gCd]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const lineNames = [...new Set(rows.map((r) => lineNameMap.get(r.line_cd) ?? '').filter((n) => n))];
    return {
      id: String(row.station_cd),
      groupId,
      name: row.station_name,
      lineId: String(row.line_cd),
      lineName: lineNameMap.get(row.line_cd) ?? '',
      lineNames,
      latitude: row.lat,
      longitude: row.lon,
      source: 'ekidata',
    };
  }

  async findNearestStation(
    latitude: number,
    longitude: number,
    radiusKm = 5
  ): Promise<Station | null> {
    const database = await getDatabase();

    // 簡易バウンディングボックスで候補を絞る（1度 ≒ 111km）
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

    const rows = await database.getAllAsync<{
      station_cd: number;
      station_name: string;
      line_cd: number;
      lat: number;
      lon: number;
    }>(
      `SELECT s.station_cd, s.station_name, s.line_cd, s.lat, s.lon
       FROM stations s
       WHERE s.e_status = 0
         AND s.lat BETWEEN ? AND ?
         AND s.lon BETWEEN ? AND ?`,
      [latitude - latDelta, latitude + latDelta, longitude - lonDelta, longitude + lonDelta]
    );

    if (rows.length === 0) return null;

    const lineNameMap = await getLineNameMap(database);

    let nearest: Station | null = null;
    let minDist = Infinity;

    for (const row of rows) {
      const dist = haversineDistance(latitude, longitude, row.lat, row.lon);
      if (dist < minDist) {
        minDist = dist;
        nearest = rowToStation(row, lineNameMap);
      }
    }

    return nearest;
  }

  async getGroupIdById(id: string): Promise<string | null> {
    const database = await getDatabase();
    const stationCd = parseInt(id, 10);
    if (isNaN(stationCd)) return null;
    const row = await database.getFirstAsync<{ station_g_cd: number }>(
      'SELECT station_g_cd FROM stations WHERE station_cd = ?',
      [stationCd]
    );
    return row ? String(row.station_g_cd) : null;
  }

  async getLineName(lineId: string): Promise<string> {
    const database = await getDatabase();
    const lineCd = parseInt(lineId, 10);
    if (isNaN(lineCd)) return '';
    const row = await database.getFirstAsync<{ line_name: string }>(
      'SELECT line_name FROM lines WHERE line_cd = ?',
      [lineCd]
    );
    return row?.line_name ?? '';
  }

  async buildGraph(): Promise<Graph> {
    const database = await getDatabase();

    // 全駅の station_cd/station_g_cd/line_cd マッピング
    const stationRows = await database.getAllAsync<{
      station_cd: number;
      station_g_cd: number;
      line_cd: number;
    }>('SELECT station_cd, station_g_cd, line_cd FROM stations');

    // station_cd -> {g_cd, line_cd} のマッピング
    const stationMap = new Map<number, { g_cd: number; line_cd: number }>();
    for (const row of stationRows) {
      stationMap.set(row.station_cd, { g_cd: row.station_g_cd, line_cd: row.line_cd });
    }

    // station_g_cd -> 利用可能路線のSet
    const stationLines = new Map<string, Set<string>>();
    for (const { g_cd, line_cd } of stationMap.values()) {
      const gKey = String(g_cd);
      if (!stationLines.has(gKey)) stationLines.set(gKey, new Set());
      stationLines.get(gKey)!.add(String(line_cd));
    }

    // 移動エッジを構築
    const edges = new Map<string, EdgeInfo[]>();
    const edgeSet = new Set<string>();
    const joinRows = await database.getAllAsync<{
      line_cd: number;
      station_cd1: number;
      station_cd2: number;
    }>('SELECT line_cd, station_cd1, station_cd2 FROM join_stations');

    for (const { line_cd, station_cd1, station_cd2 } of joinRows) {
      const s1 = stationMap.get(station_cd1);
      const s2 = stationMap.get(station_cd2);
      if (!s1 || !s2) continue;

      const g1 = String(s1.g_cd);
      const g2 = String(s2.g_cd);
      const lineKey = String(line_cd);
      if (g1 === g2) continue;

      // 双方向エッジを追加（重複チェック付き）
      const key1 = `${g1}:${g2}:${lineKey}`;
      if (!edgeSet.has(key1)) {
        edgeSet.add(key1);
        if (!edges.has(g1)) edges.set(g1, []);
        edges.get(g1)!.push({ to: g2, lineId: lineKey });
      }

      const key2 = `${g2}:${g1}:${lineKey}`;
      if (!edgeSet.has(key2)) {
        edgeSet.add(key2);
        if (!edges.has(g2)) edges.set(g2, []);
        edges.get(g2)!.push({ to: g1, lineId: lineKey });
      }
    }

    return { edges, stationLines };
  }
}

/** EkidataProvider のシングルトンインスタンス */
export const ekidataProvider = new EkidataProviderImpl();
