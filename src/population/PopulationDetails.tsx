import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { populationAt, populationPosition, type PopulationData } from './population';
import type { PopulationClock } from './playback';
import { RollingNumber } from './RollingNumber';
import {THB_CONVERSION} from '../indicators/thb-rate';
import {INDICATORS,type IndicatorDefinition} from '../indicators/indicators';

export function PopulationDetails({data,iso3,name,year,playback,indicator=INDICATORS.population}:{data:PopulationData;iso3:string;name:string;year:number;playback:PopulationClock;indicator?:IndicatorDefinition}) {
  const [cursor,setCursor]=useState<number|null>(null);
  const playhead=useRef<SVGGElement>(null),dot=useRef<SVGCircleElement>(null);
  const series=data.series[iso3]??[];
  const points=series.map((value,i)=>({year:data.startYear+i,value}));
  const available=points.filter((p):p is {year:number;value:number}=>p.value!==null);
  const current=populationAt(data,iso3,year);
  const meterValue=current===null?'':indicator.meter(current);
  const previous=populationAt(data,iso3,year-1);
  const absoluteChange=indicator.id==='life'||indicator.id==='internet';
  const change=current!==null&&previous!==null&&(absoluteChange||previous>0)?(absoluteChange?Number((current-previous).toFixed(2)):(current/previous-1)*100):null;
  const activeYear=cursor??year;
  const active=populationAt(data,iso3,activeYear);
  const maximum=indicator.id==='internet'?100:Math.max(1,...available.map(p=>p.value))*1.08;
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
  return <section className="population-details" aria-label={`ข้อมูล${indicator.label} ${name}`}>
    <div className="population-stat"><span>{indicator.statistic} · {year}</span>
      {current!==null?<><p><strong><RollingNumber key={indicator.id+'-'+indicator.unit} value={meterValue} playback={playback}/></strong><span>{indicator.unit}</span></p><small>{indicator.id==='population'?<><RollingNumber value={indicator.format(current)} playback={playback}/> คน</>:indicator.note}</small></>:
        <p className="population-missing">ไม่มีข้อมูลปี {year}</p>}
    </div>
    {change!==null&&<p className="population-change"><span>{change>0?'+':''}{change.toFixed(2)}{indicator.id==='life'?' ปี':indicator.id==='internet'?' จุดเปอร์เซ็นต์':'%'}</span> เทียบกับปี {year-1}</p>}
    {indicator.id==='internet'&&<p className="internet-explanation">สัดส่วนประชากรที่ใช้อินเทอร์เน็ตในช่วง 3 เดือนที่ผ่านมา ผ่านอุปกรณ์ใดก็ได้ ไม่ใช่จำนวนซิมหรือความเร็วอินเทอร์เน็ต · แหล่งข้อมูล ITU ผ่าน World Bank</p>}
    {indicator.id==='life'&&<p className="life-explanation">จำนวนปีที่ทารกแรกเกิดคาดว่าจะมีชีวิต หากอัตราการตายตามอายุของปีนั้นคงเดิม ไม่ใช่อายุเฉลี่ยของผู้เสียชีวิตหรือคำทำนายอายุรายบุคคล</p>}
    {indicator.id==='gdp'&&<div className="gdp-explanation"><p><strong>GDP ต่อหัวคืออะไร?</strong> มูลค่าสินค้าและบริการที่ผลิตในประเทศต่อปี หารด้วยจำนวนประชากร ไม่ใช่เงินเดือนหรือรายได้ที่ทุกคนได้รับ</p><details><summary>ราคาและสกุลเงินที่ใช้</summary><p>ข้อมูล World Bank ปรับเงินเฟ้อเป็นดอลลาร์ราคาคงที่ปี 2015 ไม่ใช่ PPP{indicator.unit==='บาท'?' แล้วแปลงเป็นบาทด้วยอัตราเฉลี่ยปี 2015 เดียวกันทุกประเทศและทุกปี':''}</p>{indicator.unit==='บาท'&&<p>1 US$ = {THB_CONVERSION.thbPerUsd.toFixed(4)} บาท · เป็นค่าคำนวณจากข้อมูลดอลลาร์ ไม่ใช่อัตราแลกเปลี่ยนปัจจุบัน <a href={THB_CONVERSION.sourceUrl} target="_blank" rel="noreferrer">แหล่งอัตราแลกเปลี่ยน ↗</a></p>}</details></div>}
    {available.length>0?<>
      <div className="population-chart-heading"><h3>{indicator.chartTitle}</h3><span>{available[0].year}–{available.at(-1)!.year}</span></div>
      <div key={indicator.id} className="population-chart indicator-chart-enter" tabIndex={0} role="group" aria-label={`กราฟ${indicator.label}รายปี ใช้ลูกศรซ้ายขวาเพื่อดูตัวเลข หรือเปิดตารางด้านล่าง`} onKeyDown={keyboard} onBlur={()=>setCursor(null)}>
        <div className="population-chart-readout" aria-live="polite"><span>{activeYear}</span><strong>{active===null?'ไม่มีข้อมูล':`${indicator.format(active)} ${indicator.tableUnit}`}</strong></div>
        <svg viewBox="0 0 300 130" preserveAspectRatio="none" aria-hidden="true" onPointerMove={inspect} onPointerLeave={()=>setCursor(null)}>
          {[0,.5,1].map(t=><line key={t} x1="8" x2="292" y1={y(maximum*t)} y2={y(maximum*t)} stroke="#333333" strokeWidth=".7" strokeDasharray={t?'3 5':undefined}/>)}
          <text x="8" y="13">{indicator.axis(maximum)}</text><text x="8" y="125">0</text>
          {segments.map((path,i)=><path key={i} d={path} fill="none" stroke="var(--metric-accent,#e5e5e5)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>)}
          <g ref={playhead}><line x1="0" x2="0" y1="20" y2="111" stroke="var(--metric-accent,#ffffff)" strokeOpacity=".8" strokeDasharray="2 3"/><circle ref={dot} cx="0" r="4" fill="var(--metric-point,#ffffff)" stroke="#111111" strokeWidth="2"/></g>
          {cursor!==null&&active!==null&&<><line x1={x(activeYear)} x2={x(activeYear)} y1="20" y2="111" stroke="#aaaaaa" strokeOpacity=".4"/><circle cx={x(activeYear)} cy={y(active)} r="3" fill="var(--metric-point,#ffffff)" stroke="#111111" strokeWidth="2"/></>}
        </svg>
        <div className="population-chart-years"><span>{data.startYear}</span><span>{data.endYear}</span></div>
      </div>
      {current===null&&<p className="population-note">ไม่มีข้อมูลสำหรับปีที่เลือก · ช่วงที่มีข้อมูล {available[0].year}–{available.at(-1)!.year}</p>}
      <details className="population-table"><summary>ดูตัวเลขรายปี</summary><div tabIndex={0} role="region" aria-label={'ตาราง'+indicator.label+'ย้อนหลัง'}><table><caption className="interactive-globe__sr-only">{indicator.label} {name} หน่วย {indicator.tableUnit}</caption><thead><tr><th scope="col">ปี</th><th scope="col">{indicator.label} ({indicator.tableUnit})</th></tr></thead><tbody>{[...points].reverse().map(p=><tr key={p.year} aria-current={p.year===year?'date':undefined}><th scope="row">{p.year}</th><td>{p.value===null?'ไม่มีข้อมูล':indicator.format(p.value)}</td></tr>)}</tbody></table></div></details>
    </>:<p className="population-note">World Bank ยังไม่มีข้อมูล{indicator.label}ที่จับคู่กับพื้นที่นี้</p>}
    <p className="population-source"><a href={indicator.sourceUrl} target="_blank" rel="noreferrer">{indicator.id==='internet'?'ITU · World Bank':'World Bank'} · {indicator.code} ↗</a><span>{indicator.note}</span></p>
  </section>;
}
