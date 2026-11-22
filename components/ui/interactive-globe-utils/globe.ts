import { COUNTRIES, countryAt, createSurface, type Country } from './surface';
export { COUNTRIES } from './surface';
export type { Country } from './surface';

export type GlobeTheme = { ground: string; land: string; arc: string; glow: string; text: string; muted: string };
export type GlobeOptions = {
  theme: GlobeTheme;
  motion?: 'full' | 'reduced';
  autoRotate?: boolean;
  countryColors?: Uint8Array;
  presentation?: 'intro' | 'explore';
  onEnterComplete?: () => void;
  onReady?: () => void;
  onSelect?: (country: Country | null) => void;
  onAnchor?: (anchor: GlobeAnchor | null) => void;
};
export type GlobeAnchor = { x: number; y: number; width: number; height: number; visible: boolean; settled: boolean };
export type GlobeController = { update: (options: GlobeOptions) => void; select: (id: string) => void; reset: () => void; setColorFrame:(from:Uint8Array,to:Uint8Array,mix:number,running?:boolean)=>void; dispose: () => void };
type Hover = (country: Country | null, x: number, y: number) => void;
type Focus = { yaw: number; pitch: number; zoom: number; offsetY: number; fromYaw: number; fromPitch: number; fromZoom: number; fromOffsetY: number; elapsed: number };
type Entrance = { from: number; to: number; fromBorders: number; toBorders: number; elapsed: number };
export const DEFAULT_THEME: GlobeTheme = {
  ground: '#f7fafc', land: '#315b43', arc: '#3aa9b3', glow: '#85c7e6', text: '#15202b', muted: '#61798b',
};
const TAU = Math.PI * 2, DEG = Math.PI / 180, MAX_TILT = 85 * DEG;
const DECAY = -Math.log(.05), DEFAULT_YAW = -100.5 * DEG, DEFAULT_PITCH = 15 * DEG;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const wrap = (a: number) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const ease = (t: number) => t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

/** One native WebGL canvas. No 3D library and no React updates in the frame loop. */
export function createGlobe(canvas: HTMLCanvasElement, initial: GlobeOptions, hover: Hover): GlobeController {
  let options = initial, disposed = false, contextLost = false;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = options.motion === 'reduced' || media.matches;
  let width = 0, height = 0, dpr = 1, radius = 1, cx = 0, cy = 0;
  let yaw = DEFAULT_YAW, pitch = DEFAULT_PITCH, velocityX = 0, velocityY = 0;
  let intro = initial.presentation === 'intro';
  let zoom = intro?2.4:1, targetZoom = zoom, focus: Focus | null = null;
  let borderOpacity = intro?0:1, entrance: Entrance | null = null;
  let offsetY = 0, targetOffsetY = 0, anchorSent = false;
  let selected: Country | null = null, hovered: Country | null = null;
  let lastInput = -Infinity, lastTime = 0, raf = 0, inView = true;
  const pointers = new Map<number,{x:number;y:number}>();
  let dragging = false, moved = false, multiTouch = false;
  let startX = 0, startY = 0, lastX = 0, lastY = 0, lastMoveTime = 0;
  let pinchDistance = 1, pinchZoom = 1, lastTouch = false;
  let lastTapTime = -Infinity, lastTapX = 0, lastTapY = 0;
  const profiling = new URLSearchParams(location.search).get('globePerf') === '1';
  const frameIntervals = new Float32Array(120), paintDurations = new Float32Array(120);
  let sampleCount = 0;
  let ready=false;
  function surfaceReady(){
    invalidate();if(ready)return;ready=true;canvas.dataset.ready='true';
    queueMicrotask(()=>{if(!disposed)options.onReady?.();});
  }
  let surface = createSurface(canvas, options.theme, surfaceReady);
  let externalFrame:{from:Uint8Array;to:Uint8Array;mix:number;running:boolean}|undefined;
  surface.setCountryColors(options.countryColors);
  canvas.dataset.presentation=intro?'intro':'explore';

  function canDraw() { return !disposed && !contextLost && inView && !document.hidden && width > 0 && height > 0; }
  function invalidate() { if (!raf && canDraw()) raf = requestAnimationFrame(frame); }
  function resetClock() { lastTime = 0; }
  function hideTooltip() { hovered = null; hover(null,0,0); }
  function stopMomentum() { velocityX = 0; velocityY = 0; focus = null; }
  function publishPose() {
    if (profiling) canvas.dataset.globePose = JSON.stringify({ country: selected?.id ?? null, lon: +(-wrap(yaw)/DEG).toFixed(3), lat: +(pitch/DEG).toFixed(3), zoom: +zoom.toFixed(3), offsetY: +offsetY.toFixed(1) });
  }
  function selectionOffset() { return selected && width < 640 ? -Math.min(112,height*.14) : 0; }
  function finishEntrance(){
    entrance=null;canvas.dataset.presentation=intro?'intro':'explore';lastInput=performance.now();publishPose();
    if(!intro)queueMicrotask(()=>{if(!disposed&&!intro)options.onEnterComplete?.();});
  }
  function setPresentation(next:'intro'|'explore'){
    const nextIntro=next==='intro';if(nextIntro===intro)return;
    intro=nextIntro;stopMomentum();hideTooltip();
    if(selected){selected=null;delete canvas.dataset.selectedCountry;options.onSelect?.(null);}
    offsetY=targetOffsetY=0;targetZoom=intro?2.4:1;
    canvas.dataset.presentation=intro?'intro':'entering';
    if(reduced){zoom=targetZoom;borderOpacity=intro?0:1;finishEntrance();}
    else entrance={from:zoom,to:targetZoom,fromBorders:borderOpacity,toBorders:intro?0:1,elapsed:0};
    resetClock();invalidate();
  }
  function publishAnchor() {
    if(!selected){if(anchorSent)options.onAnchor?.(null);anchorSent=false;return;}
    const lat=selected.lat*DEG,lon=selected.lon*DEG;
    const x=Math.sin(lon)*Math.cos(lat),y=Math.sin(lat),z=Math.cos(lon)*Math.cos(lat);
    const rx=x*Math.cos(yaw)+z*Math.sin(yaw),rz=z*Math.cos(yaw)-x*Math.sin(yaw);
    const ry=y*Math.cos(pitch)-rz*Math.sin(pitch),depth=y*Math.sin(pitch)+rz*Math.cos(pitch);
    options.onAnchor?.({x:cx+rx*radius*zoom,y:cy-ry*radius*zoom,width,height,visible:depth>.15,settled:!focus&&Math.abs(zoom-targetZoom)<.012&&Math.abs(offsetY-targetOffsetY)<.8});
    anchorSent=true;
  }
  function resize() {
    const box = canvas.getBoundingClientRect(); width = box.width; height = box.height;
    dpr = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.max(1,Math.round(width*dpr)); canvas.height = Math.max(1,Math.round(height*dpr));
    cx = width/2; cy = height/2+offsetY; radius = Math.max(1,Math.min(width*.39,height*.365));
    targetOffsetY=selectionOffset();if(focus)focus.offsetY=targetOffsetY;
    if(reduced){offsetY=targetOffsetY;cy=height/2+offsetY;}
    hideTooltip(); resetClock(); invalidate();
  }
  function advance(dt:number,time:number) {
    if(entrance){
      entrance.elapsed=Math.min(1.3,entrance.elapsed+dt);const t=ease(entrance.elapsed/1.3);
      zoom=entrance.from+(entrance.to-entrance.from)*t;
      borderOpacity=entrance.fromBorders+(entrance.toBorders-entrance.fromBorders)*t;
      yaw+=.009*dt;
      if(entrance.elapsed>=1.3){zoom=entrance.to;borderOpacity=entrance.toBorders;finishEntrance();}
      return;
    }
    if(intro){if(!reduced)yaw+=.009*dt;return;}
    if(reduced){zoom=targetZoom;offsetY=targetOffsetY;velocityX=velocityY=0;return;}
    if(focus){
      focus.elapsed=Math.min(.8,focus.elapsed+dt);const t=ease(focus.elapsed/.8);
      yaw=focus.fromYaw+(focus.yaw-focus.fromYaw)*t;pitch=focus.fromPitch+(focus.pitch-focus.fromPitch)*t;
      zoom=focus.fromZoom+(focus.zoom-focus.fromZoom)*t;offsetY=focus.fromOffsetY+(focus.offsetY-focus.fromOffsetY)*t;
      if(focus.elapsed>=.8){focus=null;lastInput=time;publishPose();}
      return;
    }
    zoom += (targetZoom-zoom)*(1-Math.exp(-10*dt));
    offsetY += (targetOffsetY-offsetY)*(1-Math.exp(-10*dt));
    if(!dragging){
      const decay=Math.pow(.05,dt), integral=(1-decay)/DECAY;
      yaw+=velocityX*integral;pitch+=velocityY*integral;velocityX*=decay;velocityY*=decay;
      if(Math.abs(velocityX)<.0001)velocityX=0;if(Math.abs(velocityY)<.0001)velocityY=0;
      const bounded=clamp(pitch,-MAX_TILT,MAX_TILT);if(bounded!==pitch)velocityY=0;pitch=bounded;
      if(!selected&&!hovered&&time-lastInput>=2500){
        if(options.autoRotate!==false)yaw+=.045*dt;
        pitch+=(DEFAULT_PITCH-pitch)*(1-Math.exp(-1.6*dt));
      }
    }
    yaw=wrap(yaw);
  }
  function frame(time:number){
    raf=0;if(!canDraw()){resetClock();return;}
    const started=profiling?performance.now():0;
    if(Math.min(window.devicePixelRatio||1,2)!==dpr)resize();
    const interval=lastTime?time-lastTime:0;lastTime=time;
    const dt=Math.min(interval/1000,.05);
    advance(dt,time);
    const colorsMoving=surface.advanceColors(dt,reduced);
    cy=height/2+offsetY;
    surface.draw(canvas.width,canvas.height,radius*zoom*dpr,yaw,pitch,hovered?.index??0,selected?.index??0,cx*dpr,cy*dpr,borderOpacity);
    publishAnchor();
    if(profiling&&!reduced&&interval>0){
      frameIntervals[sampleCount]=interval;paintDurations[sampleCount]=performance.now()-started;sampleCount++;
      if(sampleCount===120){
        const intervals=Array.from(frameIntervals).sort((a,b)=>a-b), paints=Array.from(paintDurations).sort((a,b)=>a-b);
        const mean=intervals.reduce((a,b)=>a+b,0)/120;
        canvas.dataset.globeMetrics=JSON.stringify({samples:120,fps:+(1000/mean).toFixed(1),p95FrameMs:+intervals[114].toFixed(2),p95DrawMs:+paints[114].toFixed(2),framesOver25ms:intervals.filter(n=>n>25).length,dpr});sampleCount=0;
      }
    }
    const idleRotation=!selected&&!hovered&&options.autoRotate!==false;
    const tiltReturn=!selected&&!hovered&&Math.abs(pitch-DEFAULT_PITCH)>.0001;
    if(externalFrame?.running||!reduced&&(colorsMoving||intro||entrance||focus||dragging||velocityX||velocityY||Math.abs(targetZoom-zoom)>.0001||Math.abs(targetOffsetY-offsetY)>.1||idleRotation||tiltReturn))invalidate();
    else if(!externalFrame?.running)resetClock();
  }
  function select(id:string){
    if(intro||entrance)return;
    const country=COUNTRIES.find(c=>c.id===id);if(!country)return;
    hideTooltip();stopMomentum();selected=country;lastInput=performance.now();
    targetZoom=1.22;targetOffsetY=selectionOffset();
    const targetYaw=yaw+wrap(-country.lon*DEG-yaw), targetPitch=clamp(country.lat*DEG,-MAX_TILT,MAX_TILT);
    if(reduced){yaw=targetYaw;pitch=targetPitch;zoom=targetZoom;offsetY=targetOffsetY;publishPose();}
    else focus={yaw:targetYaw,pitch:targetPitch,zoom:targetZoom,offsetY:targetOffsetY,fromYaw:yaw,fromPitch:pitch,fromZoom:zoom,fromOffsetY:offsetY,elapsed:0};
    canvas.dataset.selectedCountry=country.id;invalidate();options.onSelect?.(country);
  }
  function reset(){
    if(intro||entrance)return;
    hideTooltip();stopMomentum();selected=null;targetZoom=1;targetOffsetY=0;lastInput=performance.now();delete canvas.dataset.selectedCountry;
    const targetYaw=yaw+wrap(DEFAULT_YAW-yaw);
    if(reduced){yaw=targetYaw;pitch=DEFAULT_PITCH;zoom=1;offsetY=0;publishPose();}
    else focus={yaw:targetYaw,pitch:DEFAULT_PITCH,zoom:1,offsetY:0,fromYaw:yaw,fromPitch:pitch,fromZoom:zoom,fromOffsetY:offsetY,elapsed:0};
    invalidate();options.onSelect?.(null);
  }
  function hitTest(x:number,y:number):Country|null{
    const px=(x-cx)/(radius*zoom),py=(cy-y)/(radius*zoom),d2=px*px+py*py;
    if(d2>1)return null;
    const pz=Math.sqrt(Math.max(0,1-d2)),cp=Math.cos(pitch),sp=Math.sin(pitch),cyaw=Math.cos(yaw),syaw=Math.sin(yaw);
    const worldY=py*cp+pz*sp,rz=pz*cp-py*sp;
    const worldX=px*cyaw-rz*syaw,worldZ=rz*cyaw+px*syaw;
    return countryAt(Math.atan2(worldX,worldZ)/DEG,Math.asin(clamp(worldY,-1,1))/DEG);
  }
  function localPoint(e:PointerEvent){const box=canvas.getBoundingClientRect();return{x:e.clientX-box.left,y:e.clientY-box.top};}
  function updateHover(e:PointerEvent){
    const p=localPoint(e);hovered=hitTest(p.x,p.y);
    hover(hovered,clamp(p.x+16,8,Math.max(8,width-225)),clamp(p.y+16,8,Math.max(8,height-85)));
    canvas.style.cursor=hovered?'pointer':'grab';invalidate();
  }
  function pinchLength(){const values=[...pointers.values()];return Math.max(1,Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y));}
  function onDown(e:PointerEvent){
    if(intro||entrance)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);lastTouch=e.pointerType==='touch';
    lastInput=performance.now();stopMomentum();hideTooltip();
    if(pointers.size===1){dragging=true;moved=false;multiTouch=false;startX=lastX=e.clientX;startY=lastY=e.clientY;lastMoveTime=lastInput;}
    else{multiTouch=true;moved=true;pinchDistance=pinchLength();pinchZoom=targetZoom;}
    canvas.style.cursor='grabbing';invalidate();
  }
  function onMove(e:PointerEvent){
    if(intro||entrance)return;
    if(!pointers.has(e.pointerId)){if(e.pointerType!=='touch'&&!focus)updateHover(e);return;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=performance.now();lastInput=now;
    if(pointers.size>=2){targetZoom=clamp(pinchZoom*pinchLength()/pinchDistance,.75,1.65);if(reduced)zoom=targetZoom;invalidate();return;}
    const dx=e.clientX-lastX,dy=e.clientY-lastY;if(Math.hypot(e.clientX-startX,e.clientY-startY)>4)moved=true;
    const sensitivity=2.7/Math.max(180,radius*2*zoom),deltaYaw=dx*sensitivity,deltaPitch=dy*sensitivity;
    yaw+=deltaYaw;pitch=clamp(pitch+deltaPitch,-MAX_TILT,MAX_TILT);
    const dt=clamp((now-lastMoveTime)/1000,.008,.05);
    velocityX=clamp(velocityX*.45+deltaYaw/dt*.55,-5,5);velocityY=clamp(velocityY*.45+deltaPitch/dt*.55,-4,4);
    lastX=e.clientX;lastY=e.clientY;lastMoveTime=now;invalidate();
  }
  function onUp(e:PointerEvent){
    if(!pointers.has(e.pointerId))return;
    const now=performance.now();lastInput=now;const click=!moved&&!multiTouch&&pointers.size===1;
    pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(pointers.size){const remaining=[...pointers.values()][0];startX=lastX=remaining.x;startY=lastY=remaining.y;lastMoveTime=now;stopMomentum();return;}
    dragging=false;canvas.style.cursor='grab';if(now-lastMoveTime>85||reduced)velocityX=velocityY=0;
    if(click){
      if(now-lastTapTime<320&&Math.hypot(e.clientX-lastTapX,e.clientY-lastTapY)<28){reset();lastTapTime=-Infinity;}
      else{const p=localPoint(e),country=hitTest(p.x,p.y);if(country)select(country.id);lastTapTime=now;lastTapX=e.clientX;lastTapY=e.clientY;}
    }
    if(!lastTouch&&!focus)updateHover(e);invalidate();
  }
  function onCancel(e:PointerEvent){
    if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    dragging=pointers.size>0;stopMomentum();hideTooltip();canvas.style.cursor=dragging?'grabbing':'grab';
    if(pointers.size){const remaining=[...pointers.values()][0];startX=lastX=remaining.x;startY=lastY=remaining.y;lastMoveTime=performance.now();}invalidate();
  }
  function onLeave(){if(!dragging){hideTooltip();lastInput=performance.now();canvas.style.cursor='grab';invalidate();}}
  function onWheel(e:WheelEvent){
    if(intro||entrance)return;
    e.preventDefault();lastInput=performance.now();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
    targetZoom=clamp(targetZoom*Math.exp(-delta*.001),.75,1.65);if(reduced)zoom=targetZoom;hideTooltip();invalidate();
    if(focus)focus.zoom=targetZoom;
  }
  function onKey(e:KeyboardEvent){
    if(intro||entrance)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-','='].includes(e.key))return;
    e.preventDefault();lastInput=performance.now();stopMomentum();hideTooltip();if(e.key==='Home'){reset();return;}
    if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;
    if(e.key==='ArrowUp')pitch=clamp(pitch-.1,-MAX_TILT,MAX_TILT);if(e.key==='ArrowDown')pitch=clamp(pitch+.1,-MAX_TILT,MAX_TILT);
    if(e.key==='+'||e.key==='=')targetZoom=clamp(targetZoom+.1,.75,1.65);if(e.key==='-')targetZoom=clamp(targetZoom-.1,.75,1.65);
    if(reduced)zoom=targetZoom;publishPose();invalidate();
  }
  function visibility(){
    if(raf){cancelAnimationFrame(raf);raf=0;}resetClock();
    if(document.hidden){hideTooltip();for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();dragging=false;stopMomentum();canvas.style.cursor='grab';}invalidate();
  }
  function settleMotion(){
    if(reduced&&entrance){zoom=entrance.to;borderOpacity=entrance.toBorders;finishEntrance();}
    if(reduced&&focus){yaw=focus.yaw;pitch=focus.pitch;zoom=focus.zoom;offsetY=focus.offsetY;publishPose();}
    stopMomentum();resetClock();invalidate();
  }
  function motionChange(){reduced=options.motion==='reduced'||media.matches;settleMotion();}
  function onContextLost(e:Event){e.preventDefault();contextLost=true;visibility();}
  function onContextRestored(){if(disposed)return;surface.dispose();surface=createSurface(canvas,options.theme,surfaceReady);surface.setCountryColors(options.countryColors);if(externalFrame)surface.setColorFrame(externalFrame.from,externalFrame.to,externalFrame.mix);contextLost=false;resetClock();invalidate();}
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);canvas.addEventListener('lostpointercapture',onCancel);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('keydown',onKey);
  canvas.addEventListener('webglcontextlost',onContextLost);canvas.addEventListener('webglcontextrestored',onContextRestored);
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',motionChange);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  const intersectionObserver=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;visibility();});intersectionObserver.observe(canvas);resize();
  return{
    select,reset,
    setColorFrame(from,to,mix,running=false){
      if(disposed||!options.countryColors)return;
      externalFrame={from,to,mix,running};if(profiling)canvas.dataset.colorBlend=String(mix);
      if(!contextLost){surface.setColorFrame(from,to,mix);invalidate();}
    },
    update(next){const changed=JSON.stringify(options.theme)!==JSON.stringify(next.theme),colorsChanged=options.countryColors!==next.countryColors;options=next;const nextReduced=options.motion==='reduced'||media.matches;if(nextReduced!==reduced){reduced=nextReduced;settleMotion();}setPresentation(options.presentation??'explore');if(changed)surface.setTheme(options.theme);if(colorsChanged){externalFrame=undefined;surface.setCountryColors(options.countryColors);}invalidate();},
    dispose(){
      disposed=true;if(raf)cancelAnimationFrame(raf);resizeObserver.disconnect();intersectionObserver.disconnect();surface.dispose();
      document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motionChange);
      canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);canvas.removeEventListener('lostpointercapture',onCancel);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('keydown',onKey);
      canvas.removeEventListener('webglcontextlost',onContextLost);canvas.removeEventListener('webglcontextrestored',onContextRestored);
      for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();canvas.style.cursor='';hover(null,0,0);
    },
  };
}
