# i18n — คำแปลครบชุด (สำหรับ implement batch 2 เป็นต้นไป)

หลักการ: **EN mode = อังกฤษล้วน** / **TH mode = ไทยล้วน ยกเว้นศัพท์เทคนิคที่ทับศัพท์**
(Northing→นอร์ทติ้ง, Easting→อีสติ้ง, Azimuth→แอซิมุท)

**ตัวเลขตัวเดียว N / E / El. ไม่แปล** — คงเป็น N/E/El. ทั้งสองภาษา (สัญกรณ์สากลที่วิศวกรสำรวจไทยใช้เหมือนกัน ไม่งั้นรกตา)

---

## การตัดสินใจ 3 เรื่องที่เจ้าส้ม flag ไว้

1. **รายงาน PDF/PNG (`report.*`) — คงเป็นสองภาษาตายตัวเหมือนเดิม ไม่ผูกกับ toggle**
   เอกสารทางการส่ง consultant ควรมีทั้ง TH/EN เสมอไม่ว่าใครตั้ง toggle เป็นอะไร — **อย่าเอา `report.*` เข้า i18n toggle system**, ปล่อยเป็น bilingual string คงที่แบบที่เป็นอยู่ (batch 2 ไม่ต้องแตะไฟล์ในโฟลเดอร์ `src/reports/`)

2. **Role/Status enum labels** — เพิ่ม label map ใหม่ (ไม่ใช่แค่ t() ตรงๆ เพราะ DB เก็บเป็น enum ภาษาอังกฤษ):
   | enum value | EN label | TH label |
   |---|---|---|
   | role: admin | Admin | ผู้ดูแลระบบ |
   | role: recorder | Recorder | ผู้บันทึก |
   | role: viewer | Viewer | ผู้เข้าชม |
   | status: pending | Pending | รออนุมัติ |
   | status: approved | Approved | อนุมัติแล้ว |

3. **รวม stage label ที่ซ้ำ 5 ที่เป็น key เดียว** — ใช้ `common.stage.before` / `common.stage.after` จุดเดียว แล้วให้ FormPage/ResultReadout/RecordsTable/PlanView เรียก key นี้ร่วมกันแทนที่จะประกาศ const แยกไฟล์ละชุด:
   | key | EN | TH |
   |---|---|---|
   | common.stage.before | Before driving | ก่อนตอก |
   | common.stage.after | After driving | หลังตอก |
   | common.stage.beforeShort | Before | ก่อนตอก |
   | common.stage.afterShort | After | หลังตอก |

---

## status label maps (render-layer only — ห้ามแตะ calculations.js)

ค่าที่ `computeAll()` คืนมาเป็น string ภาษาอังกฤษตายตัว (เช่น `'GO SOUTH'`, `'OK'`) ห้ามแก้ที่ต้นทาง
ให้ทำ **lookup object ที่ component** แม็พค่าดิบ → t() key ตอนแสดงผลเท่านั้น

```js
// ตัวอย่าง: src/lib/statusLabels.js (ไฟล์ใหม่ ไม่แตะ calculations.js)
export const DIR_KEY = {
  'GO NORTH': 'status.goNorth', 'GO SOUTH': 'status.goSouth',
  'GO EAST': 'status.goEast',   'GO WEST': 'status.goWest',
};
export const CHECK_KEY = { OK: 'status.ok', OVER: 'status.over', 'CHECK!': 'status.check' };
export const BOOL_KEY = { TRUE: 'status.true', FALSE: 'status.false' };
export const MOVED_KEY = {
  'moved NORTH': 'status.movedNorth', 'moved SOUTH': 'status.movedSouth',
  'moved EAST': 'status.movedEast',   'moved WEST': 'status.movedWest',
};
export const MARGIN_KEY = { 'Above seabed': 'status.aboveSeabed', 'Below seabed': 'status.belowSeabed' };
export const SEABED_DIFF_KEY = {
  'Deeper (scour)': 'status.deeperScour', 'Shallower (silting)': 'status.shallowerSilting',
};
export const SEABED_SOURCE_KEY = { measured: 'status.measured', design: 'status.design' };
```

| key | EN | TH |
|---|---|---|
| status.goNorth | GO NORTH | เลื่อนไปทางเหนือ |
| status.goSouth | GO SOUTH | เลื่อนไปทางใต้ |
| status.goEast | GO EAST | เลื่อนไปทางออก |
| status.goWest | GO WEST | เลื่อนไปทางตก |
| status.ok | OK | ผ่าน |
| status.over | OVER | เกิน |
| status.check | CHECK! | ตรวจสอบ! |
| status.true | TRUE | ถูกต้อง |
| status.false | FALSE | ผิดพลาด |
| status.movedNorth | moved NORTH | ขยับไปทางเหนือ |
| status.movedSouth | moved SOUTH | ขยับไปทางใต้ |
| status.movedEast | moved EAST | ขยับไปทางออก |
| status.movedWest | moved WEST | ขยับไปทางตก |
| status.aboveSeabed | Above seabed | อยู่เหนือท้องทะเล |
| status.belowSeabed | Below seabed | จมใต้ท้องทะเล |
| status.deeperScour | Deeper (scour) | ลึกขึ้น (กัดเซาะ) |
| status.shallowerSilting | Shallower (silting) | ตื้นขึ้น (ตะกอนทับถม) |
| status.measured | measured | วัดจริง |
| status.design | design | ตามแบบ |
| status.crossCheckOk | OK | ตรงกัน |
| status.crossCheckCheck | CHECK | ไม่ตรงกัน |

หมายเหตุ: ธรรมเนียม **ออก=East, ตก=West** อ้างอิงจากที่มีอยู่แล้วใน `RecordDetailModal.jsx` (`moved EAST`→`ขยับไปทางออก`) — ใช้ธรรมเนียมเดียวกันนี้กับทุกจุดที่มีทิศ E/W

---

## plan.* (เติมจากที่ค้าง batch 1)

| key | EN | TH |
|---|---|---|
| plan.stageBeforeArg | (ใช้ `common.stage.beforeShort`) | ก่อนตอก |
| plan.stageAfterArg | (ใช้ `common.stage.afterShort`) | หลังตอก |

→ แก้โดยเปลี่ยน `STAGE_SHORT` const และการเรียก `statusLine('ก่อนตอก', …)` / `statusLine('หลังตอก', …)` ใน PlanView.jsx ให้ใช้ `t('common.stage.beforeShort')` / `t('common.stage.afterShort')` แทนสตริงดิบ

---

## result.* (เติมจากที่ค้าง batch 1 — 18 รายการ)

| key | EN | TH |
|---|---|---|
| result.asbuiltHeader | AS-BUILT @ DESIGN CUT-OFF ({{el}}) | ตำแหน่งจริง @ ระดับตัดหัวเข็ม ({{el}}) |
| result.diffN | Diff N | ผลต่าง N |
| result.diffE | Diff E | ผลต่าง E |
| result.totalTolCaption | total {{dev}} m / tol {{tol}} | รวม {{dev}} ม. / ค่าเผื่อ {{tol}} |
| result.slopeStamp | slope {{check}} | ความชัน {{check}} |
| result.slopeVs | 1:{{ratio}} vs {{designRatio}} | 1:{{ratio}} เทียบแบบ 1:{{designRatio}} |
| result.p3Stamp | P3 {{check}} | P3 {{check}} |
| result.p3Res | res {{residual}} m | ค่าเบี่ยงเบน {{residual}} ม. |
| result.moreSummary | Toe · Batter Az · Coating | ปลายเข็ม · ทิศเอียง · สารเคลือบ |
| result.elLabel | El. | ระดับ |
| result.batterAz | Batter Az | ทิศเอียง |
| result.designLabel | Design | ตามแบบ |
| result.vertPlaceholder | — (VERT) | — (เข็มตรง) |
| result.diffAz | Diff Az | ผลต่างทิศ |
| result.coatBottom | Coat. bottom | ปลายสารเคลือบ |
| result.seabedSource | Seabed ({{source}}) | ท้องทะเล ({{source}}) |
| result.margin | Margin | ระยะเผื่อ |
| result.seabedDiff | Seabed diff | ผลต่างท้องทะเล |

---

## common.* — App.jsx / TopBarRefresh.jsx

| key | EN | TH |
|---|---|---|
| common.app.brand | Pile Check | Pile Check *(ไม่แปล — เป็นชื่อแบรนด์)* |
| common.app.pendingApproval | Waiting for admin approval | รอผู้ดูแลอนุมัติ |
| common.app.pendingApprovalContact | Contact your project admin to approve | ติดต่อผู้ดูแลโครงการเพื่ออนุมัติ |
| common.app.signOut | Sign out | ออกจากระบบ |
| common.app.signIn | Sign in | เข้าสู่ระบบ |
| common.app.pendingRecords | {{count}} pending | {{count}} รายการ |
| common.app.pendingPhotos | {{count}} photo(s) | {{count}} รูป |
| common.app.waitingSync | (already TH) | รอซิงค์ |
| common.app.toastSynced | Synced | ซิงค์สำเร็จ |
| common.app.toastPasswordUpdated | Password updated | เปลี่ยนรหัสแล้ว |
| common.topbar.refresh | Refresh | รีเฟรช |
| common.topbar.offline | Offline | ออฟไลน์ |
| common.topbar.updatedAt | Updated {{time}} | ข้อมูล ณ {{time}} |

---

## common.* — DataTable / SearchSelect / PhotoGallery / DeviationPlanView

| key | EN | TH |
|---|---|---|
| common.dataTable.columnsBtn | Columns | คอลัมน์ |
| common.dataTable.freezeHint | Freeze | ตรึง |
| common.dataTable.resetBtn | Reset | ค่าเริ่มต้น |
| common.dataTable.saveFailed | Save failed | บันทึกไม่สำเร็จ |
| common.searchSelect.placeholder | Search… | ค้นหา… |
| common.searchSelect.noMatches | No matches | ไม่พบ |
| common.photos.pendingSync | ⏳ pending sync | รอซิงค์ |
| common.photos.typePile | Pile | เข็ม |
| common.photos.typeTsScreen | TS screen | จอกล้อง TS |
| common.photos.typeOther | Other | อื่นๆ |
| common.deviationPlan.caption | PLAN VIEW — deviation to scale vs. tolerance | แผนผัง — ค่าเบี่ยงเบนเทียบสัดส่วนค่าเผื่อ |
| common.deviationPlan.northLabel | N ↑ | N ↑ *(ไม่แปล — สัญลักษณ์ทิศ)* |
| common.deviationPlan.designCenter | ⊕ design center | ⊕ จุดตามแบบ |
| common.deviationPlan.asBuilt | as-built | ตำแหน่งจริง |
| common.deviationPlan.ariaLabel | Plan view of pile deviation, to scale against the position tolerance | แผนผังค่าเบี่ยงเบนตำแหน่งเข็ม เทียบสัดส่วนกับค่าเผื่อตำแหน่ง |
| common.deviationPlan.devCaption | dev {{dev}} m @ Az {{az}}° / tol {{tol}} m | เบี่ยงเบน {{dev}} ม. @ ทิศ {{az}}° / ค่าเผื่อ {{tol}} ม. |

---

## login.* — Login.jsx / SetNewPassword.jsx

| key | EN | TH |
|---|---|---|
| login.tagline | As-built pile check by total station | ตรวจสอบตำแหน่งเข็มจริงด้วยกล้องโททัลสเตชัน |
| login.emailLabel | Email | อีเมล |
| login.passwordLabel | Password | รหัสผ่าน |
| login.showPassword | Show | แสดง |
| login.hidePassword | Hide | ซ่อน |
| login.forgotPassword | Forgot password? | ลืมรหัสผ่าน |
| login.resetLinkSent | Reset link sent — check your email | ส่งลิงก์แล้ว โปรดเช็คอีเมล |
| login.signupNotice | Registered! 1) Confirm via the email we sent 2) Then WAIT for admin approval before you can use the system | สมัครแล้ว! 1) ยืนยันอีเมลตามลิงก์ที่ส่งไป 2) จากนั้นรอผู้ดูแลอนุมัติ จึงจะใช้งานได้ |
| login.signInBtn | Sign in | เข้าสู่ระบบ |
| login.createAccountBtn | Create account | สร้างบัญชี |
| login.sendResetBtn | Send reset link | ส่งลิงก์รีเซ็ต |
| login.backToSignIn | Back to sign in | กลับไปเข้าสู่ระบบ |
| login.newUserPrompt | New user? Create account | ผู้ใช้ใหม่? สร้างบัญชี |
| login.haveAccountPrompt | Have an account? Sign in | มีบัญชีแล้ว? เข้าสู่ระบบ |
| login.close | Close | ปิด |
| login.setNewPasswordTitle | Set new password | ตั้งรหัสผ่านใหม่ |
| login.newPasswordLabel | New password | รหัสผ่านใหม่ |
| login.confirmPasswordLabel | Confirm password | ยืนยันรหัสผ่าน |
| login.passwordTooShort | Password must be at least 6 characters | รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร |
| login.passwordMismatch | Passwords do not match | รหัสผ่านไม่ตรงกัน |
| login.setPasswordBtn | Set password | ตั้งรหัสผ่าน |

---

## form.* — FormPage.jsx

| key | EN | TH |
|---|---|---|
| form.requiredHint | required | จำเป็น |
| form.editingRecordPrefix | Editing record | กำลังแก้ไขบันทึก |
| form.cancelEdit | Cancel edit | ยกเลิก |
| form.offlineUsingCache | Offline — using cached data | ออฟไลน์ — ใช้ข้อมูลล่าสุดในเครื่อง |
| form.cardPileStation | Pile & station | เข็มและจุดตั้งกล้อง |
| form.pileNoLabel | Pile No. | เลขเข็ม |
| form.zoneLabel | Zone | โซน |
| form.zoneAll | All | ทั้งหมด |
| form.pileSelectPlaceholder | — select pile — | ค้นหาเลขเข็ม |
| form.designStripCutoff | Cut-off | ระดับตัดหัวเข็ม |
| form.stationLabel | Station (STN) | จุดตั้งกล้อง (STN) |
| form.stationSelectPlaceholder | — select station — | ค้นหาจุดตั้งกล้อง |
| form.addNewStationOption | + Add new station | + เพิ่มจุดใหม่ |
| form.newStationNameLabel | New station name | ชื่อจุดใหม่ |
| form.newStationNamePlaceholder | Type new station name | พิมพ์ชื่อจุดใหม่ |
| form.newStationWillCreate | New station — will be created on save | หมุดใหม่ จะถูกสร้างเมื่อบันทึก |
| form.unknownStation | Unknown station | ไม่พบหมุดนี้ |
| form.cardStageNote | Stage & note | ช่วงและหมายเหตุ |
| form.stageLabel | Stage | ช่วง |
| form.stageSelectPlaceholder | — select stage — | — เลือกช่วง — |
| form.noteLabel | Note | หมายเหตุ |
| form.notePlaceholder | Optional note | หมายเหตุ (ถ้ามี) |
| form.cardBsCheck | BS check | เช็คหมุดหลัง |
| form.bsCheckHint | shoot BS before piles | ยิงหมุดหลังก่อนวัดเข็ม |
| form.backsightLabel | Backsight | หมุดหลัง |
| form.bsSelectPlaceholder | — select BS — | ค้นหาหมุด |
| form.measuredNLabel | Measured N | ค่า N ที่วัด |
| form.measuredELabel | Measured E | ค่า E ที่วัด |
| form.bsReSetupHint | re-setup station | ตั้งกล้องใหม่ |
| form.point1Title | Point 1 · Top | จุดที่ 1 · บนสุด |
| form.point3Title | Point 3 · Mid (cross-check, optional) | จุดที่ 3 · กลาง (ตรวจทาน, ไม่บังคับ) |
| form.point2Title | Point 2 · Bottom | จุดที่ 2 · ล่างสุด |
| form.northingLabel | Northing | นอร์ทติ้ง |
| form.eastingLabel | Easting | อีสติ้ง |
| form.elevationLabel | Elev. | ระดับ |
| form.pointOptionalHint | leave blank to skip cross-check | เว้นว่างได้ ข้ามการตรวจทาน |
| form.cardSeabed | Seabed re-survey | วัดท้องทะเลใหม่ |
| form.seabedHint | blank = use design | ว่าง = ใช้ตามแบบ |
| form.measuredSeabedLabel | Measured seabed EL. | ระดับท้องทะเลที่วัด |
| form.cardPhotos | Photos | รูปถ่าย |
| form.takePhotoBtn | 📷 Take photo | 📷 ถ่ายรูป |
| form.choosePhotoBtn | 🖼 Choose | 🖼 เลือกรูป |
| form.photoFailedToast | Photo failed | รูปไม่สำเร็จ |
| form.shareToTeamLabel | Share to team | แชร์ให้ทีม |
| form.savingBtn | Saving… | กำลังบันทึก… |
| form.updateRecordBtn | Update record | บันทึกการแก้ไข |
| form.saveRecordBtn | Save record | บันทึกข้อมูล |
| form.field.pileNo | Pile No. | เลขเข็ม |
| form.field.station | Station | จุดตั้งกล้อง |
| form.field.stage | Stage | ช่วง |
| form.field.p1Northing | Point 1 Northing | นอร์ทติ้ง จุดที่ 1 |
| form.field.p1Easting | Point 1 Easting | อีสติ้ง จุดที่ 1 |
| form.field.p1Elevation | Point 1 Elevation | ระดับ จุดที่ 1 |
| form.field.p2Northing | Point 2 Northing | นอร์ทติ้ง จุดที่ 2 |
| form.field.p2Easting | Point 2 Easting | อีสติ้ง จุดที่ 2 |
| form.field.p2Elevation | Point 2 Elevation | ระดับ จุดที่ 2 |
| form.missingFieldsToast | Please complete: {{list}} | กรุณากรอก: {{list}} |
| form.cannotComputeToast | Cannot compute results yet | ยังคำนวณผลไม่ได้ในขณะนี้ |
| form.recordUpdatedToast | Record updated | บันทึกการแก้ไขแล้ว |
| form.matchNoteToast | ✓ matches existing survey (diff {{diff}} m) | ✓ ตรงกับข้อมูลเดิม (ผลต่าง {{diff}} ม.) |
| form.photoFailuresSuffix | ⚠ {{count}} photo(s) failed | รูปไม่สำเร็จ {{count}} รูป |
| form.savedOfflineToast | Saved offline | บันทึกออฟไลน์ |
| form.willSyncSuffix | will sync | จะซิงค์เมื่อมีสัญญาณ |
| form.photosQueuedSuffix | {{count}} photo(s) queued | รูปรอซิงค์ {{count}} รูป |
| form.pileSavedToast | Pile {{pileNo}} saved | บันทึกเข็ม {{pileNo}} แล้ว |
| form.sharedToTeamSuffix | shared to team | แชร์ให้ทีมแล้ว |
| form.privateDraftSuffix | private draft | ฉบับร่างส่วนตัว |
| form.newStationCreatedSuffix | new station created | สร้างหมุดใหม่แล้ว |
| form.crossCheckMismatchTitle | Cross-check mismatch | ข้อมูลไม่ตรงกัน |
| form.crossCheckMismatchBody | Does not match existing survey by {{surveyor}} ({{date}}) — diff {{diff}} m > {{tol}} m. | ไม่ตรงกับข้อมูลของ {{surveyor}} ({{date}}) — ผลต่าง {{diff}} ม. > {{tol}} ม. อาจพิมพ์ตัวเลขผิด ตรวจสอบก่อนบันทึก |
| form.crossCheckSaveAnyway | Save anyway? | ยังจะบันทึกหรือไม่? |
| form.saveSharedBtn | Save shared | บันทึกแบบแชร์ |
| form.savePrivateBtn | Save private | บันทึกส่วนตัว |
| form.cancelReviewBtn | Cancel | กลับไปตรวจ |

---

## records.* — RecordsTable.jsx / RecordDetailModal.jsx

| key | EN | TH |
|---|---|---|
| records.col.no | No. | ลำดับ |
| records.col.pileNo | Pile No. | เลขเข็ม |
| records.col.stage | Stage | ช่วง |
| records.col.note | Note | หมายเหตุ |
| records.col.measured | Measured | วันเวลา |
| records.col.surveyor | Surveyor | ผู้สำรวจ |
| records.col.stn | STN | จุดตั้งกล้อง |
| records.col.p1n | P1 N | P1 N |
| records.col.p1e | P1 E | P1 E |
| records.col.p1el | P1 El. | P1 ระดับ |
| records.col.p2n | P2 N | P2 N |
| records.col.p2e | P2 E | P2 E |
| records.col.p2el | P2 El. | P2 ระดับ |
| records.col.p3n | P3 N | P3 N |
| records.col.p3e | P3 E | P3 E |
| records.col.p3el | P3 El. | P3 ระดับ |
| records.col.measSeabed | Meas. Seabed | ท้องทะเลวัด |
| records.col.axisAz | Axis Az | ทิศแนวแกน |
| records.col.slope | Slope | ความชัน |
| records.col.tiltDeg | Tilt (°) | เอียง (°) |
| records.col.azStnP1 | Az STN→P1 | ทิศ STN→P1 |
| records.col.centerN | Center N | ศูนย์กลาง N |
| records.col.centerE | Center E | ศูนย์กลาง E |
| records.col.asbuiltN | As-built N | ตำแหน่งจริง N |
| records.col.asbuiltE | As-built E | ตำแหน่งจริง E |
| records.col.diffN | Diff N | ผลต่าง N |
| records.col.dirN | Dir N | ทิศ N |
| records.col.diffE | Diff E | ผลต่าง E |
| records.col.dirE | Dir E | ทิศ E |
| records.col.totalDev | Total Dev | เบี่ยงเบนรวม |
| records.col.posCheck | Pos Check | เช็คตำแหน่ง |
| records.col.residual | Residual (P3) | ค่าเบี่ยงเบน (P3) |
| records.col.p3Check | P3 Check | เช็ค P3 |
| records.col.designTilt | Design Tilt (°) | เอียงตามแบบ (°) |
| records.col.tiltDiff | Tilt Diff (°) | ผลต่างเอียง (°) |
| records.col.slopeCheck | Slope Check | เช็คความชัน |
| records.col.designBatterAz | Design Batter Az | ทิศเอียงตามแบบ |
| records.col.asbuiltBatterAz | As-built Batter Az | ทิศเอียงจริง |
| records.col.diffBatterAz | Diff Batter Az | ผลต่างทิศเอียง |
| records.col.toeN | Toe N | ปลายเข็ม N |
| records.col.toeE | Toe E | ปลายเข็ม E |
| records.col.toeZ | Toe Z | ปลายเข็ม ระดับ |
| records.col.coatingBottomEl | Coating Bottom El. | ระดับปลายสารเคลือบ |
| records.col.seabedUsed | Seabed Used | ท้องทะเลที่ใช้ |
| records.col.marginToSeabed | Margin to Seabed | ระยะเผื่อถึงท้องทะเล |
| records.col.marginLabel | Margin Label | สถานะระยะเผื่อ |
| records.col.seabedDiff | Seabed Diff | ผลต่างท้องทะเล |
| records.col.isShared | Shared | แชร์ |
| records.pageTitle | AsBuilt Records | บันทึกเข็มจริง |
| records.filterPlaceholder | Filter pile no. | ค้นหาเลขเข็ม |
| records.mineOnlyLabel | Mine only | เฉพาะของฉัน |
| records.exportExcelBtn | Export Excel | ส่งออกเอ็กเซล |
| records.filterByZoneLabel | Filter by Zone | กรองตามโซน |
| records.unassignedZone | (Unassigned) | (ไม่ระบุโซน) |
| records.viewBtn | View | ดู |
| records.multiSurveyTooltip | {{count}} surveys of this pile — click View for details | มี {{count}} การวัด กดดูรายละเอียด |
| records.actionsLabel | Actions | การกระทำ |
| records.editBtn | Edit | แก้ไข |
| records.deleteBtn | Delete | ลบ |
| records.pendingBadge | ⏳ pending sync | รอซิงค์ |
| records.confirmDelete | Delete {{label}}? | ลบระเบียน {{label}}? |
| records.modal.editBtn | Edit | แก้ไข |
| records.modal.deleteBtn | Delete | ลบ |
| records.modal.crossCheckPass | ✓ surveys agree, max diff {{diff}} m | ✓ ตรงกัน ผลต่างสูงสุด {{diff}} ม. |
| records.modal.crossCheckFail | ⚠ Surveys disagree — max diff {{diff}} m > tolerance {{tol}} m | ⚠ ผลวัดไม่ตรงกัน ผลต่างสูงสุด {{diff}} ม. > ค่าเผื่อ {{tol}} ม. อาจพิมพ์ตัวเลขผิด |
| records.modal.otherSurveysTitle | Other surveys of this pile+stage | การวัดอื่นของเข็มนี้ |
| records.modal.setPrimaryBtn | Set as primary | ตั้งเป็นค่าหลัก |
| records.modal.closeBtn | Close | ปิด |
| records.modal.exportRecordBtn | Export this record | ส่งออกระเบียนนี้ |
| records.modal.attachPhotosLabel | Attach photos (page 2) | แนบรูป (หน้า 2) |
| records.modal.preparingBtn | Preparing… | กำลังเตรียม… |
| records.modal.pdfReportBtn | PDF report | รายงาน PDF |
| records.modal.saveImageBtn | Save image | บันทึกรูป |
| records.modal.beforeAfterSubtitle | Before + after driving | ก่อนและหลังตอก |
| records.modal.headMovedTag | Head moved during driving | หัวเข็มขยับตอนตอก |
| records.modal.moveN | Move N | ขยับ N |
| records.modal.moveE | Move E | ขยับ E |
| records.modal.moveTotal | Move Total | ขยับรวม |
| records.modal.exportBothBtn | Export both records | ส่งออกทั้งสองระเบียน |

---

## designPiles.* — PilesTable.jsx

| key | EN | TH |
|---|---|---|
| designPiles.col.pileNo | Pile No. | เลขเข็ม |
| designPiles.col.zone | Zone | โซน |
| designPiles.col.pileSize | Size | ขนาด |
| designPiles.col.diaMm | Dia (mm) | เส้นผ่านศูนย์กลาง (มม.) |
| designPiles.col.pileTopLevel | Top Level | ระดับหัวเข็ม |
| designPiles.col.seaBedLevel | Seabed Level | ระดับท้องทะเล |
| designPiles.col.pileToeLevel | Toe Level | ระดับปลายเข็ม |
| designPiles.col.lengthM | Length (m) | ความยาว (ม.) |
| designPiles.col.incline | Incline | ความเอียง |
| designPiles.col.coordinatePn | PN | พิกัด N |
| designPiles.col.coordinatePe | PE | พิกัด E |
| designPiles.col.coatingLengthM | Coating (m) | ความยาวเคลือบ (ม.) |
| designPiles.col.batterBearingDeg | Batter Az (°) | ทิศเอียง (°) |
| designPiles.col.note | Note | หมายเหตุ |
| designPiles.pageTitle | Design Piles | เข็มออกแบบ |
| designPiles.addRowBtn | + Add row | + เพิ่มแถว |
| designPiles.importCsvBtn | Import CSV | นำเข้า CSV |
| designPiles.importingBtn | Importing… | กำลังนำเข้า… |
| designPiles.exportCsvBtn | Export CSV | ส่งออก CSV |
| designPiles.zoneLabel | Zone | โซน |
| designPiles.zoneAll | All | ทั้งหมด |
| designPiles.zoneUnassigned | — | ไม่ระบุ |
| designPiles.deleteBtn | Delete | ลบ |
| designPiles.confirmDelete | Delete pile {{pileNo}}? | ลบเข็ม {{pileNo}}? |
| designPiles.hasRecordsCannotDelete | This pile has saved records and cannot be deleted | เข็มนี้มีบันทึกแล้ว ไม่สามารถลบได้ |
| designPiles.onlyOwnDelete | Can only delete piles you created | ลบได้เฉพาะเข็มที่คุณสร้างเท่านั้น |
| designPiles.deletedToast | Deleted {{pileNo}} | ลบ {{pileNo}} แล้ว |
| designPiles.emptyFileMsg | Empty file | ไฟล์ว่างเปล่า |
| designPiles.importResultMsg | {{n}} inserted, {{skipped}} skipped | เพิ่ม {{n}} ข้าม {{skipped}} แถว |
| designPiles.importFailedMsg | Import failed | นำเข้าไม่สำเร็จ |

---

## benchmarks.* — BenchmarksTable.jsx

| key | EN | TH |
|---|---|---|
| benchmarks.col.name | Name | ชื่อหมุด |
| benchmarks.col.northing | Northing | นอร์ทติ้ง |
| benchmarks.col.easting | Easting | อีสติ้ง |
| benchmarks.col.elevation | Elevation | ระดับ |
| benchmarks.col.type | Type | ประเภท |
| benchmarks.col.active | Active | ใช้งาน |
| benchmarks.col.note | Note | หมายเหตุ |
| benchmarks.pageTitle | Benchmarks | หมุดอ้างอิง |
| benchmarks.addRowBtn | + Add row | + เพิ่มแถว |
| benchmarks.importCsvBtn | Import CSV | นำเข้า CSV |
| benchmarks.importingBtn | Importing… | กำลังนำเข้า… |
| benchmarks.exportCsvBtn | Export CSV | ส่งออก CSV |
| benchmarks.deleteBtn | Delete | ลบ |
| benchmarks.confirmDelete | Delete benchmark {{name}}? | ลบหมุด {{name}}? |
| benchmarks.hasRecordsCannotDelete | This benchmark has saved records and cannot be deleted | หมุดนี้มีบันทึกแล้ว ไม่สามารถลบได้ |
| benchmarks.onlyOwnDelete | Can only delete benchmarks you created | ลบได้เฉพาะหมุดที่คุณสร้างเท่านั้น |
| benchmarks.deletedToast | Deleted {{name}} | ลบ {{name}} แล้ว |
| benchmarks.emptyFileMsg | Empty file | ไฟล์ว่างเปล่า |
| benchmarks.importResultMsg | {{n}} inserted, {{skipped}} skipped | เพิ่ม {{n}} ข้าม {{skipped}} แถว |
| benchmarks.importFailedMsg | Import failed | นำเข้าไม่สำเร็จ |

---

## settings.* — SettingsPage.jsx

| key | EN | TH |
|---|---|---|
| settings.pageTitle | Settings | ตั้งค่า |
| settings.loadingLabel | Loading… | กำลังโหลด… |
| settings.col.setting | Setting | การตั้งค่า |
| settings.col.value | Value | ค่า |
| settings.col.description | Description | คำอธิบาย |
| settings.tolPosition | Position tolerance (m) | ค่าเผื่อตำแหน่ง (ม.) |
| settings.tolTilt | Tilt tolerance (°) | ค่าเผื่อความเอียง (องศา) |
| settings.tolResidual | Residual tolerance (m) | ค่าเผื่อระยะเบี่ยงเบน P3 (ม.) |
| settings.tolBs | Backsight tolerance (m) | ค่าเผื่อหมุดหลัง (ม.) |
| settings.tolCoatingEmbed | Coating embed below seabed (m) | ระยะสีจมใต้ท้องทะเลขั้นต่ำ (ม.) |
| settings.tolCrossCheck | Cross-check tolerance (m) | ค่าเผื่อเทียบผู้สำรวจ (ม.) |

*(คอลัมน์ description มาจาก DB — data_value ไม่แปล ตามที่เจ้าส้ม flag ไว้)*

---

## users.* — UsersPage.jsx

| key | EN | TH |
|---|---|---|
| users.pageTitle | Users | จัดการผู้ใช้ |
| users.loadingLabel | Loading… | กำลังโหลด… |
| users.col.email | Email | อีเมล |
| users.col.role | Role | บทบาท |
| users.col.status | Status | สถานะ |
| users.col.created | Created | สร้างเมื่อ |
| users.col.actions | Actions | การกระทำ |
| users.youSuffix | (you) | (คุณ) |
| users.approveBtn | Approve | อนุมัติ |
| users.revokeBtn | Revoke | ระงับ |

**+ role/status label map** (ตารางแยกที่หัวไฟล์ด้านบน) — ใช้แสดงแทนค่า enum ดิบจาก DB ที่ตอนนี้ยังโชว์ตรงๆ

---

## Implementation notes สำหรับ batch ถัดไป

1. **`report.*` (src/reports/*.jsx) — ข้ามไปเลย** ไม่ต้องผูก toggle เอกสารคงสองภาษาตายตัว
2. **รวม stage keys** — ใช้ `common.stage.*` จุดเดียว แทน const 5 ชุดที่กระจายอยู่ (FormPage, ResultReadout, RecordsTable, PlanView, PileReport — ตัวหลังไม่แตะเพราะข้อ 1)
3. **status label maps ทำที่ component เท่านั้น** — สร้างไฟล์ `src/lib/statusLabels.js` แยกต่างหาก แม็พ string ดิบจาก calculations.js → t() key, ไม่แก้ค่าที่ calculations.js คืนออกมา
4. **role/status enum** — เพิ่ม label map ใน UsersPage (และที่อื่นถ้ามีโชว์ role/status)
5. ลำดับแนะนำ: `form.*` (ไฟล์ใหญ่สุด ใช้บ่อยสุด) → `records.*` → `designPiles.*` + `benchmarks.*` (คล้ายกันทำพร้อมกันได้) → `settings.*` + `users.*` → `login.*` → `common.*` ที่เหลือ
