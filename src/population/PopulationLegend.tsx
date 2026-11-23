import {NO_DATA_COLOR,type PopulationData} from './population';
import {INDICATORS,type IndicatorDefinition} from '../indicators/indicators';
export function PopulationLegend({data,year,error,onRetry,indicator=INDICATORS.population}:{data:PopulationData|null;year:number;error:boolean;onRetry:()=>void;indicator?:IndicatorDefinition}){
  if(!data)return <div className="population-legend" role="status">{error?<><p>โหลดข้อมูล{indicator.label}ไม่สำเร็จ</p><button onClick={onRetry}>ลองอีกครั้ง</button></>:<p>กำลังโหลดข้อมูล{indicator.label}…</p>}</div>;
  return <aside className="population-legend" aria-label={`คำอธิบายสี${indicator.label} ปี ${year}`}>
    <div className="population-legend-title"><strong>{indicator.legendTitle}</strong><span>{year}</span></div>
    <ul>{indicator.bins.map(bin=><li key={bin.color} title={`${bin.label}${indicator.id==='population'?'คน':indicator.id==='gdp'?' ต่อคน (ราคาปี 2015)':''}`}><i style={{background:bin.color}}/><span aria-hidden="true">{bin.tick}</span><span className="interactive-globe__sr-only">{bin.label}</span></li>)}</ul>
    {indicator.id==='gdp'&&<div className="indicator-legend-unit">ราคาคงที่ปี 2015 · ปรับเงินเฟ้อแล้ว</div>}
    <p><span className="population-legend-missing"><i style={{background:NO_DATA_COLOR}}/>ไม่มีข้อมูล</span><a href={indicator.sourceUrl} title={`อัปเดตชุดข้อมูล ${data.sourceUpdated}`} target="_blank" rel="noreferrer">World Bank ↗</a></p>
  </aside>;
}
