import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {INDICATORS,type IndicatorId} from './indicators';

type ExtraIndicator=Exclude<IndicatorId,'population'>;
export function IndicatorSwitcher({layer,onSelect}:{layer:'world'|IndicatorId;onSelect:(layer:'world'|IndicatorId)=>void}){
  const [last,setLast]=useState<ExtraIndicator>('gdp'),[open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
  const menuId=useId();
  const active=layer!=='world'&&layer!=='population';
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  useLayoutEffect(()=>{if(open)menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();},[open]);
  function keyboard(event:KeyboardEvent<HTMLDivElement>){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();return;}
    if(event.key==='Tab'){setOpen(false);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const items=[...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')],i=items.indexOf(document.activeElement as HTMLButtonElement);
    items[event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
  }
  function choose(id:ExtraIndicator){setLast(id);setOpen(false);onSelect(id);trigger.current?.focus();}
  return <div ref={root} className="space-layer-switch indicator-switcher" role="group" aria-label="เลือกมุมมองแผนที่">
    <button type="button" aria-pressed={layer==='world'} onClick={()=>{setOpen(false);onSelect('world');}}>แผนที่โลก</button>
    <button type="button" aria-pressed={layer==='population'} onClick={()=>{setOpen(false);onSelect('population');}}>ประชากร</button>
    <div className={'indicator-slot'+(active?' is-active':'')}>
      <button type="button" className="indicator-current" aria-pressed={active} onClick={()=>{setOpen(false);onSelect(last);}}>{INDICATORS[last].label}</button>
      <button ref={trigger} type="button" className="indicator-trigger" aria-label="เลือกหมวดข้อมูล" aria-haspopup="menu" aria-expanded={open} aria-controls={open?menuId:undefined} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    </div>
    {open&&<div ref={menu} id={menuId} className="indicator-menu" role="menu" aria-label="หมวดข้อมูล" onKeyDown={keyboard}>
      <div role="group" aria-label="เศรษฐกิจ"><p role="presentation">เศรษฐกิจ</p><button type="button" role="menuitemradio" aria-checked={last==='gdp'} onClick={()=>choose('gdp')}><span className="indicator-menu-dot" style={{background:INDICATORS.gdp.accent}}/><span>GDP ต่อหัว</span><span aria-hidden="true">{last==='gdp'?'✓':''}</span></button></div>
      <div role="group" aria-label="สุขภาพ"><p role="presentation">สุขภาพ</p><button type="button" role="menuitemradio" aria-checked={last==='life'} onClick={()=>choose('life')}><span className="indicator-menu-dot" style={{background:INDICATORS.life.accent}}/><span>อายุคาดเฉลี่ย</span><span aria-hidden="true">{last==='life'?'✓':''}</span></button></div>
      <div role="group" aria-label="สังคม"><p role="presentation">สังคม</p><button type="button" role="menuitemradio" aria-checked={last==='internet'} onClick={()=>choose('internet')}><span className="indicator-menu-dot" style={{background:INDICATORS.internet.accent}}/><span>ผู้ใช้อินเทอร์เน็ต</span><span aria-hidden="true">{last==='internet'?'✓':''}</span></button></div>
    </div>}
  </div>;
}
