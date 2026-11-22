import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { compactPopulation, formatPopulation, populationAt, populationPosition, POPULATION_SOURCE, type PopulationData } from './population';
import type { PopulationClock } from './playback';
import { RollingNumber } from './RollingNumber';

export function PopulationDetails({data,iso3,name,year,playback}:{data:PopulationData;iso3:string;name:string;year:number;playback:PopulationClock}) {
  const [cursor,setCursor]=useState<number|null>(null);
  const playhead=useRef<SVGGElement>(null),dot=useRef<SVGCircleElement>(null);
  const series=data.series[iso3]??[];
  const points=series.map((value,i)=>({year:data.startYear+i,value}));
  const available=points.filter((p):p is {year:number;value:number}=>p.value!==null);
  const current=populationAt(data,iso3,year);
  const meterValue=current===null?'':current>=1e9?`${(current/1e9).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} พันล้าน`:current>=1e6?`${(current/1e6).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})} ล้าน`:formatPopulation(current);
  const previous=populationAt(data,iso3,year-1);
  const change=current!==null&&previous!==null&&previous>0?(current/previous-1)*100:null;
  const activeYear=cursor??year;
  const active=populationAt(data,iso3,activeYear);
  const maximum=Math.max(1,...available.map(p=>p.value))*1.08;
  const x=(year:number)=>8+(year-data.startYear)/Math.max(1,data.endYear-data.startYear)*284;
  const y=(value:number)=>111-value/maximum*91;
  useLayoutEffect(()=>playback.subscribe(frame=>{
    const value=populationPosition(data,iso3,frame.position);
    playhead.current?.setAttribute('transform',`translate(${8+(frame.position-data.startYear)/Math.max(1,data.endYear-data.startYear)*284} 0)`);
    playhead.current?.setAttribute('data-clock-position',String(frame.position));
    if(dot.current){dot.current.style.visibility=value===null?'hidden':'visible';if(value!==null)dot.current.setAttribute('cy',String(111-value/maximum*91));}
  }),[playback,data,iso3,maximum]);
  const segments:string[]=[];
  let segment='';
  for(const point of points){
    if(point.value===null){if(segment)segments.push(segment);segment='';continue;}
    segment+=`${segment?' L':'M'} ${x(point.year).toFixed(2)} ${y(point.value).toFixed(2)}`;
  }
  if(segment)segments.push(segment);
  function inspect(event:PointerEvent<SVGSVGElement>){
    const rect=event.currentTarget.getBoundingClientRect();
    const fraction=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*300-8)/284));
    setCursor(Math.round(data.startYear+fraction*(data.endYear-data.startYear)));
  }
  function keyboard(event:KeyboardEvent<HTMLDivElement>){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    setCursor(event.key==='Home'?data.startYear:event.key==='End'?data.endYear:
      Math.max(data.startYear,Math.min(data.endYear,activeYear+(event.key==='ArrowLeft'?-1:1))));
  }
  return <section className="population-details" aria-label={`ข้อมูลประชากร ${name}`}>
    <div className="population-stat"><span>ประชากรทั้งหมด · {year}</span>
      {current!==null?<><p><strong><RollingNumber value={meterValue} playback={playback}/></strong><span>คน</span></p><small><RollingNumber value={formatPopulation(current)} playback={playback}/> คน</small></>:
        <p className="population-missing">ไม่มีข้อมูลปี {year}</p>}
    </div>
    {change!==null&&<p className="population-change"><span>{change>0?'+':''}{change.toFixed(2)}%</span> เทียบกับปี {year-1}</p>}
    {available.length>0?<>
      <div className="population-chart-heading"><h3>ประชากรย้อนหลัง</h3><span>{available[0].year}–{available.at(-1)!.year}</span></div>
      <div className="population-chart" tabIndex={0} role="group" aria-label="กราฟประชากรรายปี ใช้ลูกศรซ้ายขวาเพื่อดูตัวเลข หรือเปิดตารางด้านล่าง" onKeyDown={keyboard} onBlur={()=>setCursor(null)}>
        <div className="population-chart-readout" aria-live="polite"><span>{activeYear}</span><strong>{active===null?'ไม่มีข้อมูล':`${formatPopulation(active)} คน`}</strong></div>
        <svg viewBox="0 0 300 130" preserveAspectRatio="none" aria-hidden="true" onPointerMove={inspect} onPointerLeave={()=>setCursor(null)}>
          {[0,.5,1].map(t=><line key={t} x1="8" x2="292" y1={y(maximum*t)} y2={y(maximum*t)} stroke="#333333" strokeWidth=".7" strokeDasharray={t?'3 5':undefined}/>)}
          <text x="8" y="13">{compactPopulation(maximum)}</text><text x="8" y="125">0</text>
          {segments.map((path,i)=><path key={i} d={path} fill="none" stroke="#e5e5e5" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>)}
          <g ref={playhead}><line x1="0" x2="0" y1="20" y2="111" stroke="#ffffff" strokeOpacity=".8" strokeDasharray="2 3"/><circle ref={dot} cx="0" r="4" fill="#ffffff" stroke="#111111" strokeWidth="2"/></g>
          {cursor!==null&&active!==null&&<><line x1={x(activeYear)} x2={x(activeYear)} y1="20" y2="111" stroke="#aaaaaa" strokeOpacity=".4"/><circle cx={x(activeYear)} cy={y(active)} r="3" fill="#ffffff" stroke="#111111" strokeWidth="2"/></>}
        </svg>
        <div className="population-chart-years"><span>{data.startYear}</span><span>{data.endYear}</span></div>
      </div>
      {current===null&&<p className="population-note">ไม่มีข้อมูลสำหรับปีที่เลือก · ช่วงที่มีข้อมูล {available[0].year}–{available.at(-1)!.year}</p>}
      <details className="population-table"><summary>ดูตัวเลขรายปี</summary><div tabIndex={0} role="region" aria-label="ตารางประชากรย้อนหลัง"><table><caption className="interactive-globe__sr-only">ประชากร {name} หน่วยคน</caption><thead><tr><th scope="col">ปี</th><th scope="col">ประชากร (คน)</th></tr></thead><tbody>{[...points].reverse().map(p=><tr key={p.year} aria-current={p.year===year?'date':undefined}><th scope="row">{p.year}</th><td>{p.value===null?'ไม่มีข้อมูล':formatPopulation(p.value)}</td></tr>)}</tbody></table></div></details>
    </>:<p className="population-note">World Bank ยังไม่มีข้อมูลประชากรที่จับคู่กับพื้นที่นี้</p>}
    <p className="population-source"><a href={POPULATION_SOURCE} target="_blank" rel="noreferrer">World Bank · SP.POP.TOTL ↗</a><span>ค่าประมาณประชากรกลางปี</span></p>
  </section>;
}
