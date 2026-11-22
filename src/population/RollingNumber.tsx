import { useLayoutEffect, useRef } from 'react';
import type { PopulationClock } from './playback';

const REEL=Array.from({length:30},(_,i)=>i%10);
function Digit({value,animate}:{value:number;animate:boolean}){
  const strip=useRef<HTMLSpanElement>(null);
  const previous=useRef(value),motion=useRef<Animation|null>(null);
  useLayoutEffect(()=>{
    const element=strip.current;if(!element)return;
    const target=10+value;
    const settle=()=>{element.style.transform=`translateY(${-target*1.15}em)`;motion.current?.cancel();motion.current=null;};
    if(!animate||matchMedia('(prefers-reduced-motion: reduce)').matches||previous.current===value){previous.current=value;settle();return;}
    const was=previous.current;previous.current=value;
    let from=10+was;
    if(motion.current){
      const matrix=new DOMMatrixReadOnly(getComputedStyle(element).transform);
      from=-matrix.m42/(parseFloat(getComputedStyle(element).fontSize)*1.15);
      motion.current.cancel();
    }
    // Take the short route through the repeated reel, including 9↔0 carries.
    const destination=[value,value+10,value+20].reduce((nearest,candidate)=>Math.abs(candidate-from)<Math.abs(nearest-from)?candidate:nearest);
    const animation=element.animate([{transform:`translateY(${-from*1.15}em)`},{transform:`translateY(${-destination*1.15}em)`}],{duration:280,easing:'cubic-bezier(.2,.7,.25,1)',fill:'forwards'});
    motion.current=animation;
    animation.onfinish=()=>{if(motion.current===animation)settle();};
  },[value,animate]);
  useLayoutEffect(()=>()=>{motion.current?.cancel();},[]);
  return <span className="meter-digit"><span ref={strip} className="meter-reel" style={{transform:`translateY(${-(10+value)*1.15}em)`}}>{REEL.map((digit,i)=><span key={i}>{digit}</span>)}</span></span>;
}

export function RollingNumber({value,playback}:{value:string;playback:PopulationClock}){
  const root=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>playback.subscribe(frame=>{
    if(!frame.playing)root.current?.getAnimations({subtree:true}).forEach(animation=>animation.finish());
  }),[playback]);
  return <span ref={root} className="meter-number" role="img" aria-label={value} data-value={value}><span aria-hidden="true">{Array.from(value).map((character,i)=>/\d/.test(character)?<Digit key={value.length-i} value={Number(character)} animate={playback.getFrame().playing}/>:<span key={value.length-i} className="meter-separator">{character}</span>)}</span></span>;
}
