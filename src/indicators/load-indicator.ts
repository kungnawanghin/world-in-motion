import gdpUrl from './gdp.json?url';
import {loadPopulation} from '../population/load-population';
import {INDICATORS,type IndicatorId,type IndicatorData} from './indicators';
const pending:Partial<Record<IndicatorId,Promise<IndicatorData>>>={};
export function loadIndicator(id:IndicatorId):Promise<IndicatorData>{
  if(id==='population')return loadPopulation();
  return pending[id]??=(async()=>{
    const response=await fetch(gdpUrl);
    if(!response.ok)throw new Error('โหลดข้อมูล GDP ต่อหัวไม่สำเร็จ');
    const data:IndicatorData=await response.json();
    if(data.indicator!==INDICATORS.gdp.code||data.baseYear!==2015||data.unit!=='constant 2015 US$'||!data.series?.THA||data.mapYear<data.startYear||data.mapYear>data.endYear)throw new Error('ข้อมูล GDP หรือปีฐานไม่ถูกต้อง');
    return data;
  })().catch(error=>{delete pending[id];throw error;});
}
