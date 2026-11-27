import { memo, useEffect, useRef, useState } from 'react';
import './space-backdrop.css';

const randomAt=(seed:number)=>{const value=Math.sin(seed*127.1+311.7)*43758.5453;return value-Math.floor(value);};
const layers=[{name:'far',count:180,radius:.48},{name:'middle',count:90,radius:.7},{name:'near',count:28,radius:1.05}].map((layer,depth)=>({
  ...layer,stars:Array.from({length:layer.count},(_,i)=>({x:randomAt(i+depth*400+1)*1600,y:randomAt(i+depth*400+207)*1000,r:layer.radius*(.65+randomAt(i+depth*400+492)*.7),opacity:.2+randomAt(i+depth*400+833)*.5,bright:depth>0&&i%13===0})),
}));

/** Static SVG stars and composited CSS dust; JS only runs on input or rare meteor events. */
export const SpaceBackdrop=memo(function SpaceBackdrop({motion='full'}:{motion?:'full'|'reduced'}){
  const [size,setSize]=useState({width:1600,height:1000});
  const root=useRef<HTMLDivElement>(null),meteor=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=root.current,streak=meteor.current;if(!element||!streak)return;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const coarse=matchMedia('(hover: none)');
    const surface=element.parentElement!;
    const profiling=new URLSearchParams(location.search).get('globePerf')==='1';
    let inView=true,active=false,disposed=false,timer=0,pointerFrame=0;
    let flight:Animation|null=null,box=element.getBoundingClientRect(),pointerX=0,pointerY=0;
    function resetPointer(){pointerX=pointerY=0;element!.style.setProperty('--space-x','0px');element!.style.setProperty('--space-y','0px');}
    function cancelMeteor(){
      clearTimeout(timer);timer=0;flight?.cancel();flight=null;
      element!.dataset.meteorState='idle';delete element!.dataset.nextMeteorAt;
    }
    function scheduleMeteor(){
      if(!active||disposed)return;
      const delay=30000+Math.random()*40000;
      if(profiling)element!.dataset.nextMeteorAt=String(Date.now()+delay);
      timer=window.setTimeout(()=>{
        timer=0;if(!active||disposed)return;
        const fromLeft=Math.random()<.5;
        const angle=(fromLeft?24+Math.random()*17:139+Math.random()*17)*Math.PI/180;
        const distance=160+Math.random()*90;
        streak!.style.left=`${fromLeft?3+Math.random()*15:78+Math.random()*16}%`;
        streak!.style.top=`${8+Math.random()*28}%`;
        streak!.style.setProperty('--meteor-angle',`${angle*180/Math.PI}deg`);
        element!.dataset.meteorState='flying';delete element!.dataset.nextMeteorAt;
        flight=streak!.animate([
          {transform:'translate3d(0,0,0)',opacity:0,offset:0},
          {transform:`translate3d(${Math.cos(angle)*distance*.15}px,${Math.sin(angle)*distance*.15}px,0)`,opacity:.65,offset:.15},
          {transform:`translate3d(${Math.cos(angle)*distance*.65}px,${Math.sin(angle)*distance*.65}px,0)`,opacity:.5,offset:.65},
          {transform:`translate3d(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance}px,0)`,opacity:0,offset:1},
        ],{duration:800+Math.random()*200,easing:'linear'});
        flight.onfinish=()=>{flight=null;element!.dataset.meteorState='idle';scheduleMeteor();};
      },delay);
    }
    function syncActivity(){
      const next=!disposed&&motion==='full'&&!media.matches&&!document.hidden&&inView;
      element!.dataset.running=String(next);
      if(next===active)return;
      active=next;cancelMeteor();
      if(active)scheduleMeteor();
      else{if(pointerFrame)cancelAnimationFrame(pointerFrame);pointerFrame=0;resetPointer();}
    }
    function move(event:PointerEvent){
      if(!active||coarse.matches||event.pointerType!=='mouse'||event.buttons)return;
      pointerX=Math.max(-1,Math.min(1,(event.clientX-box.left)/Math.max(1,box.width)*2-1))*7;
      pointerY=Math.max(-1,Math.min(1,(event.clientY-box.top)/Math.max(1,box.height)*2-1))*5;
      if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{
        pointerFrame=0;if(!active)return;
        element!.style.setProperty('--space-x',`${pointerX.toFixed(2)}px`);element!.style.setProperty('--space-y',`${pointerY.toFixed(2)}px`);
      });
    }
    const resize=new ResizeObserver(()=>{box=element.getBoundingClientRect();const width=Math.max(1,Math.round(box.width)+36),height=Math.max(1,Math.round(box.height)+36);setSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});});resize.observe(element);
    const visibility=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncActivity();});visibility.observe(element);
    document.addEventListener('visibilitychange',syncActivity);media.addEventListener('change',syncActivity);
    surface.addEventListener('pointermove',move,{passive:true});surface.addEventListener('pointerleave',resetPointer,{passive:true});
    syncActivity();
    return()=>{
      disposed=true;active=false;cancelMeteor();if(pointerFrame)cancelAnimationFrame(pointerFrame);
      resize.disconnect();visibility.disconnect();document.removeEventListener('visibilitychange',syncActivity);media.removeEventListener('change',syncActivity);
      surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerleave',resetPointer);
    };
  },[motion]);
  return <div ref={root} className="space-backdrop" aria-hidden="true" data-running="false" data-meteor-state="idle">
    <div className="space-dust-depth"><div className="space-dust space-dust--left"/><div className="space-dust space-dust--right"/></div>
    {layers.map(layer=><div key={layer.name} className={`space-star-depth space-star-depth--${layer.name}`}><svg className={`space-star-field space-star-field--${layer.name}`} viewBox={'0 0 '+size.width+' '+size.height} preserveAspectRatio="none">
      {layer.stars.map((star,i)=><circle key={i} cx={star.x/1600*size.width} cy={star.y/1000*size.height} r={star.r} fill={i%5===0?'#b4c8dc':'#e5e9ee'} opacity={star.opacity} className={star.bright?'space-star-shimmer':undefined} style={star.bright?{animationDelay:`-${i%11}s`,animationDuration:`${8+i%7}s`}:undefined}/>)}
    </svg></div>)}
    <div className="space-quiet-center"/>
    <div ref={meteor} className="space-meteor"><span/></div>
    <div className="space-edge-vignette"/>
  </div>;
});
