# World in Motion — Country Globe

React + TypeScript + Tailwind ลูกโลกพื้นผิวจริง พร้อมชี้และเลือกประเทศ วาดบน Canvas เดียวด้วย native WebGL โดยไม่มี Three.js หรือแพ็กเกจ 3D เพิ่มเติม

## เปิดใน VS Code

```sh
npm install
npm run dev
```

เปิด http://127.0.0.1:5175 — ถ้า Terminal นี้กำลังรันอยู่แล้ว ให้รีเฟรชหน้าเว็บได้เลย

`npm run build` ตรวจ TypeScript และสร้าง production bundle ส่วน `npm run preview` เปิดผล build ที่พอร์ต 5176

## สิ่งที่ทำได้

- พื้นผิวโลกสีธรรมชาติ: ป่า ทะเลทราย มหาสมุทร และน้ำแข็ง
- เส้นขอบประเทศจาก Natural Earth รุ่น 50m แยกจากภาพพื้นผิว
- ชี้ประเทศเพื่อไฮไลต์และดูชื่อ คลิกเพื่อเลือก
- หมุนเข้าหาจุดกึ่งกลางทางภูมิศาสตร์ของประเทศประมาณ 800 ms และคงไฮไลต์ไว้
- หยุดหมุนอัตโนมัติหลังเลือกประเทศ; ปุ่มกลับมุมเริ่มต้นล้างการเลือก
- ลากหมุนพร้อมแรงเฉื่อย เลื่อนล้อหรือ pinch เพื่อซูม
- คีย์บอร์ด: ลูกศรเพื่อหมุน, + / - เพื่อซูม, Home เพื่อกลับมุมเริ่มต้น
- เลือกประเทศจากรายการได้ทั้งใน demo และเมื่อกด Tab เข้าตัว component
- รองรับ prefers-reduced-motion และ motion="reduced" โดยเลือก/ซูมทันที ไม่มีแรงเฉื่อยหรือหมุนอัตโนมัติ
- ปิดลูปวาดเมื่อซ่อนแท็บ หลุดจอ หรือไม่มีการเคลื่อนไหว

## ไฟล์หลัก

- `components/ui/interactive-globe.tsx` — React component, tooltip, keyboard picker และ ref API
- `components/ui/interactive-globe-utils/globe.ts` — pointer controls, inertia, animation และ country picking
- `components/ui/interactive-globe-utils/surface.ts` — GPU renderer, country ID atlas และเส้นขอบ
- `components/ui/interactive-globe-utils/countries.ts` — geometry ของ 240 ประเทศและดินแดนที่เตรียมไว้แล้ว
- `components/ui/interactive-globe-utils/earth.jpg` — ภาพพื้นผิวโลกที่โหลดจากไฟล์ในโปรเจกต์
- `components/ui/interactive-globe.css` — รูปแบบ component
- `demo.tsx` — เดโมเต็มจอ

## ใช้ใน React / shadcn

โปรเจกต์นี้ตั้ง React, TypeScript, Tailwind และ alias @/ แล้ว หากเริ่มโปรเจกต์ shadcn ใหม่ ให้ทำตามการติดตั้ง Vite และรัน `npx shadcn@latest init` จากนั้นคัดลอก component, CSS และทั้งโฟลเดอร์ utils ไปด้วย

```tsx
import { useRef } from 'react';
import { InteractiveGlobe, type InteractiveGlobeHandle } from '@/components/ui/interactive-globe';

const globe = useRef<InteractiveGlobeHandle>(null);

<InteractiveGlobe
  ref={globe}
  motion="full"
  autoRotate
  onSelect={country => console.log(country?.id, country?.name)}
  style={{ height: 600 }}
/>

// หมุนเข้าหาประเทศไทย หรือกลับมุมเริ่มต้น
globe.current?.selectCountry('764');
globe.current?.reset();
```

Props: `theme`, `motion`, `autoRotate`, `onSelect`, `className`, `style`

`onSelect` รับ Country หรือ null เมื่อ reset: `id`, `index`, `name`, `englishName`, `iso3`, `region`, `lon`, `lat`

Theme คงชื่อสี 6 ช่องเดิม: `ground`, `land`, `arc`, `glow`, `text`, `muted` โดย `arc` ใช้เป็นสีไฮไลต์ประเทศ ไม่ได้วาดเส้นทางแล้ว พื้นผิวสีธรรมชาติมาจากภาพโลกจริง

## ประสิทธิภาพและความแม่นยำ

- ใช้ GPU วาดทรงกลมและพื้นผิวใน draw call เดียว ไม่อัปเดต React state ในเฟรมลูป
- สร้าง country ID atlas และเส้นขอบครั้งเดียวแล้ว cache; เปลี่ยน hover/selection ด้วย uniforms
- ใช้พิกัดบนทรงกลมย้อนกลับเป็น lon/lat เพื่อเลือกประเทศ ตรวจ Path2D เพิ่มตรงชายฝั่ง/เกาะเล็กเพื่อไม่อ่าน ID ที่ปนจาก anti-aliasing
- DPR จำกัดไม่เกิน 2, ResizeObserver, delta-time จำกัด 50 ms, exponential damping
- ข้อมูลภูมิศาสตร์และภาพเก็บในโปรเจกต์ เปิดเว็บแล้วไม่เรียก World Bank หรือบริการแผนที่ภายนอก
- เปิด `/?globePerf=1` เพื่อวัดเป็นชุดละ 120 เฟรม และอ่าน `data-globe-metrics` กับ `data-globe-pose` บน Canvas
- ตัวเลข p95DrawMs วัดเวลาฝั่ง JavaScript ที่ส่งงานวาด ไม่ใช่เวลาทำงานของ GPU ทั้งหมด
- ข้อมูลแผนที่ละเอียดขึ้นทำให้ดาวน์โหลดเริ่มต้นมากขึ้น แต่ไม่เพิ่มจำนวน polygon ที่ต้องคำนวณในแต่ละเฟรม

## แหล่งข้อมูล

- ขอบเขต: Natural Earth (public domain), world-atlas 2 / countries-50m.json
- พื้นผิว: https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg ใช้เฉพาะภาพ ไม่ได้ใช้ Three.js ในแอป
- ชื่อและภูมิภาคบางส่วนมาจาก metadata World Bank ที่เคยเก็บไว้ ไม่มีการแสดงตัวเลขตัวชี้วัดในขั้นนี้

รัน `npm run globe:countries` เพื่อสร้าง country paths ใหม่ สคริปต์เตรียมข้อมูลใช้ D3 และ topojson-client ที่เก็บไว้ใน public/vendor เท่านั้น ทั้งสองไม่ได้รวมในแอป runtime

พื้นผิวเป็นภาพประกอบคงที่ ไม่ใช่ภาพดาวเทียมสด เส้นขอบประเทศอ้างอิงชุดข้อมูล Natural Earth

## ซูมและ popup ประเทศ

เมื่อเลือกประเทศ จะหมุนและซูมเข้า 1.22 เท่าในประมาณ 800 ms แล้วเปิดการ์ดลอย 2.5D ที่เชื่อมกับจุดกึ่งกลางประเทศ การ์ดมีชื่อ รหัส ISO3 ภูมิภาค และภาพรูปร่างประเทศแบบยกชั้นจากขอบเขตจริง

บนมือถือจะขยับลูกโลกขึ้นเพื่อเว้นที่ให้การ์ดด้านล่าง ปิดด้วยปุ่ม ×, กลับไปดูลูกโลก หรือ Escape (เมื่อไม่ได้โฟกัสรายการประเทศ) จะคืนการเลือกและซูมกลับมุมเริ่มต้น รองรับโหมดลดการเคลื่อนไหวโดยแสดงผลทันที

ตำแหน่งการ์ดและเส้นเชื่อมอัปเดตผ่าน DOM refs ในลูปวาด ไม่เรียก React setState ต่อเฟรม รูปแบบการ์ดอยู่ใน interactive-globe.css และเนื้อหาอยู่ใน interactive-globe-utils/country-popup.tsx
