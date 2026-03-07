/**
 * ダイクストラ法による最短経路計算。
 *
 * ノード: groupId（同一物理駅をまとめたグループID）
 * エッジ: 接続情報（lineId付き）、無向グラフ
 * 乗り換え駅: 同一 groupId に複数の lineId が存在する駅
 *
 * コスト:
 *   - 同一路線の隣駅への移動: 1
 *   - 同一駅内での路線乗り換え: 3
 *
 * データソースに依存しない汎用的な実装。
 * グラフ構築は TransitDataProvider が担う。
 */
import { Station } from '../types';
import { Graph, EdgeInfo } from '../providers';
import { getProvider } from '../providers';
import { t } from '../i18n';

/** ダイクストラ法の各ステップ: グループIDと到着路線ID */
type PathStep = { groupId: string; lineId: string };

const MOVE_COST = 1;
const TRANSFER_COST = 3;

// Graph, EdgeInfo は providers/types.ts からの再エクスポート
export type { Graph, EdgeInfo };

/**
 * 現在のプロバイダでグラフを構築する。
 */
export async function buildGraph(): Promise<Graph> {
  return getProvider().buildGraph();
}

/**
 * 状態ベースのダイクストラ法。
 * 状態 = (groupId, lineId)
 * - 同一路線での隣駅移動: コスト MOVE_COST
 * - 同一駅での路線乗り換え: コスト TRANSFER_COST
 */
export function dijkstra(
  graph: Graph,
  startGroupId: string,
  endGroupId: string,
  blocked: Set<string> = new Set()
): { path: PathStep[]; cost: number } | null {
  if (startGroupId === endGroupId) return { path: [{ groupId: startGroupId, lineId: '' }], cost: 0 };

  const stateKey = (g: string, l: string): string => `${g}:${l}`;
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  // [cost, groupId, lineId]
  const queue: [number, string, string][] = [];

  // 出発駅の全路線を初期状態（コスト0）として登録
  const startLines = graph.stationLines.get(startGroupId) ?? new Set<string>();
  for (const lineId of startLines) {
    const k = stateKey(startGroupId, lineId);
    dist.set(k, 0);
    queue.push([0, startGroupId, lineId]);
  }

  while (queue.length > 0) {
    // 最小コストの状態を選択（簡易優先度キュー）
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i][0] < queue[minIdx][0]) minIdx = i;
    }
    const [d, g, currentLine] = queue[minIdx];
    queue.splice(minIdx, 1);

    if (g === endGroupId) break;

    const k = stateKey(g, currentLine);
    if (d > (dist.get(k) ?? Infinity)) continue;

    // 同一路線での隣駅移動
    for (const { to, lineId } of graph.edges.get(g) ?? []) {
      if (lineId !== currentLine) continue;
      if (blocked.has(to) && to !== endGroupId) continue;
      const newKey = stateKey(to, lineId);
      const newDist = d + MOVE_COST;
      if (newDist < (dist.get(newKey) ?? Infinity)) {
        dist.set(newKey, newDist);
        prev.set(newKey, k);
        queue.push([newDist, to, lineId]);
      }
    }

    // 同一駅内での路線乗り換え
    for (const otherLine of graph.stationLines.get(g) ?? new Set<string>()) {
      if (otherLine === currentLine) continue;
      const newKey = stateKey(g, otherLine);
      const newDist = d + TRANSFER_COST;
      if (newDist < (dist.get(newKey) ?? Infinity)) {
        dist.set(newKey, newDist);
        prev.set(newKey, k);
        queue.push([newDist, g, otherLine]);
      }
    }
  }

  // 目的駅で最小コストの状態を探す
  let bestCost = Infinity;
  let bestEndKey: string | null = null;
  for (const [k, cost] of dist) {
    const gPart = k.substring(0, k.indexOf(':'));
    if (gPart === endGroupId && cost < bestCost) {
      bestCost = cost;
      bestEndKey = k;
    }
  }

  if (bestEndKey === null) return null;

  // パスを (groupId, lineId) の列として復元
  const fullPath: PathStep[] = [];
  let cur: string | undefined = bestEndKey;
  while (cur !== undefined) {
    const colonIdx = cur.indexOf(':');
    fullPath.unshift({
      groupId: cur.substring(0, colonIdx),
      lineId: cur.substring(colonIdx + 1),
    });
    cur = prev.get(cur);
  }

  // 連続する同一 groupId（乗り換えステップ）を除去
  const deduped: PathStep[] = [];
  for (const step of fullPath) {
    if (deduped.length === 0 || deduped[deduped.length - 1].groupId !== step.groupId) {
      deduped.push(step);
    }
  }

  if (deduped[0].groupId !== startGroupId) return null;
  return { path: deduped, cost: bestCost };
}

export type RouteResult = {
  /** 表示・ジオフェンス用: 出発・乗り換え・目的駅のみ */
  route: Station[];
  /** マップポリライン用: 各区間の同一路線上の全駅 */
  allStations: Station[];
};

/**
 * 指定路線の辺だけを使って fromGroupId → toGroupId への BFS パスを返す。
 */
function bfsOnLine(
  fromGroupId: string,
  toGroupId: string,
  lineId: string,
  edges: Map<string, EdgeInfo[]>
): string[] | null {
  if (fromGroupId === toGroupId) return [fromGroupId];

  const prev = new Map<string, string>();
  prev.set(fromGroupId, '');
  const queue = [fromGroupId];

  outer: while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const { to, lineId: edgeLineId } of edges.get(cur) ?? []) {
      if (edgeLineId !== lineId || prev.has(to)) continue;
      prev.set(to, cur);
      if (to === toGroupId) break outer;
      queue.push(to);
    }
  }

  if (!prev.has(toGroupId)) return null;

  const path: string[] = [];
  let node = toGroupId;
  while (node !== '') {
    path.unshift(node);
    node = prev.get(node)!;
  }
  return path;
}

/**
 * fromGroupId から出る全路線で BFS を試し、最多中間駅のパスを返す。
 */
function findBestPath(
  fromGroupId: string,
  toGroupId: string,
  edges: Map<string, EdgeInfo[]>
): { path: string[]; lineId: string } {
  const lineIds = new Set<string>();
  for (const { lineId } of edges.get(fromGroupId) ?? []) lineIds.add(lineId);

  let bestPath: string[] = [fromGroupId, toGroupId];
  let bestLineId = '';
  for (const lineId of lineIds) {
    const path = bfsOnLine(fromGroupId, toGroupId, lineId, edges);
    if (path && path.length > bestPath.length) {
      bestPath = path;
      bestLineId = lineId;
    }
  }
  return { path: bestPath, lineId: bestLineId };
}

/**
 * route（乗り換え駅のみ）の各区間を同一路線で BFS し、
 * 中間駅を補間したポリライン用の全駅リストを返す。
 */
async function buildPolylineStations(
  route: Station[],
  graph: Graph
): Promise<Station[]> {
  if (route.length === 0) return [];
  const provider = getProvider();

  console.log('[Polyline] === buildPolylineStations START ===');
  console.log('[Polyline] route (key stations):', route.map(s => `${s.name}(gId=${s.groupId}, lineId=${s.lineId}, lineName=${s.lineName})`));

  const result: Station[] = [route[0]];

  for (let i = 1; i < route.length; i++) {
    const fromGroupId = route[i - 1].groupId;
    const toGroupId = route[i].groupId;

    console.log(`[Polyline] segment [${i}]: ${route[i-1].name}(gId=${fromGroupId}) → ${route[i].name}(gId=${toGroupId}) on lineId=${route[i].lineId}(${route[i].lineName})`);

    if (fromGroupId && toGroupId) {
      const { path: groupIdPath, lineId: usedLineId } = findBestPath(fromGroupId, toGroupId, graph.edges);
      console.log(`[Polyline]   BFS used lineId=${usedLineId} result groupIds:`, groupIdPath);

      const intermediate: string[] = [];
      for (const gId of groupIdPath.slice(1, -1)) {
        const station = await provider.getStationByGroupId(gId);
        if (station) {
          intermediate.push(station.name);
          result.push(station);
        }
      }
      console.log(`[Polyline]   intermediate stations:`, intermediate.length > 0 ? intermediate : '(none)');
    } else {
      console.log(`[Polyline]   SKIP: missing groupId (from=${fromGroupId}, to=${toGroupId})`);
    }
    result.push(route[i]);
  }

  console.log('[Polyline] allStations:', result.map(s => s.name));
  console.log('[Polyline] === buildPolylineStations END ===');
  return result;
}

async function pathToRouteResult(path: PathStep[], graph: Graph): Promise<RouteResult> {
  const provider = getProvider();

  // 各ステップの駅情報を取得し、到着路線を上書き
  const stations: Station[] = [];
  for (const { groupId, lineId } of path) {
    const station = await provider.getStationByGroupId(groupId);
    if (!station) continue;
    if (lineId) {
      const lineName = await provider.getLineName(lineId);
      stations.push({ ...station, lineId, lineName });
    } else {
      stations.push(station);
    }
  }

  // 路線が変わらない中間駅を除去: 出発駅・乗り換え駅・目的駅のみ残す
  const route = stations.filter((s, i) => {
    if (i === 0 || i === stations.length - 1) return true;
    return stations[i + 1].lineId !== s.lineId;
  });

  // ポリライン用: route の各区間を同一路線で BFS して中間駅を補間
  const allStations = await buildPolylineStations(route, graph);

  return { route, allStations };
}

export async function calculateRoute(
  graph: Graph,
  originId: string,
  destinationId: string
): Promise<RouteResult> {
  const provider = getProvider();

  // 駅ID → グループID に変換
  const [originGroupId, destGroupId] = await Promise.all([
    provider.getGroupIdById(originId),
    provider.getGroupIdById(destinationId),
  ]);

  if (!originGroupId || !destGroupId) {
    throw new Error(t('error.noRoute'));
  }

  const result = dijkstra(graph, originGroupId, destGroupId);
  if (!result) {
    throw new Error(t('error.noRoute'));
  }

  return pathToRouteResult(result.path, graph);
}

function routeKey(route: Station[]): string {
  return route.map(s => s.groupId ?? s.id).join(',');
}

export async function calculateMultipleRoutes(
  graph: Graph,
  originId: string,
  destinationId: string,
  maxRoutes: number = 5,
  maxExtraCost: number = 10
): Promise<RouteResult[]> {
  const provider = getProvider();

  const [originGroupId, destGroupId] = await Promise.all([
    provider.getGroupIdById(originId),
    provider.getGroupIdById(destinationId),
  ]);

  if (!originGroupId || !destGroupId) return [];

  const optimal = dijkstra(graph, originGroupId, destGroupId);
  if (!optimal) return [];

  const results: RouteResult[] = [];
  const seenKeys = new Set<string>();

  const first = await pathToRouteResult(optimal.path, graph);
  seenKeys.add(routeKey(first.route));
  results.push(first);

  // 中間ノード（出発・終点を除く）を1つずつブロックして代替経路を探す
  const intermediates = optimal.path.slice(1, -1).map(s => s.groupId);
  for (const blockedGroupId of intermediates) {
    if (results.length >= maxRoutes) break;

    const blocked = new Set<string>([blockedGroupId]);
    const alt = dijkstra(graph, originGroupId, destGroupId, blocked);
    if (!alt) continue;
    if (alt.cost > optimal.cost + maxExtraCost) continue;

    const altResult = await pathToRouteResult(alt.path, graph);
    const key = routeKey(altResult.route);
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    results.push(altResult);
  }

  return results;
}
