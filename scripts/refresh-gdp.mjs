import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {updateIndicatorRange} from './update-indicator-range.mjs';
const root=new URL('../',import.meta.url);
const sourceUrl=`https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.KD?format=json&source=2&date=1960:${new Date().getUTCFullYear()}&per_page=20000`;
async function getJson(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`World Bank HTTP ${r.status}`);return r.json();}
const input=process.argv.indexOf('--input'),metadataInput=process.argv.indexOf('--metadata');
const raw=input>=0?JSON.parse(await readFile(process.argv[input+1],'utf8')):await getJson(sourceUrl);
const metadata=metadataInput>=0?JSON.parse(await readFile(process.argv[metadataInput+1],'utf8')):await getJson('https://api.worldbank.org/v2/indicator/NY.GDP.PCAP.KD?format=json&source=2');
const indicator=metadata[1]?.find(row=>row.id==='NY.GDP.PCAP.KD');
if(!indicator||!indicator.name.includes('constant 2015 US$')||!indicator.sourceNote.includes('2015'))throw new Error('GDP reference year changed; review units before updating.');
const [meta,rows]=raw;
if(!Array.isArray(rows)||Number(meta.pages)!==1||Number(meta.total)!==rows.length||!meta.lastupdated)throw new Error('Incomplete API response; retaining existing snapshot.');
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const codes=new Set([...geometry.matchAll(/"iso3":"([A-Z]{3})"/g)].map(m=>m[1]));
const records=rows.filter(row=>codes.has(row.countryiso3code));
if(!records.length||records.some(row=>row.indicator.id!=='NY.GDP.PCAP.KD'||!Number.isInteger(Number(row.date))||(row.value!==null&&(!Number.isFinite(row.value)||row.value<0))))throw new Error('Invalid GDP data');
const startYear=1960,endYear=Math.max(...records.filter(row=>row.value!==null).map(row=>Number(row.date))),series={};
for(const row of records){const year=Number(row.date);if(year<startYear||year>endYear)continue;series[row.countryiso3code]??=Array(endYear-startYear+1).fill(null);series[row.countryiso3code][year-startYear]=row.value;}
const counts=Array.from({length:endYear-startYear+1},(_,i)=>Object.values(series).filter(s=>s[i]!==null).length);
const mapYear=startYear+counts.findLastIndex(count=>count>=Math.max(...counts)*.95);
if(Object.values(series).filter(s=>s.some(n=>n!==null)).length<180)throw new Error('Unexpected GDP coverage');
const snapshot={indicator:indicator.id,indicatorName:indicator.name,unit:'constant 2015 US$',baseYear:2015,source:'World Bank · World Development Indicators',sourceUrl,sourceUpdated:meta.lastupdated,fetchedAt:new Date().toISOString(),startYear,endYear,mapYear,series};
await mkdir(new URL('src/indicators/',root),{recursive:true});
await writeFile(new URL('src/indicators/gdp.json',root),JSON.stringify(snapshot));
await updateIndicatorRange();
console.log(`GDP snapshot: ${startYear}–${endYear}; ${counts[endYear-startYear]} areas in ${endYear}; reference year 2015.`);
