import gdpUrl from './gdp.json?url';
import lifeUrl from './life.json?url';
import internetUrl from './internet.json?url';
import {loadPopulation} from '../population/load-population';
import {INDICATORS,type IndicatorId,type IndicatorData} from './indicators';
const pending:Partial<Record<IndicatorId,Promise<IndicatorData>>>={};
const urls={gdp:gdpUrl,life:lifeUrl,internet:internetUrl};
export function loadIndicator(id:IndicatorId):Promise<IndicatorData>{
  if(id==='population')return loadPopulation();
  return pending[id]??=(async()=>{
    const response=await fetch(urls[id]);
    if(!response.ok)throw new Error('โหลดข้อมูล'+INDICATORS[id].label+'ไม่สำเร็จ');
    const data:IndicatorData=await response.json();
    if(data.indicator!==INDICATORS[id].code||!data.series?.THA||data.mapYear<data.startYear||data.mapYear>data.endYear)throw new Error('ข้อมูลตัวชี้วัดไม่ถูกต้อง');
    if(id==='gdp'&&(data.baseYear!==2015||data.unit!=='constant 2015 US$'))throw new Error('ข้อมูล GDP หรือปีฐานไม่ถูกต้อง');
    if(id==='life'&&data.unit!=='years')throw new Error('หน่วยอายุคาดเฉลี่ยไม่ถูกต้อง');
    if(id==='internet'&&data.unit!=='% of population')throw new Error('หน่วยสัดส่วนผู้ใช้อินเทอร์เน็ตไม่ถูกต้อง');
    return data;
  })().catch(error=>{delete pending[id];throw error;});
}
