import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankYear,buildRankings} from '../src/indicators/rankings.ts';
import {getGDPDefinition,indicatorColors} from '../src/indicators/indicators.ts';
import {THB_CONVERSION} from '../src/indicators/thb-rate.ts';
const root=new URL('../',import.meta.url);
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const countries=JSON.parse(geometry.slice(geometry.indexOf('= ')+2).trim().replace(/;$/,''));
for(const file of ['src/population/population.json','src/indicators/gdp.json']){
 const data=JSON.parse(await readFile(new URL(file,root),'utf8'));
 const rankings=buildRankings(data,countries,data.startYear,data.endYear);
 for(const [year,rows] of rankings){
  const expected=countries.filter(c=>data.series[c.iso3]?.[year-data.startYear]!=null).sort((a,b)=>data.series[b.iso3][year-data.startYear]-data.series[a.iso3][year-data.startYear]||a.iso3.localeCompare(b.iso3));
  assert.deepEqual(rows.map(r=>r.country.iso3),expected.map(c=>c.iso3));
  assert.equal(new Set(rows.map(r=>r.country.iso3)).size,rows.length);
  rows.forEach((row,i)=>{assert.equal(row.value,data.series[row.country.iso3][year-data.startYear]);assert.equal(row.rank,i&&rows[i-1].value===row.value?rows[i-1].rank:i+1);});
  if(file.includes('gdp'))assert.deepEqual(indicatorColors(data,countries,getGDPDefinition('THB'),year),indicatorColors(data,countries,getGDPDefinition('USD'),year));
 }
 console.log(file+': rankings checked for every year, missing values excluded, raw source values preserved.');
}
const sample={startYear:2000,endYear:2000,series:{AAA:[100],BBB:[100],CCC:[0],DDD:[null]}};
const ranked=rankYear(sample,['BBB','CCC','AAA','DDD','AAA'].map((iso3,i)=>({iso3,id:String(i)})),2000);
assert.deepEqual(ranked.map(r=>[r.country.iso3,r.rank]),[['AAA',1],['BBB',1],['CCC',3]]);
assert.deepEqual(rankYear(sample,countries,1999),[]);
assert.equal(THB_CONVERSION.baseYear,2015);assert.equal(THB_CONVERSION.thbPerUsd,34.2477166666666);
const format=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
for(const value of [0,1,1234.567,6782.7505882501,1000000]){
 assert.equal(getGDPDefinition('THB').format(value),format.format(value*THB_CONVERSION.thbPerUsd));
 assert.equal(getGDPDefinition('USD').format(value),format.format(value));
}
console.log('Ties, stable ordering, duplicate areas, zero, missing years, fixed 2015 THB conversion and currency-independent map colors passed.');

