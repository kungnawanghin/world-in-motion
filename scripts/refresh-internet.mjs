import {readFile,writeFile} from 'node:fs/promises';
import {updateIndicatorRange} from './update-indicator-range.mjs';
const root=new URL('../',import.meta.url),code='IT.NET.USER.ZS';
const sourceUrl='https://api.worldbank.org/v2/country/all/indicator/'+code+'?format=json&source=2&date=1960:'+new Date().getUTCFullYear()+'&per_page=20000';
async function getJson(url){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('World Bank HTTP '+response.status);return response.json();}
const input=process.argv.indexOf('--input'),metadataInput=process.argv.indexOf('--metadata');
const raw=input>=0?JSON.parse(await readFile(process.argv[input+1],'utf8')):await getJson(sourceUrl);
const metadata=metadataInput>=0?JSON.parse(await readFile(process.argv[metadataInput+1],'utf8')):await getJson('https://api.worldbank.org/v2/indicator/'+code+'?format=json&source=2');
const indicator=metadata[1]?.find(row=>row.id===code);
if(!indicator||indicator.name!=='Individuals using the Internet (% of population)'||!indicator.sourceNote?.includes('3 months'))throw Error('Unexpected internet use definition; keeping existing snapshot.');
const [meta,rows]=raw;
if(!Array.isArray(rows)||Number(meta.pages)!==1||Number(meta.total)!==rows.length||!meta.lastupdated)throw Error('Incomplete API response; keeping existing snapshot.');
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const codes=new Set([...geometry.matchAll(/"iso3":"([A-Z]{3})"/g)].map(m=>m[1]));
const records=rows.filter(row=>codes.has(row.countryiso3code));
if(!records.length||records.some(row=>row.indicator.id!==code||!Number.isInteger(Number(row.date))||(row.value!==null&&(!Number.isFinite(row.value)||row.value<0||row.value>100))))throw Error('Invalid internet use observations');
const startYear=1990,endYear=Math.max(...records.filter(row=>row.value!==null).map(row=>Number(row.date))),series={},seen=new Set();
for(const row of records){const year=Number(row.date);if(year<startYear||year>endYear)continue;const key=row.countryiso3code+':'+year;if(seen.has(key))throw Error('Duplicate observation');seen.add(key);series[row.countryiso3code]??=Array(endYear-startYear+1).fill(null);series[row.countryiso3code][year-startYear]=row.value;}
const counts=Array.from({length:endYear-startYear+1},(_,i)=>Object.values(series).filter(s=>s[i]!==null).length);
const mapYear=startYear+counts.findLastIndex(count=>count>=Math.max(...counts)*.95);
if(Object.values(series).filter(s=>s.some(n=>n!==null)).length<180)throw Error('Unexpected internet use coverage');
const snapshot={indicator:code,indicatorName:indicator.name,unit:'% of population',definition:indicator.sourceNote,source:'International Telecommunication Union (ITU) · World Bank WDI',sourceUrl,sourceUpdated:meta.lastupdated,fetchedAt:new Date().toISOString(),startYear,endYear,mapYear,series};
await writeFile(new URL('src/indicators/internet.json',root),JSON.stringify(snapshot));
await updateIndicatorRange();
console.log('Internet use snapshot: '+startYear+'–'+endYear+'; '+counts.at(-1)+' areas in latest year; original values retained.');
