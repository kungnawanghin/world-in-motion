import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { InteractiveGlobe, COUNTRIES, type Country, type GlobeTheme, type InteractiveGlobeHandle } from '@/components/ui/interactive-globe';
import { SpaceBackdrop } from '@/components/ui/space-backdrop';
import './src/space.css';
import { INDICATORS,indicatorColors,getGDPDefinition,type GDPCurrency,type IndicatorId,type IndicatorData } from './src/indicators/indicators';
import { loadIndicator } from './src/indicators/load-indicator';
import {buildRankings} from './src/indicators/rankings';
import {IndicatorSwitcher} from './src/indicators/IndicatorSwitcher';
import {TopTen} from './src/indicators/TopTen';
import range from './src/indicators/range.json';
import { PopulationDetails } from './src/population/PopulationDetails';
import { PopulationLegend } from './src/population/PopulationLegend';
import { PopulationTimeline } from './src/population/PopulationTimeline';
import { createPopulationClock } from './src/population/playback';
import './src/population/population.css';
import './src/indicators/indicators.css';

const countries=[...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name,'th'));
const SPACE_THEME:GlobeTheme={ground:'#03060c',land:'#666666',arc:'#f5f5f5',glow:'#559bd0',text:'#f2f2f2',muted:'#999999'};
const GLOBE_STYLE:CSSProperties={background:'transparent'};
type Phase='intro'|'entering'|'main';
type Layer='world'|IndicatorId;

export default function Demo(){
  const globe=useRef<InteractiveGlobeHandle>(null),heading=useRef<HTMLHeadingElement>(null);
  const [selected,setSelected]=useState<Country|null>(null);
  const [motion,setMotion]=useState<'full'|'reduced'>('full');
  const [phase,setPhase]=useState<Phase>('intro');
  const [ready,setReady]=useState(false);
  const [datasets,setDatasets]=useState<Partial<Record<IndicatorId,IndicatorData>>>({});
  const [errors,setErrors]=useState<Partial<Record<IndicatorId,boolean>>>({});
  const [attempt,setAttempt]=useState(0);
  const [layer,setLayer]=useState<Layer>('world');
  const [year,setYear]=useState(range.defaultYear);
  // The same clock survives data loads and every view switch, including fractional position.
  const playback=useMemo(()=>createPopulationClock(range.startYear,range.endYear,range.defaultYear,setYear),[]);
  const [currency,setCurrency]=useState<GDPCurrency>('THB');
  const gdpDefinition=useMemo(()=>getGDPDefinition(currency),[currency]);
  const indicator=layer==='gdp'?gdpDefinition:INDICATORS[layer==='world'?'population':layer];
  const rankingCache=useMemo(()=>{
    const result:Partial<Record<IndicatorId,ReturnType<typeof buildRankings>>>={};
    for(const id of ['population','gdp','life','internet'] as const){const dataset=datasets[id];if(dataset)result[id]=buildRankings(dataset,COUNTRIES,range.startYear,range.endYear);}
    return result;
  },[datasets]);
  const rankings=layer==='world'?undefined:rankingCache[layer];
  const data=layer==='world'?null:datasets[layer]??null;
  const colorCache=useMemo(()=>{
    const result:Partial<Record<IndicatorId,Uint8Array[]>>={};
    for(const id of ['population','gdp','life','internet'] as const){const dataset=datasets[id];if(dataset)result[id]=Array.from({length:range.endYear-range.startYear+1},(_,i)=>indicatorColors(dataset,COUNTRIES,INDICATORS[id],range.startYear+i));}
    return result;
  },[datasets]);
  const frames=layer==='world'?undefined:colorCache[layer];
  const colors=frames?.[0];
  useEffect(()=>()=>playback.dispose(),[playback]);
  useEffect(()=>{
    if(phase!=='main'||layer==='world'||!frames){playback.pause();return;}
    return playback.subscribe(frame=>globe.current?.setCountryColorFrame(frames[frame.year-range.startYear],frames[frame.nextYear-range.startYear],frame.mix,frame.playing));
  },[playback,frames,phase,layer]);
  const finishEntrance=useCallback(()=>setPhase('main'),[]);
  const handleReady=useCallback(()=>setReady(true),[]);
  useEffect(()=>{if(phase==='main')heading.current?.focus({preventScroll:true});},[phase]);
  useEffect(()=>{
    if(phase!=='main'||layer==='world'||data)return;
    const id=layer;let cancelled=false;
    setErrors(current=>({...current,[id]:false}));
    loadIndicator(id).then(result=>{if(!cancelled)setDatasets(current=>({...current,[id]:result}));}).catch(()=>{if(!cancelled)setErrors(current=>({...current,[id]:true}));});
    return()=>{cancelled=true;};
  },[phase,layer,data,attempt]);
  const retry=()=>setAttempt(n=>n+1);
  const chooseLayer=(next:Layer)=>{if(next===layer)return;playback.pause();setLayer(next);};
  const dataError=layer!=='world'&&!!errors[layer];
  return <main className="space-app" data-phase={phase} data-motion={motion} data-layer={layer} style={{'--metric-accent':indicator.accent} as CSSProperties}>
    <SpaceBackdrop motion={motion}/>
    <div className="space-globe-stage" inert={phase!=='main'}>
      <InteractiveGlobe ref={globe} theme={SPACE_THEME} style={GLOBE_STYLE} motion={motion} countryColors={colors} renderCountryDetails={layer!=='world'?country=>data?<PopulationDetails data={data} iso3={country.iso3} name={country.name} year={year} playback={playback} indicator={indicator}/>:<div className="population-details" role="status">{dataError?<><p>โหลดข้อมูล{indicator.label}ไม่สำเร็จ</p><button onClick={retry}>ลองอีกครั้ง</button></>:<p>กำลังโหลดข้อมูล{indicator.label}…</p>}</div>:undefined} presentation={phase==='intro'?'intro':'explore'} onReady={handleReady} onEnterComplete={finishEntrance} onSelect={setSelected}/>
    </div>
    {phase!=='main'&&<section className="launch-screen" aria-label="หน้าเปิด World in Motion">
      <div className="launch-shade"/><div className="launch-content">
        <h1 className="launch-title"><span>WORLD</span><span>IN MOTION</span></h1>
        <div className="launch-action"><button type="button" className="launch-start" disabled={!ready||phase==='entering'} onClick={()=>{if(ready&&phase==='intro')setPhase('entering');}}>{!ready?'กำลังเตรียมโลก…':'เริ่มสำรวจ'}<span aria-hidden="true">↗</span></button></div>
      </div><span className="launch-bottom">โลกใบเดียวกัน มีเรื่องราวอีกมากมาย</span>
    </section>}
    {phase==='main'&&<>
      <header className="space-header space-controls"><div>
        <button type="button" className="space-wordmark" onClick={()=>setPhase('intro')} title="กลับหน้าเปิด">WORLD IN MOTION<span aria-hidden="true">.</span></button>
        <h1 key={layer} className="space-view-title" ref={heading} tabIndex={-1}>{layer==='world'?'แผนที่โลก':indicator.title}{layer!=='world'&&data&&<span className="population-year">{year}</span>}</h1>
        <p key={`${layer}-description`} className="space-view-description">{layer==='world'?'หมุนโลกแล้วคลิกประเทศเพื่อสำรวจ':layer==='gdp'?'ปรับเงินเฟ้อแล้ว · '+indicator.tableUnit+' · ราคาปี 2015':(layer==='life'||layer==='internet')?(data&&year>data.endYear?'ยังไม่มีข้อมูลปี '+year+' · ข้อมูลล่าสุด '+data.endYear:layer==='internet'?(data&&year===data.endYear&&year>data.mapYear?'ข้อมูลปี '+year+' ยังไม่ครบ · '+(rankings?.get(year)?.length??0)+' พื้นที่':'สัดส่วนประชากรที่ใช้อินเทอร์เน็ต · ITU'):'อายุคาดเฉลี่ยเมื่อแรกเกิด · รวมทุกเพศ'):'คลิกประเทศเพื่อดูจำนวนคนและกราฟย้อนหลัง'}</p>
        <div className="space-data-options"><IndicatorSwitcher layer={layer} onSelect={chooseLayer}/>{layer==='gdp'&&<div className="currency-switch" role="group" aria-label="เลือกสกุลเงิน">{(['THB','USD'] as const).map(unit=><button key={unit} type="button" aria-pressed={currency===unit} onClick={()=>setCurrency(unit)}>{unit==='THB'?'฿ THB':'$ USD'}</button>)}</div>}</div>
      </div><button type="button" className="space-motion" aria-pressed={motion==='reduced'} onClick={()=>setMotion(current=>current==='full'?'reduced':'full')}>{motion==='full'?'หยุดหมุน':'เปิดการหมุน'}<span className={motion==='full'?'is-moving':''} aria-hidden="true"/></button></header>
      {rankings&&<TopTen rankings={rankings} year={year} indicator={indicator} selected={selected} onSelect={id=>globe.current?.selectCountry(id)} playback={playback}/>}
      <footer className={`space-footer space-controls${layer!=='world'?' space-footer--population':''}`}>
        {layer!=='world'?<PopulationLegend data={data} year={year} error={dataError} onRetry={retry} indicator={indicator}/>:<div className="space-selection"><span>{selected?'ประเทศที่เลือก':'สำรวจประเทศทั่วโลก'}</span><h2>{selected?.name??'โลกใบเดียวกัน'}</h2></div>}
        <div className="space-country-control"><label><span>ไปที่ประเทศ</span><select aria-label="ไปที่ประเทศ" value={selected?.id??''} onChange={e=>globe.current?.selectCountry(e.target.value)}><option value="" disabled>เลือกประเทศ</option>{countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}</select></label><button type="button" className="space-reset" onClick={()=>globe.current?.reset()}>กลับมุมเริ่มต้น <span aria-hidden="true">↺</span></button></div>
        {layer!=='world'&&data&&<PopulationTimeline clock={playback} year={year} label={indicator.label}/>}
      </footer>
    </>}
  </main>;
}
