import {populationAt,type PopulationData} from '../population/population.ts';
import type {Country} from '../../components/ui/interactive-globe-utils/surface.ts';
export type RankedCountry={country:Country;value:number;rank:number};
export function rankYear(data:PopulationData,countries:readonly Country[],year:number):RankedCountry[]{
  const seen=new Set<string>(),rows:RankedCountry[]=[];
  for(const country of countries){
    if(!country.iso3||seen.has(country.iso3))continue;
    seen.add(country.iso3);
    const value=populationAt(data,country.iso3,year);
    if(value===null||!Number.isFinite(value))continue;
    rows.push({country,value,rank:0});
  }
  rows.sort((a,b)=>b.value-a.value||(a.country.iso3<b.country.iso3?-1:a.country.iso3>b.country.iso3?1:0));
  for(let i=0;i<rows.length;i++)rows[i].rank=i>0&&rows[i].value===rows[i-1].value?rows[i-1].rank:i+1;
  return rows;
}
export function buildRankings(data:PopulationData,countries:readonly Country[],start:number,end:number){
  return new Map(Array.from({length:end-start+1},(_,i)=>[start+i,rankYear(data,countries,start+i)] as const));
}
