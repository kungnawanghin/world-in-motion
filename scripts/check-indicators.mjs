import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INDICATORS,GDP_BINS,indicatorColor,indicatorColors} from '../src/indicators/indicators.ts';
import {populationAt,populationPosition,NO_DATA_COLOR} from '../src/population/population.ts';
const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('src/indicators/gdp.json',root),'utf8'));
const population=JSON.parse(await readFile(new URL('src/population/population.json',root),'utf8'));
const range=JSON.parse(await readFile(new URL('src/indicators/range.json',root),'utf8'));
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const countries=JSON.parse(geometry.slice(geometry.indexOf('= ')+2).trim().replace(/;$/,''));
assert.equal(data.indicator,'NY.GDP.PCAP.KD');assert.equal(data.baseYear,2015);assert.equal(data.unit,'constant 2015 US$');
assert.equal(range.startYear,Math.min(data.startYear,population.startYear));assert.equal(range.endYear,Math.max(data.endYear,population.endYear));
const codes=new Set(countries.map(c=>c.iso3));
for(const [code,series] of Object.entries(data.series)){assert(codes.has(code));assert.equal(series.length,data.endYear-data.startYear+1);assert(series.every(v=>v===null||Number.isFinite(v)&&v>=0));}
assert.equal(indicatorColor(null,INDICATORS.gdp),NO_DATA_COLOR);assert.equal(indicatorColor(0,INDICATORS.gdp),GDP_BINS[0].color);
for(let i=0;i<GDP_BINS.length-1;i++){assert.equal(indicatorColor(GDP_BINS[i].below-.01,INDICATORS.gdp),GDP_BINS[i].color);assert.equal(indicatorColor(GDP_BINS[i].below,INDICATORS.gdp),GDP_BINS[i+1].color);}
for(let year=range.startYear;year<=range.endYear;year++){
  const frame=indicatorColors(data,countries,INDICATORS.gdp,year);
  for(const country of countries){const value=data.series[country.iso3]?.[year-data.startYear]??null;assert.equal(populationAt(data,country.iso3,year),value);assert.equal('#'+Buffer.from(frame.slice(country.index*4,country.index*4+3)).toString('hex'),indicatorColor(value,INDICATORS.gdp));assert.equal(frame[country.index*4+3],value===null?0:255);}
}
assert.equal(populationAt(data,'NOT_A_COUNTRY',2025),null);assert.equal(populationAt(data,'THA',1959),null);assert.equal(populationAt(data,'THA',2025.2),null);
assert.equal(INDICATORS.gdp.format(1234.567),'1,234.57');
const gap={startYear:1960,mapYear:1962,series:{TST:[1.25,null,3.75]}};
assert.equal(populationPosition(gap,'TST',1960.5),null);
if(process.argv[2]){
  const [meta,rows]=JSON.parse(await readFile(process.argv[2],'utf8'));assert.equal(meta.lastupdated,data.sourceUpdated);let checked=0;
  for(const row of rows){if(!data.series[row.countryiso3code]||+row.date<data.startYear||+row.date>data.endYear)continue;assert.equal(populationAt(data,row.countryiso3code,+row.date),row.value);checked++;}
  assert.equal(checked,Object.keys(data.series).length*(data.endYear-data.startYear+1));console.log(checked+' GDP observations match the original API response, without rounding.');
}
console.log('GDP checks passed: real constant-2015 USD data, all historical color frames, missing values, shared year range, and currency formatting.');
