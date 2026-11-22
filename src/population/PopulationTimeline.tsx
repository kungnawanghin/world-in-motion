import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { PopulationClock } from './playback';
import { RollingNumber } from './RollingNumber';

export function PopulationTimeline({clock,year}:{clock:PopulationClock;year:number}){
  const [playing,setPlaying]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const sliderId=useId();
  useEffect(()=>{
    let previousPlaying=false;
    return clock.subscribe(frame=>{
      if(input.current){
        input.current.value=String(frame.position);
        input.current.style.setProperty('--timeline-progress',`${(frame.position-clock.startYear)/Math.max(1,clock.endYear-clock.startYear)*100}%`);
        input.current.setAttribute('aria-valuetext',`ปี ${frame.year}`);
      }
      if(frame.playing!==previousPlaying){previousPlaying=frame.playing;setPlaying(frame.playing);}
    });
  },[clock]);
  function keyboard(event:KeyboardEvent<HTMLInputElement>){
    const keys=['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End','PageUp','PageDown'];
    if(!keys.includes(event.key))return;
    event.preventDefault();
    const current=clock.getFrame().year;
    const next=event.key==='Home'?clock.startYear:event.key==='End'?clock.endYear:
      current+(event.key==='PageUp'?10:event.key==='PageDown'?-10:['ArrowLeft','ArrowDown'].includes(event.key)?-1:1);
    clock.seek(next);
  }
  return <section className="population-timeline" aria-label="ช่วงเวลาประชากร">
    <button type="button" className="population-play" onClick={()=>clock.getFrame().playing?clock.pause():clock.play()} aria-label={playing?'หยุดเล่นเวลา':'เล่นการเปลี่ยนแปลงประชากร'} aria-pressed={playing}><svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">{playing?<><rect x="5" y="4" width="3" height="12"/><rect x="12" y="4" width="3" height="12"/></>:<path d="M6 3.5 16 10 6 16.5Z"/>}</svg></button>
    <label htmlFor={sliderId} className="interactive-globe__sr-only">สำรวจประชากรตามปี</label>
    <output className="population-time-year" htmlFor={sliderId}><RollingNumber value={String(year)} playback={clock}/></output>
    <div className="population-time-control">
      <input ref={input} id={sliderId} type="range" min={clock.startYear} max={clock.endYear} step="any" defaultValue={clock.getFrame().position} aria-label="ปีข้อมูลประชากร" onKeyDown={keyboard} onChange={event=>clock.seek(Number(event.target.value))}/>
      <div className="population-time-ticks" aria-hidden="true"><span>{clock.startYear}</span><span>{clock.endYear}</span></div>
    </div>
  </section>;
}
