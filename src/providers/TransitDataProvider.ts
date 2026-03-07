/**
 * 交通データプロバイダのインターフェース。
 *
 * ekidata.jp / GTFS / OSM など、異なるデータソースを
 * 統一的に扱うための抽象レイヤー。
 *
 * 各プロバイダは以下を実装する:
 * - 駅データの初期化・インポート
 * - 駅検索・取得
 * - 最寄り駅の算出
 * - 経路計算用グラフの構築
 */
import { Station, TransitDataSource } from '../types';
import { Graph } from './types';

export interface TransitDataProvider {
  /** データソース種別 */
  readonly source: TransitDataSource;

  /** データの初期化（DB構築・データインポート等） */
  initialize(): Promise<void>;

  /** 駅名で検索（前方一致等、プロバイダ依存）。現在地を渡すと距離順でソート */
  searchStations(
    keyword: string,
    location?: { latitude: number; longitude: number } | null
  ): Promise<Station[]>;

  /** 駅IDで駅情報を取得 */
  getStationById(id: string): Promise<Station | null>;

  /** グループIDで駅情報を取得（同一物理駅の代表を返す） */
  getStationByGroupId(groupId: string): Promise<Station | null>;

  /** GPS座標から最寄り駅を返す */
  findNearestStation(
    latitude: number,
    longitude: number,
    radiusKm?: number
  ): Promise<Station | null>;

  /** 駅IDからグループIDを取得 */
  getGroupIdById(id: string): Promise<string | null>;

  /** 路線IDから路線名を取得 */
  getLineName(lineId: string): Promise<string>;

  /** 経路計算用のグラフを構築して返す */
  buildGraph(): Promise<Graph>;
}
