/**
 * GTFS (General Transit Feed Specification) プロバイダ（スタブ）。
 *
 * GTFS は Google が提唱した公共交通データの世界標準フォーマット。
 * stops.txt, routes.txt, trips.txt, stop_times.txt 等から
 * 駅・路線・接続情報を構築する。
 *
 * 対応データソース:
 * - Mobility Database (https://mobilitydatabase.org/)
 * - TransitFeeds (https://transitfeeds.com/)
 * - 各国政府のオープンデータポータル
 *
 * 実装時の注意:
 * - stop_id は文字列（プロバイダ間で重複する可能性あり）
 * - parent_station で同一物理駅をグループ化
 * - グラフ構築は stop_times.txt の連続する停車駅から生成
 * - タイムゾーン対応が必要（agency_timezone）
 */
import { Station, TransitDataSource } from '../types';
import { TransitDataProvider } from './TransitDataProvider';
import { Graph } from './types';

class GtfsProviderImpl implements TransitDataProvider {
  readonly source: TransitDataSource = 'gtfs';

  async initialize(): Promise<void> {
    // TODO: GTFS ZIP/CSV をダウンロードし、SQLite にインポート
    // 必要テーブル: stops, routes, trips, stop_times, transfers
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async searchStations(
    _keyword: string,
    _location?: { latitude: number; longitude: number } | null
  ): Promise<Station[]> {
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async getStationById(_id: string): Promise<Station | null> {
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async getStationByGroupId(_groupId: string): Promise<Station | null> {
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async findNearestStation(
    _latitude: number,
    _longitude: number,
    _radiusKm?: number
  ): Promise<Station | null> {
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async getGroupIdById(_id: string): Promise<string | null> {
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async getLineName(_lineId: string): Promise<string> {
    throw new Error('GTFS プロバイダは未実装です。');
  }

  async buildGraph(): Promise<Graph> {
    // TODO: stop_times.txt の trip ごとの停車順序からエッジを生成
    // 同一 trip 内の連続する stop_id をエッジとして追加
    // route_id を lineId として使用
    // parent_station を groupId として使用
    throw new Error('GTFS プロバイダは未実装です。');
  }
}

export const gtfsProvider = new GtfsProviderImpl();
