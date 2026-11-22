import populationUrl from './population.json?url';
import type { PopulationData } from './population';

let pending:Promise<PopulationData>|undefined;
export function loadPopulation() {
  pending ??= fetch(populationUrl).then(async response => {
    if(!response.ok)throw new Error('โหลดข้อมูลประชากรไม่สำเร็จ');
    const data:PopulationData=await response.json();
    if(data.indicator!=='SP.POP.TOTL'||!data.series?.THA||data.mapYear<data.startYear||data.mapYear>data.endYear)
      throw new Error('รูปแบบข้อมูลประชากรไม่ถูกต้อง');
    return data;
  }).catch(error=>{pending=undefined;throw error;});
  return pending;
}
