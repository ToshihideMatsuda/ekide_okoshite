/**
 * 経路計算用グラフの型定義。
 *
 * ノード: グループID（同一物理駅をまとめた識別子）
 * エッジ: 隣接する駅への移動（路線ID付き）
 *
 * データソースに依存しない汎用的な構造。
 * ekidata.jp では station_g_cd、GTFS では parent_station、
 * OSM では同一座標の駅をグループ化してノードとする。
 */

/** グラフのエッジ情報 */
export type EdgeInfo = {
  /** 隣接駅のグループID */
  to: string;
  /** この移動に使う路線ID */
  lineId: string;
};

/** 経路計算用グラフ */
export type Graph = {
  /** グループID → 移動エッジ（隣接するグループIDと路線ID） */
  edges: Map<string, EdgeInfo[]>;
  /** グループID → その駅で利用可能な路線IDのSet */
  stationLines: Map<string, Set<string>>;
};
