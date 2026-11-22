import { useRef, useState } from 'react';
import { InteractiveGlobe, COUNTRIES, type Country, type InteractiveGlobeHandle } from '@/components/ui/interactive-globe';
const countries = [...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name,'th'));

export default function Demo() {
  const globe = useRef<InteractiveGlobeHandle>(null);
  const [selected, setSelected] = useState<Country | null>(null);
  const [motion, setMotion] = useState<'full' | 'reduced'>('full');
  return (
    <main className="relative isolate h-svh min-h-[520px] w-full overflow-hidden bg-[#f7fafc] text-[#15202b]">
      <div className="absolute inset-0"><InteractiveGlobe ref={globe} motion={motion} onSelect={setSelected} /></div>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-6 sm:px-12 sm:py-9">
        <div><p className="m-0 text-[12px] font-semibold tracking-[-.3px] sm:text-sm">world in motion.</p><h1 className="mt-3 text-[26px] font-medium tracking-[-1px] sm:mt-4 sm:text-[34px]">สำรวจโลก</h1><p className="mt-2 text-[11px] leading-6 text-[#61798b] sm:text-xs">ชี้เพื่อดูชื่อ · คลิกเพื่อซูมและดูข้อมูล</p></div>
        <button type="button" className="pointer-events-auto rounded-full border border-[#c8d5de] bg-[#f7fafc] px-4 py-2 text-[11px] text-[#61798b] hover:border-[#23628a] hover:text-[#23628a]" aria-pressed={motion==='reduced'} onClick={()=>setMotion(current=>current==='full'?'reduced':'full')}>{motion==='full'?'หยุดหมุน':'เปิดการหมุน'}</button>
      </header>
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 px-6 pb-6 sm:px-12 sm:pb-9">
        <div className="max-w-[48%]" aria-live="polite"><p className="text-[10px] text-[#61798b]">{selected?'ประเทศที่เลือก':'หมุนโลก แล้วเลือกประเทศ'}</p><p className="mt-1 text-xl font-medium tracking-tight sm:text-2xl">{selected?.name??'เริ่มสำรวจได้เลย'}</p>{selected&&<p className="mt-1 text-[10px] leading-5 text-[#61798b] sm:text-xs">{selected.englishName===selected.name?selected.region:selected.englishName}</p>}</div>
        <div className="pointer-events-auto flex max-w-[48%] flex-col items-end gap-3"><label className="flex flex-col gap-1 text-[10px] text-[#61798b]"><span>ไปที่ประเทศ</span><select aria-label="ไปที่ประเทศ" className="w-[145px] rounded-lg border border-[#c8d5de] bg-[#f7fafc] px-3 py-2 text-[11px] text-[#15202b] sm:w-[205px]" value={selected?.id??''} onChange={e=>globe.current?.selectCountry(e.target.value)}><option value="" disabled>เลือกประเทศ</option>{countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}</select></label><button type="button" className="text-[10px] text-[#61798b] hover:text-[#15202b] sm:text-xs" onClick={()=>globe.current?.reset()}>กลับมุมเริ่มต้น ↺</button></div>
      </footer>
    </main>
  );
}
