export type PlaybackFrame={position:number;year:number;nextYear:number;mix:number;playing:boolean};
export type PopulationClock={
  startYear:number;endYear:number;
  getFrame:()=>PlaybackFrame;
  subscribe:(listener:(frame:PlaybackFrame)=>void)=>()=>void;
  play:()=>void;pause:()=>void;seek:(position:number)=>void;dispose:()=>void;
};
type Scheduler={request:(callback:(time:number)=>void)=>number;cancel:(id:number)=>void;hidden:()=>boolean;visibility:(callback:()=>void)=>()=>void};
export function playbackFrame(position:number,start:number,end:number,playing=false):PlaybackFrame{
  const bounded=Math.max(start,Math.min(end,position));
  const year=Math.min(end,Math.floor(bounded+1e-8));
  return {position:bounded,year,nextYear:Math.min(end,year+1),mix:Math.max(0,bounded-year),playing};
}
/** One fractional clock for the range thumb, SVG playhead and GPU color uniforms. */
export function createPopulationClock(startYear:number,endYear:number,initialYear:number,onYear:(year:number)=>void,scheduler:Scheduler={
  request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id),hidden:()=>document.hidden,
  visibility:callback=>{document.addEventListener('visibilitychange',callback);return()=>document.removeEventListener('visibilitychange',callback);},
}):PopulationClock{
  let frame=playbackFrame(initialYear,startYear,endYear),raf=0,lastTime:number|null=null,removeVisibility:(()=>void)|undefined;
  let reportedYear=frame.year;
  const listeners=new Set<(frame:PlaybackFrame)=>void>();
  function emit(){
    for(const listener of listeners)listener(frame);
    if(frame.year!==reportedYear){reportedYear=frame.year;onYear(frame.year);}
  }
  function cancel(){if(raf)scheduler.cancel(raf);raf=0;lastTime=null;}
  function pause(){cancel();removeVisibility?.();removeVisibility=undefined;frame={...frame,playing:false};emit();}
  function tick(time:number){
    raf=0;if(!frame.playing)return;if(scheduler.hidden()){pause();return;}
    const dt=lastTime===null?0:Math.max(0,Math.min(50,time-lastTime));lastTime=time;
    frame=playbackFrame(frame.position+dt/700,startYear,endYear,true);
    if(frame.position>=endYear){pause();return;}
    // Schedule the clock before invalidating consumers for the next paint.
    raf=scheduler.request(tick);emit();
  }
  return {
    startYear,endYear,getFrame:()=>frame,
    subscribe(listener){listeners.add(listener);listener(frame);return()=>{listeners.delete(listener);};},
    pause,
    play(){
      if(frame.playing||scheduler.hidden())return;
      if(frame.position>=endYear)frame=playbackFrame(startYear,startYear,endYear);
      frame={...frame,playing:true};lastTime=null;
      removeVisibility=scheduler.visibility(()=>{if(scheduler.hidden())pause();});raf=scheduler.request(tick);emit();
    },
    seek(position){cancel();removeVisibility?.();removeVisibility=undefined;frame=playbackFrame(position,startYear,endYear);emit();},
    dispose(){cancel();removeVisibility?.();removeVisibility=undefined;frame={...frame,playing:false};listeners.clear();},
  };
}
