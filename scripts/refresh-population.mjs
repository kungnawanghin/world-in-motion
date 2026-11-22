import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const sourceUrl = `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&source=2&date=1960:${new Date().getUTCFullYear()}&per_page=20000`;
const input = process.argv.indexOf('--input');
let raw;
if (input >= 0) raw = JSON.parse(await readFile(process.argv[input + 1], 'utf8'));
else {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`World Bank HTTP ${response.status}`);
  raw = await response.json();
}
const [meta, rows] = raw;
if (!Array.isArray(rows) || meta.pages !== 1 || Number(meta.total) !== rows.length || !meta.lastupdated)
  throw new Error('Incomplete World Bank response; keeping existing snapshot.');
const geometry = await readFile(new URL('components/ui/interactive-globe-utils/countries.ts', root), 'utf8');
const codes = new Set([...geometry.matchAll(/"iso3":"([A-Z]{3})"/g)].map(match => match[1]));
const records = rows.filter(row => codes.has(row.countryiso3code));
if (!records.length || records.some(row => row.indicator.id !== 'SP.POP.TOTL' ||
  (row.value !== null && (!Number.isFinite(row.value) || row.value < 0)))) throw new Error('Invalid population data.');
const startYear = 1960;
const endYear = Math.max(...records.filter(row => row.value !== null).map(row => Number(row.date)));
const series = {};
for (const row of records) {
  const year = Number(row.date);
  if (year < startYear || year > endYear) continue;
  series[row.countryiso3code] ??= Array(endYear - startYear + 1).fill(null);
  series[row.countryiso3code][year - startYear] = row.value;
}
const counts = Array.from({length:endYear-startYear+1}, (_, i) => Object.values(series).filter(s => s[i] !== null).length);
const minimumCoverage = Math.max(...counts) * .95;
const mapYear = startYear + counts.findLastIndex(count => count >= minimumCoverage);
if (Object.keys(series).length < 180) throw new Error('Unexpectedly low coverage; keeping existing snapshot.');
const snapshot = { indicator:'SP.POP.TOTL', source:'World Bank · World Development Indicators', sourceUrl,
  sourceUpdated:meta.lastupdated, fetchedAt:new Date().toISOString(), startYear,endYear,mapYear,series };
await mkdir(new URL('src/population/', root), { recursive:true });
await writeFile(new URL('src/population/population.json', root), JSON.stringify(snapshot));
console.log(`${Object.keys(series).length} mapped countries/territories; ${startYear}–${endYear}; map ${mapYear}: ${counts[mapYear-startYear]} areas. Saved ${fileURLToPath(new URL('src/population/population.json',root))}`);
