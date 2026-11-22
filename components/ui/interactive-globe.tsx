"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createGlobe, DEFAULT_THEME, COUNTRIES, type GlobeAnchor, type GlobeController, type GlobeOptions, type GlobeTheme, type Country } from './interactive-globe-utils/globe';
import { CountryPopup } from './interactive-globe-utils/country-popup';
import './interactive-globe.css';

export type { GlobeTheme, Country } from './interactive-globe-utils/globe';
export { COUNTRIES, DEFAULT_THEME } from './interactive-globe-utils/globe';
export type InteractiveGlobeHandle = { selectCountry: (id: string) => void; reset: () => void; setCountryColorFrame:(from:Uint8Array,to:Uint8Array,mix:number,running?:boolean)=>void };
export type InteractiveGlobeProps = {
  theme?: GlobeTheme;
  motion?: 'full' | 'reduced';
  autoRotate?: boolean;
  countryColors?: Uint8Array;
  renderCountryDetails?: (country: Country) => ReactNode;
  presentation?: 'intro' | 'explore';
  onEnterComplete?: () => void;
  onReady?: () => void;
  onSelect?: (country: Country | null) => void;
  className?: string;
  style?: CSSProperties;
};

export const InteractiveGlobe = forwardRef<InteractiveGlobeHandle, InteractiveGlobeProps>(function InteractiveGlobe({
  theme = DEFAULT_THEME, motion = 'full', autoRotate = true, countryColors, renderCountryDetails, presentation = 'explore', onEnterComplete, onReady, onSelect, className, style,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipNameRef = useRef<HTMLElement>(null);
  const tooltipNoteRef = useRef<HTMLSpanElement>(null);
  const pickerRef = useRef<HTMLSelectElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const engineRef = useRef<GlobeController | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGSVGElement>(null);
  const connectorPathRef = useRef<SVGPathElement>(null);
  const anchorDotRef = useRef<SVGGElement>(null);
  const lastAnchor = useRef<GlobeAnchor | null>(null);
  const popupSize = useRef({width:304,height:310});
  const returnFocus = useRef<HTMLElement | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [error, setError] = useState('');
  const instructionsId = useId(), tooltipId = useId();
  const latest = useRef({ theme, motion, autoRotate, countryColors, presentation, onEnterComplete, onReady, onSelect });
  latest.current = { theme, motion, autoRotate, countryColors, presentation, onEnterComplete, onReady, onSelect };
  const notify = useCallback((country: Country | null) => {
    lastAnchor.current=null;
    if(connectorRef.current)connectorRef.current.style.visibility='hidden';
    if(popupRef.current)popupRef.current.dataset.visible='false';
    if (statusRef.current) statusRef.current.textContent = country ? `เลือก ${country.name}` : 'กลับมุมเริ่มต้น';
    if (pickerRef.current) pickerRef.current.value = country?.id ?? '';
    if(country) returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setSelectedCountry(country);
    latest.current.onSelect?.(country);
  }, []);
  const positionPopup = useCallback((anchor: GlobeAnchor | null) => {
    lastAnchor.current=anchor;
    const popup=popupRef.current,line=connectorRef.current;
    const visible=!!anchor&&anchor.visible&&anchor.settled;
    if(line)line.style.visibility=visible?'visible':'hidden';
    if(!popup)return;
    popup.dataset.visible=String(visible);
    if(!anchor||!visible)return;
    const {width,height,x,y}=anchor;
    const dataLayer=!!latest.current.countryColors;
    const cardWidth=popupSize.current.width,cardHeight=popupSize.current.height;
    const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n));
    let px:number,py:number,endX:number,endY:number,path:string;
    if(width<640){
      px=clamp(x-cardWidth/2,16,width-cardWidth-16);
      py=clamp(height-cardHeight-(dataLayer?272:height<680?104:120),138,Math.max(138,height-cardHeight-16));
      endX=px+cardWidth/2;endY=py-9;
      path=`M ${x} ${y} C ${x} ${y+32}, ${endX} ${endY-32}, ${endX} ${endY}`;
    }else{
      const rightSide=x+76+cardWidth+24<=width;
      px=clamp(rightSide?x+76:x-cardWidth-76,24,width-cardWidth-24);
      const maxTop=Math.max(20,height-cardHeight-(dataLayer?160:height>600?124:20));
      const minTop=Math.min(height>600?140:20,maxTop);
      py=clamp(y-cardHeight*.43,minTop,maxTop);
      endX=rightSide?px-8:px+cardWidth+8;endY=clamp(y,py+35,py+cardHeight-35);
      const direction=rightSide?1:-1;
      path=`M ${x} ${y} C ${x+direction*36} ${y}, ${endX-direction*28} ${endY}, ${endX} ${endY}`;
    }
    popup.style.transform=`translate3d(${Math.round(px)}px,${Math.round(py)}px,0)`;
    connectorPathRef.current?.setAttribute('d',path);
    anchorDotRef.current?.setAttribute('transform',`translate(${x},${y})`);
  },[]);
  const closePopup=useCallback(()=>{
    engineRef.current?.reset();
    const target=returnFocus.current?.isConnected?returnFocus.current:canvasRef.current;
    target?.focus({preventScroll:true});
  },[]);

  useEffect(()=>{
    const popup=popupRef.current;if(!popup)return;
    const observer=new ResizeObserver(entries=>{
      popupSize.current={width:entries[0].contentRect.width,height:entries[0].contentRect.height};
      positionPopup(lastAnchor.current);
    });
    observer.observe(popup);return()=>observer.disconnect();
  },[selectedCountry?.id,positionPopup]);
  useEffect(()=>{
    if(!selectedCountry)return;
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented&&!(event.target instanceof HTMLSelectElement)){event.preventDefault();closePopup();}
    };
    document.addEventListener('keydown',onEscape);return()=>document.removeEventListener('keydown',onEscape);
  },[selectedCountry,closePopup]);

  useImperativeHandle(ref, () => ({ selectCountry: id => engineRef.current?.select(id), reset: () => engineRef.current?.reset(), setCountryColorFrame:(from,to,mix,running)=>engineRef.current?.setColorFrame(from,to,mix,running) }), []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    try {
      const config: GlobeOptions = { ...latest.current, onSelect: notify, onAnchor: positionPopup };
      engineRef.current = createGlobe(canvas, config, (country, x, y) => {
        const tooltip = tooltipRef.current; if (!tooltip) return;
        tooltip.hidden = !country; if (!country) return;
        if (tooltipNameRef.current) tooltipNameRef.current.textContent = country.name;
        if (tooltipNoteRef.current) { tooltipNoteRef.current.textContent = country.englishName === country.name ? country.region : country.englishName; tooltipNoteRef.current.hidden = !tooltipNoteRef.current.textContent; }
        tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ไม่สามารถเปิดลูกโลกได้'); }
    return () => { engineRef.current?.dispose(); engineRef.current = null; };
  }, [notify,positionPopup]);
  useEffect(() => { engineRef.current?.update({ theme, motion, autoRotate, countryColors, presentation, onEnterComplete, onReady, onSelect: notify, onAnchor:positionPopup }); }, [theme, motion, autoRotate, countryColors, presentation, onEnterComplete, onReady, notify,positionPopup]);

  const cssVariables = { '--ig-ground': theme.ground, '--ig-land': theme.land, '--ig-arc': theme.arc, '--ig-glow': theme.glow, '--ig-text': theme.text, '--ig-muted': theme.muted, ...style } as CSSProperties;
  return (
    <div className={['interactive-globe', className].filter(Boolean).join(' ')} style={cssVariables} data-motion={motion}>
      <canvas ref={canvasRef} className="interactive-globe__canvas" role="img" tabIndex={0}
        aria-label={countryColors&&presentation==='explore'?'ลูกโลกแสดงจำนวนประชากรตามสีประเทศ คลิกเพื่อดูข้อมูลและกราฟย้อนหลัง':'ลูกโลกสีธรรมชาติพร้อมขอบเขตประเทศ ชี้เพื่อไฮไลต์ คลิกเพื่อซูมและเปิดข้อมูลประเทศ'}
        aria-describedby={instructionsId} aria-details={tooltipId} />
      <div ref={tooltipRef} id={tooltipId} className="interactive-globe__tooltip" role="tooltip" hidden><strong ref={tooltipNameRef} /><span ref={tooltipNoteRef} /></div>
      <svg ref={connectorRef} className="ig-country-link" aria-hidden="true"><path ref={connectorPathRef}/><g ref={anchorDotRef}><circle r="8" className="ig-country-link__halo"/><circle r="3.5"/></g></svg>
      {selectedCountry&&<CountryPopup key={selectedCountry.id} ref={popupRef} country={selectedCountry} onClose={closePopup} details={renderCountryDetails?.(selectedCountry)}/>}
      <p id={instructionsId} className="interactive-globe__sr-only">ลากเพื่อหมุน ชี้ประเทศเพื่อดูชื่อ คลิกเพื่อเลือก ซูมเข้าและเปิดข้อมูลประเทศ เลื่อนล้อหรือใช้สองนิ้วเพื่อซูม กด Escape เพื่อปิดข้อมูล แตะสองครั้งหรือกด Home เพื่อกลับมุมเริ่มต้น ใช้ลูกศรหมุนและปุ่มบวกหรือลบเพื่อซูม กด Tab เพื่อเลือกประเทศจากรายการ</p>
      <select ref={pickerRef} defaultValue="" className="interactive-globe__country-picker" aria-label="เลือกประเทศด้วยคีย์บอร์ด" onChange={e => engineRef.current?.select(e.target.value)}>
        <option value="" disabled>เลือกประเทศ</option>
        {[...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name,'th')).map(country => <option key={country.id} value={country.id}>{country.name}</option>)}
      </select>
      <p ref={statusRef} className="interactive-globe__sr-only" role="status" aria-live="polite" />
      {error && <p className="interactive-globe__error" role="alert">{error}</p>}
    </div>
  );
});
export default InteractiveGlobe;
