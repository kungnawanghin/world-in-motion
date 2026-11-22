import { forwardRef, useId, type PointerEvent, type ReactNode } from 'react';
import { COUNTRY_GEOMETRY } from './countries';
import type { Country } from './surface';

type Props = { country: Country; onClose: () => void; details?: ReactNode };

export const CountryPopup = forwardRef<HTMLDivElement, Props>(function CountryPopup({ country, onClose, details }, ref) {
  const titleId = useId(), gradientId = useId();
  const geometry = COUNTRY_GEOMETRY[country.index - 1];
  const [left, top, right, bottom] = geometry.bounds;
  const span = Math.max(right-left, bottom-top, .1);
  const padding = span*.14;
  const viewBox = `${left-padding} ${top-padding} ${right-left+padding*2} ${bottom-top+padding*2+span*.08}`;
  const coordinate = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}° ${value>=0?positive:negative}`;
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if(event.pointerType==='touch')return;
    const box=event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--ig-tilt-x',`${-(event.clientY-box.top-box.height/2)/box.height*3}deg`);
    event.currentTarget.style.setProperty('--ig-tilt-y',`${(event.clientX-box.left-box.width/2)/box.width*4}deg`);
  }
  function releaseTilt(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty('--ig-tilt-x','0deg');event.currentTarget.style.setProperty('--ig-tilt-y','0deg');
  }
  return (
    <div ref={ref} className={`ig-country-popup${details?' ig-country-popup--data':''}`} data-visible="false">
      <div className="ig-country-card" role="dialog" aria-modal="false" aria-labelledby={titleId} onPointerMove={tilt} onPointerLeave={releaseTilt}>
        <button type="button" className="ig-country-card__close" aria-label="ปิดข้อมูลประเทศ" onClick={onClose}>×</button>
        <div className="ig-country-card__eyebrow">ประเทศที่เลือก {country.iso3&&<span>{country.iso3}</span>}</div>
        <h2 id={titleId}>{country.name}</h2>
        {country.name!==country.englishName && <p className="ig-country-card__english">{country.englishName}</p>}
        {details ?? <figure className="ig-country-card__map" aria-label={`รูปร่างแผนที่ ${country.name}`}>
          <svg viewBox={viewBox} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--ig-arc)" stopOpacity=".56"/><stop offset="1" stopColor="var(--ig-arc)"/></linearGradient></defs>
            <path d={geometry.path} transform={`translate(0 ${span*.045})`} className="ig-map-base" />
            <path d={geometry.path} transform={`translate(0 ${span*.022})`} className="ig-map-side" />
            <path d={geometry.path} fill={`url(#${gradientId})`} stroke="var(--ig-land)" strokeWidth={span*.002} strokeLinejoin="round"/>
          </svg>
          <figcaption title="จุดกึ่งกลางทางภูมิศาสตร์ของประเทศ">{coordinate(country.lat,'N','S')} <span>·</span> {coordinate(country.lon,'E','W')}</figcaption>
        </figure>}
        {!details&&<><div className="ig-country-card__region"><span>ภูมิภาค</span><p>{country.region || 'ไม่มีข้อมูลภูมิภาค'}</p></div>
        <button type="button" className="ig-country-card__back" onClick={onClose}>กลับไปดูลูกโลก <span aria-hidden="true">↗</span></button></>}
      </div>
    </div>
  );
});
