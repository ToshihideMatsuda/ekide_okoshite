const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../src/data/ekidata');
const indexFilePath = path.join(dataDir, 'index.ts');

const companyCsv = fs.readFileSync(path.join(dataDir, 'company.csv'), 'utf8');
const lineCsv = fs.readFileSync(path.join(dataDir, 'line.csv'), 'utf8');
const stationCsv = fs.readFileSync(path.join(dataDir, 'station.csv'), 'utf8');
const joinCsv = fs.readFileSync(path.join(dataDir, 'join.csv'), 'utf8');

const content = `/**
 * 駅データ.jp CSVデータのTypeScriptエクスポート。
 *
 * 実データに差し替える場合は、src/data/ekidata/ 配下のCSVファイルを
 * 更新した後、このファイルを再生成してください。
 * （または metro.config.js で CSV を sourceExts に追加して直接インポートも可能）
 *
 * CSV元データ: https://ekidata.jp/
 */

export const COMPANY_CSV = \`${companyCsv.replace(/`/g, '\\`').trim()}\`;

export const LINE_CSV = \`${lineCsv.replace(/`/g, '\\`').trim()}\`;

export const STATION_CSV = \`${stationCsv.replace(/`/g, '\\`').trim()}\`;

export const JOIN_CSV = \`${joinCsv.replace(/`/g, '\\`').trim()}\`;
`;

fs.writeFileSync(indexFilePath, content);
console.log('Successfully generated index.ts from CSV files.');
