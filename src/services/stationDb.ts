/**
 * セッション永続化サービス（SQLite）。
 *
 * 駅データの初期化・クエリは TransitDataProvider に委譲し、
 * このファイルではセッションの CRUD のみを担う。
 *
 * 旧 API（initializeStationDb, searchStationsByName 等）は
 * 後方互換のためプロバイダへの委譲関数として残している。
 */
import * as SQLite from 'expo-sqlite';
import { Station, SoundType } from '../types';
import { getProvider } from '../providers';

let db: SQLite.SQLiteDatabase | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('station_alarm.db');
  }
  return db;
}

// ─── プロバイダ委譲（後方互換） ─────────────────────────────

/** データベースを初期化する（プロバイダの初期化 + セッションテーブル作成） */
export async function initializeStationDb(): Promise<void> {
  // プロバイダの初期化（駅データのインポート等）
  await getProvider().initialize();

  const database = await getDatabase();

  // ─── スキーママイグレーション ──────────────────────────────────
  // 旧スキーマ（origin_station_cd NOT NULL）が残っている場合、
  // INSERT 時に NOT NULL constraint failed が発生するため
  // テーブルを再作成して新スキーマに移行する。
  // SQLite は ALTER COLUMN / DROP CONSTRAINT を未サポートのため
  // RENAME → CREATE → INSERT SELECT → DROP の手順で対応する。
  const tableInfo = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(sessions)"
  );
  const hasOldColumn = tableInfo.some((col) => col.name === 'origin_station_cd');

  if (hasOldColumn) {
    await database.execAsync(`
      -- 旧テーブルをリネーム
      ALTER TABLE sessions RENAME TO sessions_old;

      -- 新スキーマでテーブルを作成
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        origin_station_id TEXT NOT NULL DEFAULT "",
        destination_station_id TEXT NOT NULL DEFAULT "",
        origin_station_json TEXT,
        destination_station_json TEXT,
        route TEXT NOT NULL,
        all_stations TEXT,
        detection_radius INTEGER NOT NULL DEFAULT 500,
        sound_type TEXT NOT NULL DEFAULT 'alarm',
        sound_uri TEXT,
        volume REAL NOT NULL DEFAULT 0.8,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      -- データを移行（station_cd を station_id として流用）
      INSERT INTO sessions
        (id, origin_station_id, destination_station_id,
         origin_station_json, destination_station_json,
         route, detection_radius, sound_type, sound_uri,
         volume, status, started_at, completed_at)
      SELECT
        id,
        COALESCE(origin_station_id, CAST(origin_station_cd AS TEXT), ""),
        COALESCE(destination_station_id, CAST(destination_station_cd AS TEXT), ""),
        origin_station_json,
        destination_station_json,
        route,
        detection_radius,
        sound_type,
        sound_uri,
        volume,
        status,
        started_at,
        completed_at
      FROM sessions_old;

      -- 旧テーブルを削除
      DROP TABLE sessions_old;

      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `);
  } else {
    // 新規インストール or すでに新スキーマ: テーブルを作成（存在しない場合のみ）
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        origin_station_id TEXT NOT NULL DEFAULT "",
        destination_station_id TEXT NOT NULL DEFAULT "",
        origin_station_json TEXT,
        destination_station_json TEXT,
        route TEXT NOT NULL,
        all_stations TEXT,
        detection_radius INTEGER NOT NULL DEFAULT 500,
        sound_type TEXT NOT NULL DEFAULT 'alarm',
        sound_uri TEXT,
        volume REAL NOT NULL DEFAULT 0.8,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    `);

    // カラム追加（既存テーブルに不足カラムがある場合）
    const newTableInfo = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(sessions)"
    );
    const columnNames = newTableInfo.map((c) => c.name);

    if (!columnNames.includes('origin_station_json')) {
      await database.execAsync('ALTER TABLE sessions ADD COLUMN origin_station_json TEXT');
    }
    if (!columnNames.includes('destination_station_json')) {
      await database.execAsync('ALTER TABLE sessions ADD COLUMN destination_station_json TEXT');
    }
    if (!columnNames.includes('all_stations')) {
      await database.execAsync('ALTER TABLE sessions ADD COLUMN all_stations TEXT');
    }
  }
}

/** 駅名で検索（プロバイダに委譲） */
export async function searchStationsByName(
  keyword: string,
  currentLocation?: { latitude: number; longitude: number } | null
): Promise<Station[]> {
  return getProvider().searchStations(keyword, currentLocation);
}

/** 駅IDで駅情報を取得（プロバイダに委譲） */
export async function getStationById(id: string): Promise<Station | null> {
  return getProvider().getStationById(id);
}

/** グループIDで駅情報を取得（プロバイダに委譲） */
export async function getStationByGroupId(groupId: string): Promise<Station | null> {
  return getProvider().getStationByGroupId(groupId);
}

// ─── セッション CRUD ────────────────────────────────────────────

export async function saveSession(session: import('../types').Session): Promise<void> {
  const database = await getDatabase();
  const routeJson = JSON.stringify(session.route);
  const allStationsJson = session.allStations ? JSON.stringify(session.allStations) : null;
  await database.runAsync(
    `INSERT OR REPLACE INTO sessions
      (id, origin_station_id, destination_station_id,
       origin_station_json, destination_station_json,
       route, all_stations, detection_radius,
       sound_type, sound_uri, volume, status, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.originStation.id,
      session.destinationStation.id,
      JSON.stringify(session.originStation),
      JSON.stringify(session.destinationStation),
      routeJson,
      allStationsJson,
      session.detectionRadius,
      session.soundType,
      session.soundUri ?? null,
      session.volume,
      session.status,
      session.startedAt,
      session.completedAt ?? null,
    ]
  );
}

export async function getSession(id: string): Promise<import('../types').Session | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<SessionRow>(
    'SELECT * FROM sessions WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return rowToSession(row);
}

export async function getAllSessions(): Promise<import('../types').Session[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<SessionRow>(
    'SELECT * FROM sessions ORDER BY started_at DESC'
  );
  return Promise.all(rows.map((r) => rowToSession(r)));
}

export async function updateSessionStatus(
  id: string,
  status: import('../types').Session['status'],
  completedAt?: string
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE sessions SET status = ?, completed_at = ? WHERE id = ?',
    [status, completedAt ?? null, id]
  );
}

export async function deleteSession(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

export async function updateSessionSettings(
  id: string,
  soundType: SoundType,
  detectionRadius: number
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE sessions SET sound_type = ?, detection_radius = ? WHERE id = ?',
    [soundType, detectionRadius, id]
  );
}

// ─── 内部ヘルパー ──────────────────────────────────────────────

type SessionRow = {
  id: string;
  origin_station_id?: string;
  destination_station_id?: string;
  origin_station_cd?: number;
  destination_station_cd?: number;
  origin_station_json?: string | null;
  destination_station_json?: string | null;
  route: string;
  all_stations?: string | null;
  detection_radius: number;
  sound_type: string;
  sound_uri: string | null;
  volume: number;
  status: string;
  started_at: string;
  completed_at: string | null;
};

async function rowToSession(row: SessionRow): Promise<import('../types').Session> {
  const provider = getProvider();

  // route の復元: JSON配列（Station[] または旧形式 number[]）
  let route: Station[] = [];
  try {
    const parsed = JSON.parse(row.route);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === 'object' && parsed[0].id != null) {
        // 新形式: Station[] が直接保存されている
        route = parsed as Station[];
      } else if (typeof parsed[0] === 'object' && parsed[0].stationCd != null) {
        // 旧形式（v1互換）: stationCd を持つオブジェクト配列
        route = parsed.map((s: Record<string, unknown>) => ({
          id: String(s.stationCd),
          groupId: s.stationGCd != null ? String(s.stationGCd) : undefined,
          name: String(s.stationName ?? ''),
          lineId: String(s.lineCd ?? ''),
          lineName: String(s.lineName ?? ''),
          lineNames: Array.isArray(s.lineNames) ? s.lineNames as string[] : undefined,
          latitude: Number(s.latitude ?? 0),
          longitude: Number(s.longitude ?? 0),
        })) as Station[];
      } else if (typeof parsed[0] === 'number') {
        // 最旧形式: station_cd の number 配列
        const stations = await Promise.all(
          (parsed as number[]).map((cd) => provider.getStationById(String(cd)))
        );
        route = stations.filter((s): s is Station => s !== null);
      }
    }
  } catch {
    route = [];
  }

  // origin/destination の復元
  let originStation: Station | null = null;
  let destinationStation: Station | null = null;

  // 新形式: JSON として保存されている場合
  if (row.origin_station_json) {
    try {
      const parsed = JSON.parse(row.origin_station_json);
      if (parsed.id != null) {
        originStation = parsed as Station;
      } else if (parsed.stationCd != null) {
        originStation = {
          id: String(parsed.stationCd),
          name: String(parsed.stationName ?? ''),
          lineId: String(parsed.lineCd ?? ''),
          lineName: String(parsed.lineName ?? ''),
          latitude: Number(parsed.latitude ?? 0),
          longitude: Number(parsed.longitude ?? 0),
        };
      }
    } catch { /* ignore */ }
  }
  if (row.destination_station_json) {
    try {
      const parsed = JSON.parse(row.destination_station_json);
      if (parsed.id != null) {
        destinationStation = parsed as Station;
      } else if (parsed.stationCd != null) {
        destinationStation = {
          id: String(parsed.stationCd),
          name: String(parsed.stationName ?? ''),
          lineId: String(parsed.lineCd ?? ''),
          lineName: String(parsed.lineName ?? ''),
          latitude: Number(parsed.latitude ?? 0),
          longitude: Number(parsed.longitude ?? 0),
        };
      }
    } catch { /* ignore */ }
  }

  // フォールバック: ID から取得
  if (!originStation) {
    const id = row.origin_station_id || (row.origin_station_cd != null ? String(row.origin_station_cd) : null);
    if (id) originStation = await provider.getStationById(id);
  }
  if (!destinationStation) {
    const id = row.destination_station_id || (row.destination_station_cd != null ? String(row.destination_station_cd) : null);
    if (id) destinationStation = await provider.getStationById(id);
  }

  // 最終フォールバック: route の先頭/末尾
  if (!originStation) originStation = route[0];
  if (!destinationStation) destinationStation = route[route.length - 1];

  // all_stations の復元
  let allStations: Station[] | undefined;
  if (row.all_stations) {
    try {
      const parsed = JSON.parse(row.all_stations);
      if (Array.isArray(parsed) && parsed.length > 0) {
        allStations = parsed as Station[];
      }
    } catch { /* ignore */ }
  }

  return {
    id: row.id,
    originStation: originStation!,
    destinationStation: destinationStation!,
    route,
    allStations,
    detectionRadius: row.detection_radius,
    soundType: row.sound_type as SoundType,
    soundUri: row.sound_uri ?? undefined,
    volume: row.volume,
    status: row.status as import('../types').Session['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
  };
}
