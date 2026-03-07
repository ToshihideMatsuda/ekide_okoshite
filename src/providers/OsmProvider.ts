/**
 * OpenStreetMap (OSM) プロバイダ（スタブ）。
 *
 * OSM は有志によって維持される世界最大のオープン地図データ。
 * 鉄道駅（railway=station）や路線（route=train/subway）のデータが
 * 世界中で整備されている。
 *
 * データ取得方法:
 * - Overpass API: リアルタイムクエリ（例: 半径10km以内の鉄道駅を検索）
 * - PBF/XML ダンプ: 国・地域単位のオフラインデータ
 *
 * 対応地域の特徴:
 * - 韓国・台湾: データ密度が非常に高い
 * - 中国: GCJ-02 座標系への変換が必要
 * - 欧米: ほぼ完全にカバーされている
 *
 * 実装時の注意:
 * - node_id を駅ID として使用
 * - route relation から路線情報を取得
 * - 同一座標（または近接座標）の駅をグループ化
 * - ライセンス: ODbL（帰属表示が必要）
 * - 中国の座標系: WGS-84 → GCJ-02 変換が必要な場合あり
 */
import { Station, TransitDataSource } from '../types';
import { TransitDataProvider } from './TransitDataProvider';
import { Graph } from './types';

class OsmProviderImpl implements TransitDataProvider {
  readonly source: TransitDataSource = 'osm';

  async initialize(): Promise<void> {
    // TODO: Overpass API または PBF ダンプから鉄道駅データを取得
    // クエリ例: [out:json]; node["railway"="station"](bbox); out;
    throw new Error('OSM プロバイダは未実装です。');
  }

  async searchStations(
    _keyword: string,
    _location?: { latitude: number; longitude: number } | null
  ): Promise<Station[]> {
    throw new Error('OSM プロバイダは未実装です。');
  }

  async getStationById(_id: string): Promise<Station | null> {
    throw new Error('OSM プロバイダは未実装です。');
  }

  async getStationByGroupId(_groupId: string): Promise<Station | null> {
    throw new Error('OSM プロバイダは未実装です。');
  }

  async findNearestStation(
    _latitude: number,
    _longitude: number,
    _radiusKm?: number
  ): Promise<Station | null> {
    throw new Error('OSM プロバイダは未実装です。');
  }

  async getGroupIdById(_id: string): Promise<string | null> {
    throw new Error('OSM プロバイダは未実装です。');
  }

  async getLineName(_lineId: string): Promise<string> {
    throw new Error('OSM プロバイダは未実装です。');
  }

  async buildGraph(): Promise<Graph> {
    // TODO: route relation のメンバーノード順序からエッジを生成
    // 近接座標の駅を groupId でグループ化
    throw new Error('OSM プロバイダは未実装です。');
  }
}

export const osmProvider = new OsmProviderImpl();
