import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { InteractiveGlobe, COUNTRIES, type Country, type GlobeTheme, type InteractiveGlobeHandle } from '@/components/ui/interactive-globe';
import { SpaceBackdrop } from '@/components/ui/space-backdrop';
import './src/space.css';
import { populationColors, type PopulationData } from './src/population/population';
import { loadPopulation } from './src/population/load-population';
import { PopulationDetails } from './src/population/PopulationDetails';
import { PopulationLegend } from './src/population/PopulationLegend';
import { PopulationTimeline } from './src/population/PopulationTimeline';
import { createPopulationClock } from './src/population/playback';
import './src/population/population.css';

const countries=[...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name,'th'));
const SPACE_THEME:GlobeTheme={ground:'#03060c',land:'#666666',arc:'#f5f5f5',glow:'#559bd0',text:'#f2f2f2',muted:'#999999'};
const GLOBE_STYLE:CSSProperties={background:'transparent'};
type Phase='intro'|'entering'|'main';

export default function Demo(){
  const globe=useRef<InteractiveGlobeHandle>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const [selected,setSelected]=useState<Country|null>(null);
  const [motion,setMotion]=useState<'full'|'reduced'>('full');
  const [phase,setPhase]=useState<Phase>('intro');
  const [ready,setReady]=useState(false);
  const [population,setPopulation]=useState<PopulationData|null>(null);
  const [dataError,setDataError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [layer,setLayer]=useState<'world'|'population'>('world');
  const [year,setYear]=useState<number|null>(null);
  const selectedYear=year??population?.mapYear??1960;
  const playback=useMemo(()=>population?createPopulationClock(population.startYear,population.endYear,population.mapYear,setYear):null,[population]);
  // Cache all 66 small color tables once. Scrubbing never rebuilds geography or refetches data.
  const colorFrames=useMemo(()=>population?Array.from({length:population.endYear-population.startYear+1},(_,i)=>populationColors(population,COUNTRIES,population.startYear+i)):[],[population]);
  const colors=layer==='population'&&population?colorFrames[0]:undefined;
  useEffect(()=>()=>playback?.dispose(),[playback]);
  useEffect(()=>{
    if(!playback||!population)return;
    if(layer!=='population'||phase!=='main'){playback.pause();return;}
    return playback.subscribe(frame=>{
      globe.current?.setCountryColorFrame(colorFrames[frame.year-population.startYear],colorFrames[frame.nextYear-population.startYear],frame.mix,frame.playing);
    });
  },[playback,population,colorFrames,layer,phase]);
  const finishEntrance=useCallback(()=>setPhase('main'),[]);
  const handleReady=useCallback(()=>setReady(true),[]);
  const start=()=>{if(ready&&phase==='intro')setPhase('entering');};
  useEffect(()=>{if(phase==='main')heading.current?.focus({preventScroll:true});},[phase]);
  useEffect(()=>{
    if(phase!=='main'||layer!=='population'||population)return;
    let cancelled=false;setDataError(false);
    loadPopulation().then(data=>{if(!cancelled)setPopulation(data);}).catch(()=>{if(!cancelled)setDataError(true);});
    return()=>{cancelled=true;};
  },[phase,layer,population,attempt]);
  const retry=()=>setAttempt(n=>n+1);

  return <main className="space-app" data-phase={phase} data-motion={motion} data-layer={layer}>
    <SpaceBackdrop/>
    <div className="space-globe-stage" inert={phase!=='main'}>
      <InteractiveGlobe ref={globe} theme={SPACE_THEME} style={GLOBE_STYLE} motion={motion} countryColors={colors} renderCountryDetails={layer==='population'?country=>population&&playback?<PopulationDetails data={population} iso3={country.iso3} name={country.name} year={selectedYear} playback={playback}/>:<div className="population-details" role="status">{dataError?<><p>โหลดข้อมูลประชากรไม่สำเร็จ</p><button onClick={retry}>ลองอีกครั้ง</button></>:<p>กำลังโหลดข้อมูลประชากร…</p>}</div>:undefined} presentation={phase==='intro'?'intro':'explore'} onReady={handleReady} onEnterComplete={finishEntrance} onSelect={setSelected}/>
    </div>
    {phase!=='main'&&<section className="launch-screen" aria-label="หน้าเปิด World in Motion">
      <div className="launch-shade"/>
      <div className="launch-content">
        <h1 className="launch-title"><span>WORLD</span><span>IN MOTION</span></h1>
        <div className="launch-action"><button type="button" className="launch-start" disabled={!ready||phase==='entering'} onClick={start}>{!ready?'กำลังเตรียมโลก…':'เริ่มสำรวจ'}<span aria-hidden="true">↗</span></button></div>
      </div>
      <span className="launch-bottom">โลกใบเดียวกัน มีเรื่องราวอีกมากมาย</span>
    </section>}
    {phase==='main'&&<>
      <header className="space-header space-controls">
        <div><button type="button" className="space-wordmark" onClick={()=>setPhase('intro')} title="กลับหน้าเปิด">WORLD IN MOTION<span aria-hidden="true">.</span></button><h1 key={layer} className="space-view-title" ref={heading} tabIndex={-1}>{layer==='world'?'แผนที่โลก':'ประชากรโลก'}{layer==='population'&&population&&<span className="population-year">{selectedYear}</span>}</h1><p key={`${layer}-description`} className="space-view-description">{layer==='world'?'หมุนโลกแล้วคลิกประเทศเพื่อสำรวจ':'คลิกประเทศเพื่อดูจำนวนคนและกราฟย้อนหลัง'}</p>
          <div className="space-layer-switch" role="group" aria-label="เลือกมุมมองแผนที่"><button type="button" aria-pressed={layer==='world'} onClick={()=>setLayer('world')}>แผนที่โลก</button><button type="button" aria-pressed={layer==='population'} onClick={()=>setLayer('population')}>ประชากร</button></div>
        </div>
        <button type="button" className="space-motion" aria-pressed={motion==='reduced'} onClick={()=>setMotion(current=>current==='full'?'reduced':'full')}>{motion==='full'?'หยุดหมุน':'เปิดการหมุน'}<span className={motion==='full'?'is-moving':''} aria-hidden="true"/></button>
      </header>
      <footer className={`space-footer space-controls${layer==='population'?' space-footer--population':''}`}>
        {layer==='population'?<PopulationLegend data={population} year={selectedYear} error={dataError} onRetry={retry}/>:<div className="space-selection"><span>{selected?'ประเทศที่เลือก':'สำรวจประเทศทั่วโลก'}</span><h2>{selected?.name??'โลกใบเดียวกัน'}</h2></div>}
        <div className="space-country-control"><label><span>ไปที่ประเทศ</span><select aria-label="ไปที่ประเทศ" value={selected?.id??''} onChange={e=>globe.current?.selectCountry(e.target.value)}><option value="" disabled>เลือกประเทศ</option>{countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}</select></label><button type="button" className="space-reset" onClick={()=>globe.current?.reset()}>กลับมุมเริ่มต้น <span aria-hidden="true">↺</span></button></div>
        {layer==='population'&&playback&&<PopulationTimeline clock={playback} year={selectedYear}/>}
      </footer>
    </>}
  </main>;
}
