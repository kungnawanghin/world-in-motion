import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { populationAt, populationColor, populationColors, POPULATION_BINS, NO_DATA_COLOR } from '../src/population/population.ts';

const root=new URL('../',import.meta.url);
const data=JSON.parse(await readFile(new URL('src/population/population.json',root),'utf8'));
const geometry=await readFile(new URL('components/ui/interactive-globe-utils/countries.ts',root),'utf8');
const countries=JSON.parse(geometry.slice(geometry.indexOf('= ')+2).trim().replace(/;$/,''));
assert.equal(populationColor(null),NO_DATA_COLOR);
assert.equal(populationColor(0),POPULATION_BINS[0].color);
for(let i=0;i<POPULATION_BINS.length-1;i++){
  assert.equal(populationColor(POPULATION_BINS[i].below-1),POPULATION_BINS[i].color);
  assert.equal(populationColor(POPULATION_BINS[i].below),POPULATION_BINS[i+1].color);
}
assert.equal(populationAt(data,'NOT_A_COUNTRY'),null);
assert.equal(populationAt(data,'THA',data.startYear-1),null);
assert.equal(populationAt(data,'THA',data.endYear+1),null);
assert(data.mapYear>=data.startYear&&data.mapYear<=data.endYear);
const mappedCodes=new Set(countries.map(c=>c.iso3).filter(Boolean));
for(const [iso3,series] of Object.entries(data.series)){
  assert(mappedCodes.has(iso3),`Aggregate or unmatched code: ${iso3}`);
  assert.equal(series.length,data.endYear-data.startYear+1);
  assert(series.every(n=>n===null||Number.isSafeInteger(n)&&n>=0));
}
const colors=populationColors(data,countries);
assert.equal(colors.length,1024);
for(const country of countries){
  const color=populationColor(populationAt(data,country.iso3));
  assert.equal('#'+Buffer.from(colors.slice(country.index*4,country.index*4+3)).toString('hex'),color);
}
// Historical frames must use their own year, including missing observations.
for(let year=data.startYear;year<=data.endYear;year++){
  const frame=populationColors(data,countries,year);
  for(const country of countries){
    const rawValue=data.series[country.iso3]?.[year-data.startYear]??null;
    const expected=populationColor(rawValue);
    assert.equal('#'+Buffer.from(frame.slice(country.index*4,country.index*4+3)).toString('hex'),expected,`${country.iso3} ${year}`);
    assert.equal(frame[country.index*4+3],rawValue===null?0:255,'missing values must not be blended as real observations');
  }
}
assert.notDeepEqual(populationColors(data,countries,data.startYear),populationColors(data,countries,data.endYear));
// Optionally compare every stored observation with the original API response.
if(process.argv[2]){
  const [meta,rows]=JSON.parse(await readFile(process.argv[2],'utf8'));
  assert.equal(meta.lastupdated,data.sourceUpdated);
  let checked=0;
  for(const row of rows){
    if(!data.series[row.countryiso3code]||+row.date<data.startYear||+row.date>data.endYear)continue;
    assert.equal(populationAt(data,row.countryiso3code,+row.date),row.value);checked++;
  }
  assert.equal(checked,Object.keys(data.series).length*(data.endYear-data.startYear+1));
  console.log(`${checked} observations match the World Bank response.`);
}
console.log(`Population checks passed: ${Object.keys(data.series).length} series, ${countries.length} geographic areas, color thresholds and missing values.`);
