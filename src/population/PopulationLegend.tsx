import { NO_DATA_COLOR, POPULATION_BINS, POPULATION_SOURCE, type PopulationData } from './population';

export function PopulationLegend({data,year,error,onRetry}:{data:PopulationData|null;year:number;error:boolean;onRetry:()=>void}){
  if(!data)return <div className="population-legend" role="status">{error?<><p>โหลดข้อมูลประชากรไม่สำเร็จ</p><button onClick={onRetry}>ลองอีกครั้ง</button></>:<p>กำลังโหลดข้อมูลประชากร…</p>}</div>;
  return <aside className="population-legend" aria-label={`คำอธิบายสีประชากร ปี ${year}`}>
    <div className="population-legend-title"><strong>ประชากร · ล้านคน</strong><span>{year}</span></div>
    <ul>{POPULATION_BINS.map(bin=><li key={bin.color} title={`${bin.label}คน`}><i style={{background:bin.color}}/><span aria-hidden="true">{bin.tick}</span><span className="interactive-globe__sr-only">{bin.label}คน</span></li>)}</ul>
    <p><span className="population-legend-missing"><i style={{background:NO_DATA_COLOR}}/>ไม่มีข้อมูล</span><a href={POPULATION_SOURCE} title={`อัปเดตชุดข้อมูล ${data.sourceUpdated}`} target="_blank" rel="noreferrer">World Bank ↗</a></p>
  </aside>;
}
