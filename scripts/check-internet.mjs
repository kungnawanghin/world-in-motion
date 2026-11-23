import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INDICATORS,INTERNET_BINS,indicatorColor,indicatorColors} from '../src/indicators/indicators.ts';
import {populationAt,populationPosition,NO_DATA_COLOR} from '../src/population/population.ts';
import {rankYear} from '../src/indicators/rankings.ts';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('src/indicators/internet.json',root),'utf8'));
const range=JSON.parse(await readFile(new URL('src/indicators/range.json',root),'utf8'));
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const countries=JSON.parse(geometry.slice(geometry.indexOf('= ')+2).trim().replace(/;$/,''));
const codes=new Set(countries.map(c=>c.iso3).filter(Boolean));
assert.equal(data.indicator,'IT.NET.USER.ZS');assert.equal(data.unit,'% of population');assert.equal(data.startYear,1990);assert(data.definition.includes('3 months'));
for(const [code,series] of Object.entries(data.series)){assert(codes.has(code));assert.equal(series.length,data.endYear-data.startYear+1);assert(series.every(v=>v===null||Number.isFinite(v)&&v>=0&&v<=100));}
assert.equal(indicatorColor(0,INDICATORS.internet),INTERNET_BINS[0].color);
assert.equal(indicatorColor(100,INDICATORS.internet),INTERNET_BINS.at(-1).color);
assert.equal(indicatorColor(null,INDICATORS.internet),NO_DATA_COLOR);
for(let i=0;i<INTERNET_BINS.length-1;i++){assert.equal(indicatorColor(INTERNET_BINS[i].below-.001,INDICATORS.internet),INTERNET_BINS[i].color);assert.equal(indicatorColor(INTERNET_BINS[i].below,INDICATORS.internet),INTERNET_BINS[i+1].color);}
for(let year=range.startYear;year<=range.endYear;year++){
 const frame=indicatorColors(data,countries,INDICATORS.internet,year);
 for(const country of countries){const value=populationAt(data,country.iso3,year),i=country.index*4;assert.equal('#'+Buffer.from(frame.slice(i,i+3)).toString('hex'),indicatorColor(value,INDICATORS.internet).toLowerCase());assert.equal(frame[i+3],value===null?0:255);}
}
assert.equal(rankYear(data,countries,1989).length,0);
assert.equal(populationAt(data,'THA',1989),null);
assert.equal(populationPosition({startYear:2000,series:{TST:[0,10,null]}},'TST',2000.5),5);
assert.equal(populationPosition({startYear:2000,series:{TST:[0,10,null]}},'TST',2001.5),null);
assert.equal(INDICATORS.internet.format(78.123456),'78.12');assert.equal(INDICATORS.internet.format(0),'0.00');
if(process.argv[2]){const [meta,rows]=JSON.parse(await readFile(process.argv[2],'utf8'));assert.equal(meta.lastupdated,data.sourceUpdated);let checked=0;
 for(const row of rows){if(!codes.has(row.countryiso3code)||+row.date<data.startYear)continue;assert.equal(populationAt(data,row.countryiso3code,+row.date),row.value);checked++;}
 console.log(checked+' original API observations matched, including zeros and missing values.');}
console.log('Internet checks passed: ITU definition, 0–100% bounds, every color frame, thresholds, missing years, interpolation, and precision.');
console.log({start:data.startYear,end:data.endYear,mapYear:data.mapYear,areas2024:rankYear(data,countries,2024).length,areas2025:rankYear(data,countries,2025).length,THA2024:populationAt(data,'THA',2024)});
