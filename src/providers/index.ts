/**
 * 交通データプロバイダのレジストリ。
 *
 * アプリ起動時にプロバイダを選択し、以降は getProvider() で取得する。
 * デフォルトは ekidata（日本国内向け）。
 *
 * 将来的に地域に応じたプロバイダ自動選択や、
 * 複数プロバイダの同時使用もこのレジストリで管理する。
 */
import { TransitDataSource } from '../types';
import { TransitDataProvider } from './TransitDataProvider';
import { ekidataProvider } from './EkidataProvider';
import { gtfsProvider } from './GtfsProvider';
import { osmProvider } from './OsmProvider';

export { TransitDataProvider } from './TransitDataProvider';
export { Graph, EdgeInfo } from './types';

/** 登録済みプロバイダ一覧 */
const providers: Record<TransitDataSource, TransitDataProvider> = {
  ekidata: ekidataProvider,
  gtfs: gtfsProvider,
  osm: osmProvider,
};

/** 現在選択中のプロバイダ */
let currentProvider: TransitDataProvider = ekidataProvider;

/** プロバイダを切り替える */
export function setProvider(source: TransitDataSource): void {
  const provider = providers[source];
  if (!provider) {
    throw new Error(`未知のデータソース: ${source}`);
  }
  currentProvider = provider;
}

/** 現在のプロバイダを取得 */
export function getProvider(): TransitDataProvider {
  return currentProvider;
}

/** カスタムプロバイダを登録する（サードパーティ拡張用） */
export function registerProvider(source: TransitDataSource, provider: TransitDataProvider): void {
  providers[source] = provider;
}
