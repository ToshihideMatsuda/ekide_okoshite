import { Station } from '../types';

const SUBWAY_KEYWORDS = ['メトロ', '地下鉄', '都営', 'Osaka Metro'];

export function isSubwayLine(lineName: string): boolean {
  return SUBWAY_KEYWORDS.some((kw) => lineName.includes(kw));
}

export type SubwayInfo = {
  hasSubway: boolean;
  subwayStations: Station[];
};

export function detectSubwayStations(route: Station[]): SubwayInfo {
  const subwayStations = route.filter((s) => isSubwayLine(s.lineName));
  return { hasSubway: subwayStations.length > 0, subwayStations };
}
