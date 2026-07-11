# Pile Check — As-Built Pile Check by Total Station

Web app สำหรับเช็คตำแหน่งเข็ม as-built หน้างาน (มือถือ + คอม)
Logic ทั้งหมด port มาจากไฟล์ Excel ที่ verify แล้ว (ชุดทดสอบ: เข็ม P4-25)
All calculation logic is ported 1:1 from the verified Excel workbook.

## Stack
React (Vite) · Supabase (Auth + Postgres + RLS) · Cloudflare Pages

## Setup (ครั้งแรก / first time)

1. **Supabase** — สร้างโปรเจกต์ที่ https://supabase.com แล้วรัน migration:
   - เปิด SQL Editor → วางเนื้อหา `supabase/migrations/001_schema.sql` → Run
   - (มี demo data เข็ม P4-25 + STN1/BS1 ให้ทดสอบ ลบทีหลังได้)
2. **Env** — คัดลอก `.env.example` เป็น `.env` แล้วใส่ URL + anon key
   (Supabase → Project Settings → API)
3. **Run**
   ```bash
   npm install
   npm test        # ต้องได้ ALL TESTS PASSED (34 ค่า ตรงกับ Excel)
   npm run dev     # เปิด http://localhost:5173
   ```
4. **ทดสอบด้วยชุด P4-25** — สมัคร user → เลือกเข็ม P4-25, STN1 แล้วกรอก:
   - P1: 1397964.848 / 733027.269 / 5.714
   - P2: 1397964.583 / 733027.566 / 2.377
   - P3: 1397964.7235 / 733027.4175 / 4.0455
   - ต้องได้ Diff N +0.218 GO SOUTH, Diff E −0.753 GO EAST, OVER, slope 1:8.38

## Deploy — Cloudflare Pages
1. push ขึ้น GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → connect repo
3. Build command `npm run build`, output `dist`
4. ใส่ env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. เปิดจากมือถือ → Add to Home Screen

## โครงสร้าง / structure
```
supabase/migrations/001_schema.sql   -- ตาราง + RLS (แก้ได้เฉพาะของตัวเอง, แชร์ให้ทีมได้)
src/lib/calculations.js              -- สูตรทั้งหมด (pure functions)
tests/calculations.test.js           -- verify กับค่า Excel (P4-25)
src/pages/FormPage.jsx               -- หน้าฟอร์มมือถือ + live readout
src/pages/Login.jsx                  -- email/password auth
```

## Phase ถัดไป / next
- Phase 2: PWA + offline (IndexedDB + sync queue)
- Phase 3: CSV import, records list/report, plan-view map, export PDF
