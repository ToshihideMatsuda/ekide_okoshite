// データソースの種別
export type TransitDataSource = 'ekidata' | 'gtfs' | 'osm';

// 汎用駅データ型（全データソース共通）
// ekidata.jp / GTFS / OSM のいずれでも同じ構造で扱える
export type Station = {
  id: string;            // 駅の一意ID（ekidata: stationCd, GTFS: stop_id, OSM: node_id）
  groupId?: string;      // 同一物理駅のグループID（乗り換え判定用）
  name: string;          // 駅名
  lineId: string;        // 路線ID（ekidata: lineCd, GTFS: route_id, OSM: relation_id）
  lineName: string;      // 路線名（代表）
  lineNames?: string[];  // 全路線名（グループ化時）
  latitude: number;
  longitude: number;
  source?: TransitDataSource; // データソース識別（省略時は現在のプロバイダ）
};

export type SoundType = 'alarm' | 'music' | 'vibration';

// セッション（乗車から下車までの1回分）
export type Session = {
  id: string;
  originStation: Station;      // 出発駅（GPS自動取得）
  destinationStation: Station; // 目的駅（ユーザー入力）
  route: Station[];            // 経路上の主要駅（出発・乗り換え・目的駅）
  allStations?: Station[];     // ポリライン描画用の全駅（乗換駅以外も含む）
  detectionRadius: number;     // 駅検出半径（100〜1000m、デフォルト500m）
  soundType: SoundType;
  soundUri?: string;           // カスタム音楽URI
  volume: number;              // 0.0〜1.0
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  isFromMyRoute?: boolean;     // マイルートから復元した場合 true（複数経路計算スキップ用）
};
