import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INDICATORS,LIFE_BINS,indicatorColor,indicatorColors} from '../src/indicators/indicators.ts';
import {populationAt,populationPosition,NO_DATA_COLOR} from '../src/population/population.ts';
import {buildRankings} from '../src/indicators/rankings.ts';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('src/indicators/life.json',root),'utf8'));
const range=JSON.parse(await readFile(new URL('src/indicators/range.json',root),'utf8'));
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const countries=JSON.parse(geometry.slice(geometry.indexOf('= ')+2).trim().replace(/;$/,''));
const codes=new Set(countries.map(c=>c.iso3));
assert.equal(data.indicator,'SP.DYN.LE00.IN');assert.equal(data.unit,'years');assert.equal(data.startYear,1960);
assert(data.endYear>=2023&&data.mapYear<=data.endYear);
assert(data.definition.includes('newborn'));
assert(range.startYear<=data.startYear&&range.endYear>=data.endYear);
for(const [code,series] of Object.entries(data.series)){
 assert(codes.has(code));assert.equal(series.length,data.endYear-data.startYear+1);
 assert(series.every(v=>v===null||Number.isFinite(v)&&v>0&&v<=130));
}
for(let i=0;i<LIFE_BINS.length-1;i++){
 assert.equal(indicatorColor(LIFE_BINS[i].below-.001,INDICATORS.life),LIFE_BINS[i].color);
 assert.equal(indicatorColor(LIFE_BINS[i].below,INDICATORS.life),LIFE_BINS[i+1].color);
}
assert.equal(indicatorColor(null,INDICATORS.life),NO_DATA_COLOR);
for(let year=range.startYear;year<=range.endYear;year++){
 const frame=indicatorColors(data,countries,INDICATORS.life,year);
 for(const country of countries){
  const value=populationAt(data,country.iso3,year),i=country.index*4;
  assert.equal('#'+Buffer.from(frame.slice(i,i+3)).toString('hex'),indicatorColor(value,INDICATORS.life).toLowerCase());
  assert.equal(frame[i+3],value===null?0:255);
 }
}
assert.equal(INDICATORS.life.format(76.54321),'76.54');
assert.equal(populationAt(data,'THA',data.endYear+1),null);
assert.equal(buildRankings(data,countries,data.endYear+1,data.endYear+1).get(data.endYear+1).length,0);
assert.equal(populationPosition(data,'THA',data.endYear+.5),null);
if(process.argv[2]){
 const [meta,rows]=JSON.parse(await readFile(process.argv[2],'utf8'));assert.equal(data.sourceUpdated,meta.lastupdated);let checked=0;
 for(const row of rows){
  if(!row.countryiso3code||!codes.has(row.countryiso3code)||+row.date<data.startYear)continue;
  assert.equal(populationAt(data,row.countryiso3code,+row.date),row.value);
  checked++;
 }
 console.log(checked+' observations matched the World Bank API response exactly, including missing years.');
}
console.log('Life expectancy checks passed: definition, units, every historical color frame, threshold boundaries, rankings beyond available years, and formatting.');
