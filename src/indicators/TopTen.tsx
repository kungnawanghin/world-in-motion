import {useId,useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {Country} from '../../components/ui/interactive-globe-utils/surface';
import type {PopulationClock} from '../population/playback';
import type {IndicatorDefinition} from './indicators';
import type {RankedCountry} from './rankings';
import './rankings.css';

export function TopTen({rankings,year,indicator,selected,onSelect,playback}:{
  rankings:ReadonlyMap<number,RankedCountry[]>;year:number;indicator:IndicatorDefinition;selected:Country|null;onSelect:(id:string)=>void;playback:PopulationClock;
}){
  const [expanded,setExpanded]=useState(()=>!matchMedia('(max-width:700px)').matches);
  const root=useRef<HTMLElement>(null),contentId=useId();
  const rows=rankings.get(year)??[],top=rows.slice(0,10);
  const current=new Map(rows.map(row=>[row.country.id,row]));
  const slots=new Map(top.map((row,index)=>[row.country.id,index]));
  const pool=useMemo(()=>{
    const countries=new Map<string,Country>();
    for(const entries of rankings.values())for(const entry of entries.slice(0,10))countries.set(entry.country.id,entry.country);
    return [...countries.values()];
  },[rankings]);
  const selectedEntry=selected?current.get(selected.id):undefined;
  useLayoutEffect(()=>{
    let wasPlaying=playback.getFrame().playing,reset=0;
    const unsubscribe=playback.subscribe(frame=>{
      if(wasPlaying&&!frame.playing&&root.current){
        root.current.dataset.snap='true';
        root.current.getAnimations({subtree:true}).forEach(animation=>animation.finish());
        if(reset)cancelAnimationFrame(reset);
        reset=requestAnimationFrame(()=>{if(root.current)delete root.current.dataset.snap;});
      }
      wasPlaying=frame.playing;
    });
    return()=>{unsubscribe();if(reset)cancelAnimationFrame(reset);};
  },[playback]);
  function select(id:string){onSelect(id);if(matchMedia('(max-width:700px)').matches)setExpanded(false);}
  return <aside ref={root} className="ranking-panel" data-year={year} aria-label={'Top 10 '+indicator.label}>
    <button type="button" className="ranking-heading" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpanded(open=>!open)}>
      <span><strong>TOP 10</strong><span>{indicator.label}</span></span><span className="ranking-collapse" aria-hidden="true">{expanded?'−':'+'}</span>
    </button>
    {expanded&&<div id={contentId} className="ranking-content">
      <p className="ranking-scope" title="รวมประเทศและดินแดนที่จับคู่แผนที่และมีข้อมูลปีนั้น ค่าเท่ากันใช้อันดับร่วม เรียงรหัส ISO3 เมื่อเสมอ เลือกแสดงสิบพื้นที่แรก"><span>ประเทศและดินแดน · {year}</span><span>{indicator.tableUnit}</span></p>
      {top.length?<div className="ranking-scroll"><ol className="ranking-list" aria-label={'สิบอันดับ '+indicator.label+' ปี '+year}>
        {[...pool].sort((a,b)=>(slots.get(a.id)??11)-(slots.get(b.id)??11)||(a.id<b.id?-1:1)).map(country=>{
          const slot=slots.get(country.id),active=slot!==undefined,entry=current.get(country.id);
          const width=entry&&top[0]?.value>0?Math.max(0,Math.min(100,entry.value/top[0].value*100)):0;
          return <li key={country.id} className={'ranking-slot'+(active?' is-active':'')} aria-hidden={!active} data-country-id={country.id} data-rank={active?entry?.rank:undefined} style={{'--rank-slot':slot??10} as CSSProperties}>
            <button type="button" className={'ranking-row'+(selected?.id===country.id?' is-selected':'')} disabled={!active} tabIndex={active?0:-1} aria-current={selected?.id===country.id?'true':undefined} onClick={()=>select(country.id)} aria-label={active&&entry?'อันดับ '+entry.rank+' '+country.name+' '+indicator.format(entry.value)+' '+indicator.tableUnit:undefined} title={entry?country.name+' · '+indicator.format(entry.value)+' '+indicator.tableUnit:country.name}>
              <span className="ranking-bar" style={{width:width+'%'}} aria-hidden="true"/>
              <span className="ranking-number">{entry?.rank??'–'}</span><span className="ranking-name">{country.name}</span><span className="ranking-value">{entry?indicator.format(entry.value):'–'}</span>
            </button>
          </li>;
        })}
      </ol></div>:<p className="ranking-empty">ไม่มีข้อมูลสำหรับจัดอันดับปีนี้</p>}
      <p className="ranking-coverage">จาก {rows.length} พื้นที่ที่มีข้อมูลในปีนี้</p>
      {selected&&!slots.has(selected.id)&&<div className="ranking-selected"><span>ประเทศที่เลือก</span><button type="button" onClick={()=>select(selected.id)}><span>{selected.name}</span><strong>{selectedEntry?'อันดับ '+selectedEntry.rank:'ไม่มีข้อมูลปี '+year}</strong></button>{selectedEntry&&<p>{indicator.format(selectedEntry.value)} {indicator.tableUnit}</p>}</div>}
    </div>}
  </aside>;
}
