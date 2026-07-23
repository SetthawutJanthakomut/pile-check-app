# i18n Audit — strings still needing keys

Read-only audit, no code changed. Covers everything **not** already keyed in
batch 1 (`nav.*`, `plan.*`, and the 5 `result.*` keys already in `src/i18n.js`).

**Important finding:** `ResultReadout.jsx` (listed in batch 1 as "done") is only
*partially* keyed — 5 strings use `t('result.*')`, but ~18 more strings in the
same file are still hardcoded English with no Thai at all. These are listed
under the `result.*` section below since that's the existing namespace.

**Also found:** `PlanView.jsx` (also "done" in batch 1) has one leftover —
the `statusLine()` label argument is passed as raw Thai (`'ก่อนตอก'`,
`'หลังตอก'`) at lines 683–684, not run through `t()`. Listed under `plan.*`.

Columns: suggested key · EN text · TH text · source file · type · **Missing lang (fill in)**.

Legend for `type`:
- `ui_label` — static label/heading/hint
- `table_header` — DataTable/plain-table column header
- `button` — button/action text
- `placeholder` — input placeholder
- `status_from_calculations` — computed verdict from `calculations.js` (GO NORTH/SOUTH, OK/OVER, etc.) — translate at render layer only, not in calculations.js
- `stage_value` — before/after driving labels
- `data_value` — pure data (pile_no, zone, email, DB-stored text) — **will not be translated**

---

## plan.* (leftover from batch 1)

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| *(inline, not keyed)* `statusLine()` label arg | — | `ก่อนตอก` | src/pages/PlanView.jsx:683 | stage_value | |
| *(inline, not keyed)* `statusLine()` label arg | — | `หลังตอก` | src/pages/PlanView.jsx:684 | stage_value | |
| *(inline, not keyed)* `STAGE_SHORT` const | — | `ก่อนตอก` / `หลังตอก` | src/pages/PlanView.jsx:14 | stage_value | |

Note: `statusLine()` itself appends `OK`/`OVER` from `posCheckFor()` — that part is `status_from_calculations`, already correctly untranslated-in-source (render-layer concern only).

---

## result.* (leftover from batch 1 — ResultReadout.jsx)

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| result.asbuiltHeader | `AS-BUILT @ DESIGN CUT-OFF ({{el}})` | — | src/components/ResultReadout.jsx:29 | ui_label | |
| result.diffN | `Diff N` | — | ResultReadout.jsx:35 | ui_label | |
| result.diffE | `Diff E` | — | ResultReadout.jsx:36 | ui_label | |
| result.totalTolCaption | `total {{dev}} m / tol {{tol}}` | — | ResultReadout.jsx:41 | ui_label | |
| result.slopeStamp | `slope {{check}}` | — | ResultReadout.jsx:44 | status_from_calculations | |
| result.slopeVs | `1:{{ratio}} vs {{designRatio}}` | — | ResultReadout.jsx:45 | ui_label | |
| result.p3Stamp | `P3 {{check}}` | — | ResultReadout.jsx:48 | status_from_calculations | |
| result.p3Res | `res {{residual}} m` | — | ResultReadout.jsx:50 | ui_label | |
| result.moreSummary | `Toe · Batter Az · Coating` | — | ResultReadout.jsx:66 | ui_label | |
| result.elLabel | `El.` | — | ResultReadout.jsx:71 | ui_label | |
| result.batterAz | `Batter Az` | — | ResultReadout.jsx:91 | ui_label | |
| result.designLabel | `Design` | — | ResultReadout.jsx:92 | ui_label | |
| result.vertPlaceholder | `— (VERT)` | — | ResultReadout.jsx:92 | ui_label | |
| result.diffAz | `Diff Az` | — | ResultReadout.jsx:93 | ui_label | |
| result.coatBottom | `Coat. bottom` | — | ResultReadout.jsx:97 | ui_label | |
| result.seabedSource | `Seabed ({{source}})` | — | ResultReadout.jsx:98 | ui_label | |
| result.margin | `Margin` | — | ResultReadout.jsx:100 | ui_label | |
| result.seabedDiff | `Seabed diff` | — | ResultReadout.jsx:111 | ui_label | |

---

## common.* — App.jsx / TopBarRefresh.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| common.app.brand | `Pile Check` | — | src/App.jsx:152,170 | ui_label (brand — consider leaving untranslated) | |
| common.app.pendingApproval | `Waiting for admin approval` | `รอผู้ดูแลอนุมัติ` | App.jsx:155 | ui_label | |
| common.app.pendingApprovalContact | `Contact your project admin to approve` | `ติดต่อผู้ดูแลโครงการเพื่ออนุมัติ` | App.jsx:158 | ui_label | |
| common.app.signOut | `Sign out` | — | App.jsx:160,182 | button | |
| common.app.signIn | `Sign in` | — | App.jsx:184 | button | |
| common.app.pendingRecords | `{{count}} pending` | — | App.jsx:176 | ui_label (template) | |
| common.app.pendingPhotos | `{{count}} photo(s)` | — | App.jsx:176 | ui_label (template) | |
| common.app.waitingSync | — | `รอซิงค์` | App.jsx:176 | ui_label | |
| common.app.toastSynced | `Synced` | `ซิงค์สำเร็จ` | App.jsx:240 | status | |
| common.app.toastPasswordUpdated | `Password updated` | `เปลี่ยนรหัสแล้ว` | App.jsx:241 | status | |
| common.topbar.refresh | `Refresh` | `รีเฟรช` | src/components/TopBarRefresh.jsx:14 | button | |
| common.topbar.offline | `Offline` | `ออฟไลน์` | TopBarRefresh.jsx:17 | ui_label | |
| common.topbar.updatedAt | `Updated {{time}}` | `ข้อมูล ณ {{time}}` | TopBarRefresh.jsx:19 | ui_label | |

---

## common.* — DataTable.jsx / SearchSelect.jsx / PhotoGallery.jsx / DeviationPlanView.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| common.dataTable.columnsBtn | `Columns` | `คอลัมน์` | src/components/DataTable.jsx:41 | button | |
| common.dataTable.freezeHint | `Freeze` | `ตรึง` | DataTable.jsx:51 | ui_label | |
| common.dataTable.resetBtn | `Reset` | `ค่าเริ่มต้น` | DataTable.jsx:55 | button | |
| common.dataTable.saveFailed | `Save failed` | `บันทึกไม่สำเร็จ` | DataTable.jsx:178 | status | |
| common.searchSelect.placeholder | `Search…` | — | src/components/SearchSelect.jsx:11 (default prop) | placeholder | |
| common.searchSelect.noMatches | `No matches` | `ไม่พบ` | SearchSelect.jsx:13 (default prop) | ui_label | |
| common.photos.pendingSync | `⏳ pending sync` | `รอซิงค์` | src/components/PhotoGallery.jsx:50 | status | |
| common.photos.typePile | — | `เข็ม Pile` | src/lib/photos.js:8 | ui_label (enum label, mixed EN/TH in one string) | |
| common.photos.typeTsScreen | — | `จอกล้อง TS screen` | photos.js:9 | ui_label | |
| common.photos.typeOther | — | `อื่นๆ Other` | photos.js:10 | ui_label | |
| common.deviationPlan.caption | `PLAN VIEW — deviation to scale vs. tolerance` | — | src/components/DeviationPlanView.jsx:32 | ui_label | |
| common.deviationPlan.northLabel | `N ↑` | — | DeviationPlanView.jsx:42 | ui_label | |
| common.deviationPlan.designCenter | `⊕ design center` | — | DeviationPlanView.jsx:49 | ui_label | |
| common.deviationPlan.asBuilt | `as-built` | — | DeviationPlanView.jsx:52 | ui_label | |
| common.deviationPlan.ariaLabel | `Plan view of pile deviation, to scale against the position tolerance` | — | DeviationPlanView.jsx:38 | ui_label (aria-label) | |
| common.deviationPlan.devCaption | `dev {{dev}} m @ Az {{az}}° / tol {{tol}} m` | — | DeviationPlanView.jsx:55 | ui_label (template) | |

---

## login.* — Login.jsx / SetNewPassword.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| login.tagline | `As-built pile check by total station` | — | src/pages/Login.jsx:45 | ui_label | |
| login.emailLabel | `Email` | — | Login.jsx:48 | ui_label | |
| login.passwordLabel | `Password` | — | Login.jsx:52 | ui_label | |
| login.showPassword | `Show` | `แสดง` | Login.jsx:62 | button | |
| login.hidePassword | `Hide` | `ซ่อน` | Login.jsx:62 | button | |
| login.forgotPassword | `Forgot password?` | `ลืมรหัสผ่าน` | Login.jsx:68 | button | |
| login.resetLinkSent | `Reset link sent — check your email` | `ส่งลิงก์แล้ว โปรดเช็คอีเมล` | Login.jsx:24 | status | |
| login.signupNotice | `Registered! 1) Confirm via the email we sent 2) Then WAIT for admin approval before you can use the system` | `สมัครแล้ว! 1) ยืนยันอีเมลตามลิงก์ที่ส่งไป 2) จากนั้นรอผู้ดูแลอนุมัติ จึงจะใช้งานได้` | Login.jsx:36 | status | |
| login.signInBtn | `Sign in` | — | Login.jsx:76 | button | |
| login.createAccountBtn | `Create account` | — | Login.jsx:76 | button | |
| login.sendResetBtn | `Send reset link` | `ส่งลิงก์รีเซ็ต` | Login.jsx:76 | button | |
| login.backToSignIn | `Back to sign in` | `กลับไปเข้าสู่ระบบ` | Login.jsx:81 | button | |
| login.newUserPrompt | `New user? Create account` | — | Login.jsx:85 | button | |
| login.haveAccountPrompt | `Have an account? Sign in` | — | Login.jsx:85 | button | |
| login.close | `Close` | `ปิด` | Login.jsx:88 | button | |
| login.setNewPasswordTitle | `Set new password` | `ตั้งรหัสผ่านใหม่` | src/pages/SetNewPassword.jsx:33 | ui_label | |
| login.newPasswordLabel | `New password` | `รหัสผ่านใหม่` | SetNewPassword.jsx:36 | ui_label | |
| login.confirmPasswordLabel | `Confirm password` | `ยืนยันรหัสผ่าน` | SetNewPassword.jsx:50 | ui_label | |
| login.passwordTooShort | `Password must be at least 6 characters` | `รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร` | SetNewPassword.jsx:15 | ui_label (validation) | |
| login.passwordMismatch | `Passwords do not match` | `รหัสผ่านไม่ตรงกัน` | SetNewPassword.jsx:19 | ui_label (validation) | |
| login.setPasswordBtn | `Set password` | `ตั้งรหัสผ่าน` | SetNewPassword.jsx:60 | button | |

Dev note (not an i18n item): `Login.jsx:33` has a leftover `console.log('Supabase auth error:', error); // TEMP DEBUG` — flagging per instructions, not touching it.

---

## form.* — FormPage.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| form.requiredHint | `required` | `จำเป็น` | FormPage.jsx:508 | ui_label | |
| form.editingRecordPrefix | `Editing record` | — | FormPage.jsx:504 | ui_label | |
| form.cancelEdit | `Cancel edit` | `ยกเลิก` | FormPage.jsx:505 | button | |
| form.offlineUsingCache | `Offline — using cached data` | `ออฟไลน์ — ใช้ข้อมูลล่าสุดในเครื่อง` | FormPage.jsx:499 | ui_label | |
| form.stageBanner.before | `Before driving` | `ก่อนตอก` | FormPage.jsx:17 (STAGE_BANNER) | stage_value | |
| form.stageBanner.after | `After driving` | `หลังตอก` | FormPage.jsx:17 (STAGE_BANNER) | stage_value | |
| form.cardPileStation | `Pile & station` | `เข็มและจุดตั้งกล้อง` | FormPage.jsx:512 | ui_label | |
| form.pileNoLabel | `Pile No.` | — | FormPage.jsx:514 | ui_label | |
| form.zoneLabel | `Zone` | `โซน` | FormPage.jsx:517 | ui_label | |
| form.zoneAll | `All` | `ทั้งหมด` | FormPage.jsx:519 | button | |
| form.pileSelectPlaceholder | `— select pile —` | `ค้นหาเลขเข็ม` | FormPage.jsx:532 | placeholder | |
| form.designStripCutoff | `Cut-off` | — | FormPage.jsx:540 | ui_label | |
| form.stationLabel | `Station (STN)` | — | FormPage.jsx:545 | ui_label | |
| form.stationSelectPlaceholder | `— select station —` | `ค้นหาจุดตั้งกล้อง` | FormPage.jsx:550 | placeholder | |
| form.addNewStationOption | `+ Add new station` | `เพิ่มจุดใหม่` | FormPage.jsx:18 (STN_TRAILING_OPTION) | ui_label | |
| form.newStationNameLabel | `New station name` | `ชื่อจุดใหม่` | FormPage.jsx:557 | ui_label | |
| form.newStationNamePlaceholder | `Type new station name` | — | FormPage.jsx:561 | placeholder | |
| form.newStationWillCreate | `New station — will be created on save` | `หมุดใหม่ จะถูกสร้างเมื่อบันทึก` | FormPage.jsx:568 | ui_label | |
| form.unknownStation | `Unknown station` | `ไม่พบหมุดนี้` | FormPage.jsx:569 | ui_label | |
| form.cardStageNote | `Stage & note` | `ช่วงและหมายเหตุ` | FormPage.jsx:576 | ui_label | |
| form.stageLabel | `Stage` | `ช่วง` | FormPage.jsx:578 | ui_label | |
| form.stageSelectPlaceholder | `— select stage —` | — | FormPage.jsx:584 | placeholder | |
| form.stageOptionBefore | `Before driving` | `ก่อนตอก` | FormPage.jsx:585 | stage_value | |
| form.stageOptionAfter | `After driving` | `หลังตอก` | FormPage.jsx:586 | stage_value | |
| form.noteLabel | `Note` | `หมายเหตุ` | FormPage.jsx:590 | ui_label | |
| form.notePlaceholder | `Optional note` | `หมายเหตุ (ถ้ามี)` | FormPage.jsx:591 | placeholder | |
| form.cardBsCheck | `BS check` | `เช็คหมุดหลัง` | FormPage.jsx:597 | ui_label | |
| form.bsCheckHint | `shoot BS before piles` | — | FormPage.jsx:597 (italic) | ui_label | |
| form.backsightLabel | `Backsight` | — | FormPage.jsx:599 | ui_label | |
| form.bsSelectPlaceholder | `— select BS —` | `ค้นหาหมุด` | FormPage.jsx:604 | placeholder | |
| form.measuredNLabel | `Measured N` | — | FormPage.jsx:608 | ui_label | |
| form.measuredELabel | `Measured E` | — | FormPage.jsx:610 | ui_label | |
| form.bsResultTrue | `TRUE` | — | FormPage.jsx:615 | status_from_calculations (bsCheck) | |
| form.bsResultFalse | `FALSE` | — | FormPage.jsx:615 | status_from_calculations (bsCheck) | |
| form.bsReSetupHint | `re-setup station` | — | FormPage.jsx:615 | ui_label | |
| form.point1Title | `Point 1 · Top จุดสูงสุด` | — | FormPage.jsx:621 | ui_label | |
| form.point3Title | `Point 3 · Mid กลาง (cross-check, optional)` | — | FormPage.jsx:622 | ui_label | |
| form.point2Title | `Point 2 · Bottom จุดต่ำสุด` | — | FormPage.jsx:623 | ui_label | |
| form.northingLabel | `Northing` | — | FormPage.jsx:733 | ui_label | |
| form.eastingLabel | `Easting` | — | FormPage.jsx:735 | ui_label | |
| form.elevationLabel | `Elev.` | — | FormPage.jsx:737 | ui_label | |
| form.pointOptionalHint | `leave blank to skip cross-check` | `เว้นว่างได้` | FormPage.jsx:740 | ui_label | |
| form.cardSeabed | `Seabed re-survey` | `วัด seabed ใหม่` | FormPage.jsx:626 | ui_label | |
| form.seabedHint | `blank = use design` | — | FormPage.jsx:626 (italic) | ui_label | |
| form.measuredSeabedLabel | `Measured seabed EL.` | — | FormPage.jsx:627 | ui_label | |
| form.cardPhotos | `Photos` | `รูปถ่าย` | FormPage.jsx:641 | ui_label | |
| form.takePhotoBtn | `📷 Take photo` | `ถ่ายรูป` | FormPage.jsx:645 | button | |
| form.choosePhotoBtn | `🖼 Choose` | `เลือกรูป` | FormPage.jsx:647 | button | |
| form.photoFailedToast | `Photo failed` | `รูปไม่สำเร็จ` | FormPage.jsx:182 | status | |
| form.shareToTeamLabel | `Share to team` | `แชร์ให้ทีม` | FormPage.jsx:687 | ui_label | |
| form.savingBtn | `Saving…` | — | FormPage.jsx:694 | button | |
| form.updateRecordBtn | `Update record` | `บันทึกการแก้ไข` | FormPage.jsx:694 | button | |
| form.saveRecordBtn | `Save record` | — | FormPage.jsx:694 | button | |
| form.field.pileNo | `Pile No.` | `เลขเข็ม` | FormPage.jsx:256 | ui_label | |
| form.field.station | `Station` | `จุดตั้งกล้อง` | FormPage.jsx:257 | ui_label | |
| form.field.stage | `Stage` | `ช่วง` | FormPage.jsx:258 | ui_label | |
| form.field.p1Northing | `Point 1 Northing` | `พิกัด N Point 1` | FormPage.jsx:259 | ui_label | |
| form.field.p1Easting | `Point 1 Easting` | `พิกัด E Point 1` | FormPage.jsx:260 | ui_label | |
| form.field.p1Elevation | `Point 1 Elevation` | `ระดับ Point 1` | FormPage.jsx:261 | ui_label | |
| form.field.p2Northing | `Point 2 Northing` | `พิกัด N Point 2` | FormPage.jsx:262 | ui_label | |
| form.field.p2Easting | `Point 2 Easting` | `พิกัด E Point 2` | FormPage.jsx:263 | ui_label | |
| form.field.p2Elevation | `Point 2 Elevation` | `ระดับ Point 2` | FormPage.jsx:264 | ui_label | |
| form.missingFieldsToast | `Please complete: {{list}}` | `กรุณากรอก: {{list}}` | FormPage.jsx:347 | ui_label (template) | |
| form.cannotComputeToast | `Cannot compute results yet` | `ยังคำนวณผลไม่ได้ในขณะนี้` | FormPage.jsx:349 | status | |
| form.recordUpdatedToast | `Record updated` | `บันทึกการแก้ไขแล้ว` | FormPage.jsx:410 | status | |
| form.matchNoteToast | `✓ matches existing survey (diff {{diff}} m)` | — | FormPage.jsx:331 | ui_label (template) | |
| form.photoFailuresSuffix | `⚠ {{count}} photo(s) failed` | `รูปไม่สำเร็จ {{count}} รูป` | FormPage.jsx:411,490 | status | |
| form.savedOfflineToast | `Saved offline` | `บันทึกออฟไลน์` | FormPage.jsx:458 | status | |
| form.willSyncSuffix | `will sync` | `จะซิงค์เมื่อมีสัญญาณ` | FormPage.jsx:458 | status | |
| form.photosQueuedSuffix | `{{count}} photo(s) queued` | `รูปรอซิงค์ {{count}} รูป` | FormPage.jsx:459 | status | |
| form.pileSavedToast | `Pile {{pileNo}} saved` | — | FormPage.jsx:490 | status (template) | |
| form.sharedToTeamSuffix | `shared to team` | — | FormPage.jsx:490 | status | |
| form.privateDraftSuffix | `private draft` | — | FormPage.jsx:490 | status | |
| form.newStationCreatedSuffix | `new station created` | `สร้างหมุดใหม่` | FormPage.jsx:490 | status | |
| form.crossCheckMismatchTitle | `Cross-check mismatch` | `ข้อมูลไม่ตรงกัน` | FormPage.jsx:705 | ui_label | |
| form.crossCheckMismatchBody | `Does not match existing survey by {{surveyor}} ({{date}}) — diff {{diff}} m > {{tol}} m.` | `อาจพิมพ์ตัวเลขผิด ตรวจสอบก่อนบันทึก.` | FormPage.jsx:708 | ui_label (template) | |
| form.crossCheckSaveAnyway | `Save anyway?` | — | FormPage.jsx:709 | ui_label | |
| form.saveSharedBtn | `Save shared` | `บันทึกแบบแชร์` | FormPage.jsx:711 | button | |
| form.savePrivateBtn | `Save private` | `บันทึกส่วนตัว` | FormPage.jsx:714 | button | |
| form.cancelReviewBtn | `Cancel` | `กลับไปตรวจ` | FormPage.jsx:717 | button | |

Duplication flag (not a new key, just noting): `form.stageBanner.*` / `form.stageOptionBefore/After` duplicate the same before/after-driving text as `result.stageBefore/After` (already keyed) and `records.stageShort.*` and `plan`'s `STAGE_SHORT` below — four independent hardcoded copies of the same two labels across the codebase. Worth collapsing to one shared key when this gets implemented.

---

## records.* — RecordsTable.jsx / RecordDetailModal.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| records.stageShort.before | — | `ก่อนตอก` | RecordsTable.jsx:14 (STAGE_SHORT) | stage_value | |
| records.stageShort.after | — | `หลังตอก` | RecordsTable.jsx:14 (STAGE_SHORT) | stage_value | |
| records.col.no | `No.` | — | RecordsTable.jsx:25 | table_header | |
| records.col.pileNo | `Pile No.` | `เลขเข็ม` | RecordsTable.jsx:26 | table_header | |
| records.col.stage | `Stage` | `ระยะ` | RecordsTable.jsx:27 | table_header | |
| records.col.note | `Note` | `หมายเหตุ` | RecordsTable.jsx:28 | table_header | |
| records.col.measured | `Measured` | `วันเวลา` | RecordsTable.jsx:30 | table_header | |
| records.col.surveyor | `Surveyor` | `ผู้สำรวจ` | RecordsTable.jsx:33 | table_header | |
| records.col.stn | `STN` | `จุดตั้งกล้อง` | RecordsTable.jsx:34 | table_header | |
| records.col.p1n / p1e / p1el | `P1 N` / `P1 E` / `P1 El.` | — | RecordsTable.jsx:35 | table_header | |
| records.col.p2n / p2e / p2el | `P2 N` / `P2 E` / `P2 El.` | — | RecordsTable.jsx:36 | table_header | |
| records.col.p3n / p3e / p3el | `P3 N` / `P3 E` / `P3 El.` | — | RecordsTable.jsx:37 | table_header | |
| records.col.measSeabed | `Meas. Seabed` | `ท้องทะเลวัด` | RecordsTable.jsx:38 | table_header | |
| records.col.axisAz | `Axis Az` | `แนวแกน` | RecordsTable.jsx:39 | table_header | |
| records.col.slope | `Slope` | `ความชัน` | RecordsTable.jsx:40 | table_header | |
| records.col.tiltDeg | `Tilt (°)` | `เอียง` | RecordsTable.jsx:41 | table_header | |
| records.col.azStnP1 | `Az STN→P1` | — | RecordsTable.jsx:42 | table_header | |
| records.col.centerN / centerE | `Center N` / `Center E` | — | RecordsTable.jsx:43-44 | table_header | |
| records.col.asbuiltN / asbuiltE | `As-built N` / `As-built E` | — | RecordsTable.jsx:45-46 | table_header | |
| records.col.diffN / dirN | `Diff N` / `Dir N` | — | RecordsTable.jsx:47-48 | table_header | |
| records.col.diffE / dirE | `Diff E` / `Dir E` | — | RecordsTable.jsx:49-50 | table_header | |
| records.col.totalDev | `Total Dev` | `เบี่ยงเบนรวม` | RecordsTable.jsx:51 | table_header | |
| records.col.posCheck | `Pos Check` | — | RecordsTable.jsx:52 | table_header | |
| records.col.residual | `Residual (P3)` | — | RecordsTable.jsx:53 | table_header | |
| records.col.p3Check | `P3 Check` | — | RecordsTable.jsx:54 | table_header | |
| records.col.designTilt | `Design Tilt (°)` | — | RecordsTable.jsx:55 | table_header | |
| records.col.tiltDiff | `Tilt Diff (°)` | — | RecordsTable.jsx:56 | table_header | |
| records.col.slopeCheck | `Slope Check` | — | RecordsTable.jsx:57 | table_header | |
| records.col.designBatterAz | `Design Batter Az` | — | RecordsTable.jsx:58 | table_header | |
| records.col.asbuiltBatterAz | `As-built Batter Az` | — | RecordsTable.jsx:59 | table_header | |
| records.col.diffBatterAz | `Diff Batter Az` | — | RecordsTable.jsx:60 | table_header | |
| records.col.toeN / toeE / toeZ | `Toe N` / `Toe E` / `Toe Z` | — | RecordsTable.jsx:61-63 | table_header | |
| records.col.coatingBottomEl | `Coating Bottom El.` | — | RecordsTable.jsx:64 | table_header | |
| records.col.seabedUsed | `Seabed Used` | — | RecordsTable.jsx:65 | table_header | |
| records.col.marginToSeabed | `Margin to Seabed` | — | RecordsTable.jsx:66 | table_header | |
| records.col.marginLabel | `Margin Label` | — | RecordsTable.jsx:67 | table_header | |
| records.col.seabedDiff | `Seabed Diff` | — | RecordsTable.jsx:68 | table_header | |
| records.col.isShared | `Shared` | `แชร์` | RecordsTable.jsx:69 | table_header | |
| records.freeze.view / no / pileNo / stage / note / measured / surveyor / stn | `View` / `No.` / `Pile No.` / `Stage` / `Note` / `Measured` / `Surveyor` / `STN` | — | RecordsTable.jsx:73-80 (FREEZE_CANDIDATES) | table_header (dup of records.col.* short forms) | |
| records.pageTitle | `AsBuilt Records` | `บันทึกเข็มจริง` | RecordsTable.jsx:353 | ui_label | |
| records.filterPlaceholder | `Filter pile no.` | `ค้นหาเลขเข็ม` | RecordsTable.jsx:356 | placeholder | |
| records.mineOnlyLabel | `Mine only` | `เฉพาะของฉัน` | RecordsTable.jsx:363 | ui_label | |
| records.exportExcelBtn | `Export Excel` | `ส่งออกเอ็กเซล` | RecordsTable.jsx:367 | button | |
| records.filterByZoneLabel | `Filter by Zone` | `กรองตามโซน` | RecordsTable.jsx:378 | ui_label | |
| records.unassignedZone | `(Unassigned)` | `ไม่ระบุโซน` | RecordsTable.jsx:386 | ui_label | |
| records.viewBtn | `View` | — | RecordsTable.jsx:325 | button | |
| records.multiSurveyTooltip | `{{count}} surveys of this pile — click View for details` | `มี {{count}} การวัด กดดูรายละเอียด` | RecordsTable.jsx:339 | ui_label (title attr) | |
| records.actionsLabel | `Actions` | `การกระทำ` | RecordsTable.jsx:397 | table_header | |
| records.editBtn | `Edit` | `แก้ไข` | RecordsTable.jsx:400 | button | |
| records.deleteBtn | `Delete` | `ลบ` | RecordsTable.jsx:401 | button | |
| records.pendingBadge | `⏳ pending sync` | `รอซิงค์` | RecordsTable.jsx:323 | status | |
| records.confirmDelete | `Delete {{label}}?` | `ลบระเบียน {{label}}?` | src/lib/recordActions.js:25 | ui_label (window.confirm) | |
| records.modal.editBtn | `Edit` | `แก้ไข` | RecordDetailModal.jsx:43 | button | |
| records.modal.deleteBtn | `Delete` | `ลบ` | RecordDetailModal.jsx:44 | button | |
| records.modal.crossCheckPass | `✓ surveys agree, max diff {{diff}} m` | — | RecordDetailModal.jsx:55 | ui_label (template) | |
| records.modal.crossCheckFail | `⚠ Surveys disagree — max diff {{diff}} m > tolerance {{tol}} m` | `ผลวัดไม่ตรงกัน อาจพิมพ์ตัวเลขผิด` | RecordDetailModal.jsx:56 | ui_label (template) | |
| records.modal.otherSurveysTitle | `Other surveys of this pile+stage` | `การวัดอื่นของเข็มนี้` | RecordDetailModal.jsx:69 | ui_label | |
| records.modal.setPrimaryBtn | `Set as primary` | `ตั้งเป็นค่าหลัก` | RecordDetailModal.jsx:78 | button | |
| records.modal.closeBtn | `Close` | `ปิด` | RecordDetailModal.jsx:171,220 | button | |
| records.modal.exportRecordBtn | `Export this record` | `ส่งออกระเบียนนี้` | RecordDetailModal.jsx:178 | button | |
| records.modal.attachPhotosLabel | `Attach photos (page 2)` | `แนบรูป (หน้า 2)` | RecordDetailModal.jsx:187 | ui_label | |
| records.modal.preparingBtn | `Preparing…` | `กำลังเตรียม` | RecordDetailModal.jsx:190,193 | button | |
| records.modal.pdfReportBtn | `PDF report` | `รายงาน PDF` | RecordDetailModal.jsx:190 | button | |
| records.modal.saveImageBtn | `Save image` | `บันทึกรูป` | RecordDetailModal.jsx:193 | button | |
| records.modal.beforeAfterSubtitle | `Before + after driving` | `ก่อนและหลังตอก` | RecordDetailModal.jsx:218 | ui_label | |
| records.modal.headMovedTag | `Head moved during driving` | `หัวเข็มขยับตอนตอก` | RecordDetailModal.jsx:223 | ui_label | |
| records.modal.moveN | `Move N` | — | RecordDetailModal.jsx:225 | ui_label | |
| records.modal.moveE | `Move E` | — | RecordDetailModal.jsx:226 | ui_label | |
| records.modal.moveTotal | `Move Total` | — | RecordDetailModal.jsx:227 | ui_label | |
| records.modal.movedSouth | `moved SOUTH` | `ขยับไปทางใต้` | RecordDetailModal.jsx:209 | status_from_calculations (sign of moveN, computed in this file) | |
| records.modal.movedNorth | `moved NORTH` | `ขยับไปทางเหนือ` | RecordDetailModal.jsx:209 | status_from_calculations | |
| records.modal.movedWest | `moved WEST` | `ขยับไปทางตก` | RecordDetailModal.jsx:210 | status_from_calculations | |
| records.modal.movedEast | `moved EAST` | `ขยับไปทางออก` | RecordDetailModal.jsx:210 | status_from_calculations | |
| records.modal.exportBothBtn | `Export both records` | `ส่งออกทั้งสองระเบียน` | RecordDetailModal.jsx:285 | button | |

---

## designPiles.* — PilesTable.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| designPiles.col.pileNo | `Pile No.` | `เลขเข็ม` | PilesTable.jsx:10 | table_header | |
| designPiles.col.zone | `Zone` | `โซน` | PilesTable.jsx:11 | table_header | |
| designPiles.col.pileSize | `Size` | `ขนาด` | PilesTable.jsx:12 | table_header | |
| designPiles.col.diaMm | `Dia (mm)` | `เส้นผ่านศูนย์กลาง` | PilesTable.jsx:13 | table_header | |
| designPiles.col.pileTopLevel | `Top Level` | `ระดับหัวเข็ม` | PilesTable.jsx:14 | table_header | |
| designPiles.col.seaBedLevel | `Seabed Level` | `ระดับท้องทะเล` | PilesTable.jsx:15 | table_header | |
| designPiles.col.pileToeLevel | `Toe Level` | `ระดับปลายเข็ม` | PilesTable.jsx:16 | table_header | |
| designPiles.col.lengthM | `Length (m)` | `ความยาว` | PilesTable.jsx:17 | table_header | |
| designPiles.col.incline | `Incline` | `ความเอียง` | PilesTable.jsx:18 | table_header | |
| designPiles.col.coordinatePn | `PN` | `พิกัด N` | PilesTable.jsx:19 | table_header | |
| designPiles.col.coordinatePe | `PE` | `พิกัด E` | PilesTable.jsx:20 | table_header | |
| designPiles.col.coatingLengthM | `Coating (m)` | `ความยาวเคลือบ` | PilesTable.jsx:21 | table_header | |
| designPiles.col.batterBearingDeg | `Batter Az (°)` | `ทิศเอียง` | PilesTable.jsx:22 | table_header | |
| designPiles.col.note | `Note` | `หมายเหตุ` | PilesTable.jsx:23 | table_header | |
| designPiles.pageTitle | `Design Piles` | `เข็มออกแบบ` | PilesTable.jsx:151 | ui_label | |
| designPiles.addRowBtn | `+ Add row` | `เพิ่มแถว` | PilesTable.jsx:152 | button | |
| designPiles.importCsvBtn | `Import CSV` | `นำเข้า CSV` | PilesTable.jsx:155 | button | |
| designPiles.importingBtn | `Importing…` | — | PilesTable.jsx:155 | button | |
| designPiles.exportCsvBtn | `Export CSV` | `ส่งออก CSV` | PilesTable.jsx:160 | button | |
| designPiles.zoneLabel | `Zone` | `โซน` | PilesTable.jsx:166 | ui_label | |
| designPiles.zoneAll | `All` | `ทั้งหมด` | PilesTable.jsx:172 | button | |
| designPiles.zoneUnassigned | `—` | `ไม่ระบุ` | PilesTable.jsx:181 | ui_label | |
| designPiles.deleteBtn | `Delete` | `ลบ` | PilesTable.jsx:192,194 | button | |
| designPiles.confirmDelete | `Delete pile {{pileNo}}?` | `ลบเข็ม {{pileNo}}?` | PilesTable.jsx:89 | ui_label (window.confirm) | |
| designPiles.hasRecordsCannotDelete | `This pile has saved records and cannot be deleted` | `เข็มนี้มีบันทึกแล้ว ไม่สามารถลบได้` | PilesTable.jsx:93 | status | |
| designPiles.onlyOwnDelete | `Can only delete piles you created` | `ลบได้เฉพาะเข็มที่คุณสร้างเท่านั้น` | PilesTable.jsx:100 | status | |
| designPiles.deletedToast | `Deleted {{pileNo}}` | `ลบ {{pileNo}} แล้ว` | PilesTable.jsx:104 | status | |
| designPiles.emptyFileMsg | `Empty file` | `ไฟล์ว่างเปล่า` | PilesTable.jsx:112 | status | |
| designPiles.importResultMsg | `{{n}} inserted, {{skipped}} skipped` | `เพิ่ม {{n}} ข้าม {{skipped}} แถว` | PilesTable.jsx:134,145 | status (template) | |
| designPiles.importFailedMsg | `Import failed` | `นำเข้าไม่สำเร็จ` | PilesTable.jsx:143 | status | |

---

## benchmarks.* — BenchmarksTable.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| benchmarks.col.name | `Name` | `ชื่อหมุด` | BenchmarksTable.jsx:10 | table_header | |
| benchmarks.col.northing | `Northing` | `พิกัด N` | BenchmarksTable.jsx:11 | table_header | |
| benchmarks.col.easting | `Easting` | `พิกัด E` | BenchmarksTable.jsx:12 | table_header | |
| benchmarks.col.elevation | `Elevation` | `ระดับ` | BenchmarksTable.jsx:13 | table_header | |
| benchmarks.col.type | `Type` | `ประเภท` | BenchmarksTable.jsx:14 | table_header | |
| benchmarks.col.active | `Active` | `ใช้งาน` | BenchmarksTable.jsx:15 | table_header | |
| benchmarks.col.note | `Note` | `หมายเหตุ` | BenchmarksTable.jsx:16 | table_header | |
| benchmarks.pageTitle | `Benchmarks` | `หมุดอ้างอิง` | BenchmarksTable.jsx:123 | ui_label | |
| benchmarks.addRowBtn | `+ Add row` | `เพิ่มแถว` | BenchmarksTable.jsx:124 | button | |
| benchmarks.importCsvBtn | `Import CSV` | `นำเข้า CSV` | BenchmarksTable.jsx:127 | button | |
| benchmarks.importingBtn | `Importing…` | — | BenchmarksTable.jsx:127 | button | |
| benchmarks.exportCsvBtn | `Export CSV` | `ส่งออก CSV` | BenchmarksTable.jsx:132 | button | |
| benchmarks.deleteBtn | `Delete` | `ลบ` | BenchmarksTable.jsx:142,144 | button | |
| benchmarks.confirmDelete | `Delete benchmark {{name}}?` | `ลบหมุด {{name}}?` | BenchmarksTable.jsx:59 | ui_label (window.confirm) | |
| benchmarks.hasRecordsCannotDelete | `This benchmark has saved records and cannot be deleted` | `หมุดนี้มีบันทึกแล้ว ไม่สามารถลบได้` | BenchmarksTable.jsx:63 | status | |
| benchmarks.onlyOwnDelete | `Can only delete benchmarks you created` | `ลบได้เฉพาะหมุดที่คุณสร้างเท่านั้น` | BenchmarksTable.jsx:70 | status | |
| benchmarks.deletedToast | `Deleted {{name}}` | `ลบ {{name}} แล้ว` | BenchmarksTable.jsx:74 | status | |
| benchmarks.emptyFileMsg | `Empty file` | `ไฟล์ว่างเปล่า` | BenchmarksTable.jsx:82 | status | |
| benchmarks.importResultMsg | `{{n}} inserted, {{skipped}} skipped` | `เพิ่ม {{n}} ข้าม {{skipped}} แถว` | BenchmarksTable.jsx:106,117 | status (template) | |
| benchmarks.importFailedMsg | `Import failed` | `นำเข้าไม่สำเร็จ` | BenchmarksTable.jsx:115 | status | |

---

## settings.* — SettingsPage.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| settings.pageTitle | `Settings` | `ตั้งค่า` | SettingsPage.jsx:43 | ui_label | |
| settings.loadingLabel | `Loading…` | `กำลังโหลด` | SettingsPage.jsx:45 | ui_label | |
| settings.col.setting | `Setting` | `การตั้งค่า` | SettingsPage.jsx:15 | table_header | |
| settings.col.value | `Value` | `ค่า` | SettingsPage.jsx:16 | table_header | |
| settings.col.description | `Description` | `คำอธิบาย` | SettingsPage.jsx:17 | table_header | |
| settings.tolPosition | `Position tolerance (m)` | `ค่าเผื่อตำแหน่ง (ม.)` | SettingsPage.jsx:6 | ui_label | |
| settings.tolTilt | `Tilt tolerance (°)` | `ค่าเผื่อความเอียง (องศา)` | SettingsPage.jsx:7 | ui_label | |
| settings.tolResidual | `Residual tolerance (m)` | `ค่าเผื่อระยะเบี่ยงเบน P3 (ม.)` | SettingsPage.jsx:8 | ui_label | |
| settings.tolBs | `Backsight tolerance (m)` | `ค่าเผื่อหมุดหลัง (ม.)` | SettingsPage.jsx:9 | ui_label | |
| settings.tolCoatingEmbed | `Coating embed below seabed (m)` | `ระยะสีจมใต้ท้องทะเลขั้นต่ำ (ม.)` | SettingsPage.jsx:10 | ui_label | |
| settings.tolCrossCheck | `Cross-check tolerance (m)` | `ค่าเผื่อเทียบผู้สำรวจ (ม.)` | SettingsPage.jsx:11 | ui_label | |

Note: the `description` column's cell content comes from the `project_settings` DB table (`r.description`), not a static string — `data_value`, will not be translated.

---

## users.* — UsersPage.jsx

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| users.pageTitle | `Users` | `จัดการผู้ใช้` | UsersPage.jsx:50 | ui_label | |
| users.loadingLabel | `Loading…` | `กำลังโหลด` | UsersPage.jsx:52 | ui_label | |
| users.col.email | `Email` | — | UsersPage.jsx:57 | table_header | |
| users.col.role | `Role` | `บทบาท` | UsersPage.jsx:58 | table_header | |
| users.col.status | `Status` | `สถานะ` | UsersPage.jsx:59 | table_header | |
| users.col.created | `Created` | `สร้างเมื่อ` | UsersPage.jsx:60 | table_header | |
| users.col.actions | `Actions` | `การกระทำ` | UsersPage.jsx:61 | table_header | |
| users.youSuffix | `(you)` | — | UsersPage.jsx:69 | ui_label | |
| users.approveBtn | `Approve` | `อนุมัติ` | UsersPage.jsx:83 | button | |
| users.revokeBtn | `Revoke` | `ระงับ` | UsersPage.jsx:85 | button | |

Flag: the role `<select>` options (`viewer`/`recorder`/`admin`, UsersPage.jsx:4,76) and the raw `status` cell (`pending`/`approved`, line 79) render the DB enum value directly with no label mapping — `data_value` today. If these should show localized labels, that needs a new `users.role.*` / `users.status.*` label map, not just a `t()` wrap (flagging as a design decision, not doing it in this audit).

---

## report.* — src/reports/*.jsx

**Flag before the list:** this is a fixed-format printed/PDF/PNG engineering
report — rendered via `renderToStaticMarkup` outside the visible app (new
window / hidden iframe), not through the app's normal component tree. Two
things worth deciding before wiring these into `i18n.js`:
1. Whether the printed report should follow the app's TH/EN toggle at all, or
   stay a fixed bilingual template (like an official form) regardless of the
   user's UI language choice.
2. `useTranslation()` reads the global `i18n` singleton when there's no
   `<I18nextProvider>` in the tree, so `t()` calls should still resolve
   correctly here — but this hasn't been verified against `renderToStaticMarkup`
   specifically and is worth a smoke test before assuming it "just works".

| Key | EN | TH | File | Type | Missing lang |
|---|---|---|---|---|---|
| report.stageLabel.before | `Before driving` | `ก่อนตอก` | PileReport.jsx:6 (STAGE_LABEL) | stage_value | |
| report.stageLabel.after | `After driving` | `หลังตอก` | PileReport.jsx:7 (STAGE_LABEL) | stage_value | |
| report.pointLabel.p1 | `Point 1 — Top · จุดสูงสุด` | — | PileReport.jsx:33 (POINT_LABEL) | ui_label | |
| report.pointLabel.p3 | `Point 3 — Mid · จุดกลาง (cross-check)` | — | PileReport.jsx:34 | ui_label | |
| report.pointLabel.p2 | `Point 2 — Bottom · จุดต่ำสุด` | — | PileReport.jsx:35 | ui_label | |
| report.title | `AS-BUILT PILE REPORT` | — | PileReport.jsx:80 | ui_label | |
| report.subtitle | `Pile position check by Total Station` | `รายงานตรวจสอบตำแหน่งเสาเข็ม` | PileReport.jsx:81 | ui_label | |
| report.reportNoLabel | `Report No. :` | — | PileReport.jsx:84 | ui_label | |
| report.dateLabel | `Date :` | — | PileReport.jsx:85,238,240,242 | ui_label | |
| report.pageLabel | `Page 1 / 1` | — | PileReport.jsx:86 | ui_label | |
| report.projectLine | `Project : GULF MTP LNG RECEIVING TERMINAL PROJECT - Marine Works` | — | PileReport.jsx:91 | data_value (deployment-specific project name — probably belongs in Settings, not i18n) | |
| report.contractorConsultantLine | `Contractor : ____________ · Consultant : ____________` | — | PileReport.jsx:92 | ui_label | |
| report.band1PileInfo | `1. PILE INFORMATION (DESIGN)` | — | PileReport.jsx:95 | ui_label | |
| report.pileNoLabel | `Pile No.` | — | PileReport.jsx:97 | ui_label | |
| report.diameterLabel | `Diameter` | — | PileReport.jsx:98 | ui_label | |
| report.designNLabel | `Design N (PN)` | — | PileReport.jsx:99 | ui_label | |
| report.cutoffLabel | `Cut-off EL.` | — | PileReport.jsx:100 | ui_label | |
| report.inclineLabel | `Incline` | — | PileReport.jsx:101 | ui_label | |
| report.lengthLabel | `Length` | — | PileReport.jsx:102 | ui_label | |
| report.designELabel | `Design E (PE)` | — | PileReport.jsx:103 | ui_label | |
| report.pileTipDesignLabel | `Pile Tip Design` | `ปลายเข็มตามแบบ` | PileReport.jsx:104 | ui_label | |
| report.batterAzLabel | `Batter Az.` | — | PileReport.jsx:106 | ui_label | |
| report.batterAzHint | `(battered piles only` | `เฉพาะเข็มเอียง)` | PileReport.jsx:106 | ui_label | |
| report.band2SurveySetup | `2. SURVEY SETUP` | — | PileReport.jsx:111 | ui_label | |
| report.stationLabel | `Station (STN)` | — | PileReport.jsx:113 | ui_label | |
| report.backsightCheckLabel | `Backsight check` | — | PileReport.jsx:115 | ui_label | |
| report.backsightCheckHint | `(shown only if checked` | `แสดงเมื่อมีการเช็คเท่านั้น)` | PileReport.jsx:115 | ui_label | |
| report.bsTrue | `TRUE` | — | PileReport.jsx:117 | status_from_calculations (bsCheck) | |
| report.bsFalse | `FALSE` | — | PileReport.jsx:117 | status_from_calculations (bsCheck) | |
| report.stageFieldLabel | `Stage` | `ช่วง` | PileReport.jsx:120 | ui_label | |
| report.surveyedByLabel | `Surveyed by` | — | PileReport.jsx:121,237 | ui_label | |
| report.measuredAtLabel | `Measured at` | — | PileReport.jsx:122 | ui_label | |
| report.methodLabel | `Method` | — | PileReport.jsx:123 | ui_label | |
| report.methodValue | `Edge bisection (mean of left/right pan) at 2 points on pile surface + Point-3 mid cross-check` | — | PileReport.jsx:124 | ui_label | |
| report.crossCheckLabel | `Cross-check` | `เทียบกับผู้สำรวจอื่น` | PileReport.jsx:126 | ui_label | |
| report.crossCheckedAgainstMsg | `Cross-checked against {{count}} other survey(s): max diff {{diff}} m —` | — | PileReport.jsx:128 | ui_label (template) | |
| report.crossCheckOk | `OK` | — | PileReport.jsx:128 | status_from_calculations | |
| report.crossCheckCheck | `CHECK` | — | PileReport.jsx:128 | status_from_calculations | |
| report.surveyPointsHeader | `Survey points (on pile surface)` | `จุดวัดบนผิวเข็ม` | PileReport.jsx:135 | table_header | |
| report.col.northing | `Northing` | — | PileReport.jsx:136 | table_header | |
| report.col.easting | `Easting` | — | PileReport.jsx:137 | table_header | |
| report.col.elev | `Elev.` | — | PileReport.jsx:138 | table_header | |
| report.band3AsBuiltResult | `3. AS-BUILT RESULT @ DESIGN CUT-OFF LEVEL ({{level}})` | — | PileReport.jsx:151 | ui_label (template) | |
| report.col.item | `Item` | — | PileReport.jsx:155 | table_header | |
| report.col.value | `Value` | — | PileReport.jsx:155 | table_header | |
| report.col.remark | `Remark` | — | PileReport.jsx:155 | table_header | |
| report.asBuiltNorthingLabel | `As-built Northing` | — | PileReport.jsx:156 | ui_label | |
| report.asBuiltEastingLabel | `As-built Easting` | — | PileReport.jsx:157 | ui_label | |
| report.diffNorthingLabel | `Diff Northing` | — | PileReport.jsx:158 | ui_label | |
| report.diffEastingLabel | `Diff Easting` | — | PileReport.jsx:159 | ui_label | |
| report.totalDeviationLabel | `Total deviation` | — | PileReport.jsx:160 | ui_label | |
| report.toleranceRemark | `tolerance {{tol}} m` | — | PileReport.jsx:160,164 | ui_label (template) | |
| report.actualSlopeLabel | `Actual slope` | — | PileReport.jsx:161 | ui_label | |
| report.designSlopeRemark | `design {{slope}}` | — | PileReport.jsx:161 | ui_label (template) | |
| report.tiltDiffLabel | `Tilt diff from design` | — | PileReport.jsx:162 | ui_label | |
| report.p3ResidualLabel | `P3 residual (cross-check)` | — | PileReport.jsx:164 | ui_label | |
| report.headMovedLabel | `Head moved during driving` | — | PileReport.jsx:167 | ui_label | |
| report.beforeAfterRemark | `before → after` | — | PileReport.jsx:167 | ui_label | |
| report.positionStampLabel | `POSITION {{dev}} {{cmp}} {{tol}} m` | — | PileReport.jsx:175 | ui_label (template, `{{cmp}}` is `≤`/`>`, computed) | |
| report.slopeStampLabel | `SLOPE {{check}}` | — | PileReport.jsx:178 | status_from_calculations | |
| report.slopeVsRemark | `1:{{a}} vs {{b}}` | — | PileReport.jsx:179 | ui_label (template) | |
| report.p3StampLabel | `P3 {{check}}` | — | PileReport.jsx:182-183 | status_from_calculations | |
| report.residualRemark | `residual {{d}} m` | — | PileReport.jsx:184 | ui_label (template) | |
| report.bsStampLabel | `BS {{TRUE/FALSE}}` | — | PileReport.jsx:189 | status_from_calculations | |
| report.bsVerified | `setup verified` | — | PileReport.jsx:190 | ui_label | |
| report.bsReSetup | `re-setup station` | — | PileReport.jsx:190 | ui_label | |
| report.band4PileToe | `4. PILE TOE{{coatingSuffix}} (extended along actual axis){{coatingHint}}` | — | PileReport.jsx:206-208 | ui_label (template) | |
| report.coatingSuffixLabel | `& COATING` | — | PileReport.jsx:207 | ui_label | |
| report.coatingHint | `coating must embed ≥ {{tol}} m below seabed` | — | PileReport.jsx:207 | ui_label (template) | |
| report.toeNLabel | `Toe N` | — | PileReport.jsx:210 | ui_label | |
| report.toeELabel | `Toe E` | — | PileReport.jsx:211 | ui_label | |
| report.toeZLabel | `Toe Z` | — | PileReport.jsx:212 | ui_label | |
| report.coatingBottomLabel | `Coating bottom EL.` | — | PileReport.jsx:215 | ui_label | |
| report.seabedSourceLabel | `Seabed ({{source}})` | — | PileReport.jsx:216 | ui_label (template) | |
| report.marginToSeabedLabel | `Margin to seabed` | — | PileReport.jsx:217 | ui_label | |
| report.marginReqHint | `(req ≤ −{{tol}})` | — | PileReport.jsx:217 | ui_label (template) | |
| report.marginOk | `✔ OK` | — | PileReport.jsx:219 | status_from_calculations | |
| report.marginOver | `✘ OVER` | — | PileReport.jsx:219 | status_from_calculations | |
| report.notesLabel | `Notes` | `หมายเหตุ` | PileReport.jsx:226 | ui_label | |
| report.band5Approval | `5. APPROVAL` | — | PileReport.jsx:235 | ui_label | |
| report.surveyedBySig | `Surveyed by` | `ผู้สำรวจ` | PileReport.jsx:237 | ui_label | |
| report.checkedBySig | `Checked by` | `ผู้ตรวจสอบ` | PileReport.jsx:239 | ui_label | |
| report.approvedBySig | `Approved by` | `ผู้อนุมัติ` | PileReport.jsx:241 | ui_label | |
| report.footerGeneratedBy | `Generated by Pile Check · {{host}} · {{time}}` | — | PileReport.jsx:246 | ui_label (template) | |
| report.footerTolerances | `Tolerances : position {{a}} m · tilt {{b}}° · P3 residual {{c}} m · BS {{d}} m · coating embed ≥ {{e}} m below seabed` | — | PileReport.jsx:247 | ui_label (template) | |
| report.photoHeaderTitle | `AS-BUILT PILE REPORT — PHOTOS` | `รูปแนบ` | PhotoReportPage.jsx:20 | ui_label | |
| report.photoPageLabel | `Photo page {{n}} / {{total}}` | — | PhotoReportPage.jsx:22 | ui_label (template) | |
| report.popupBlockedMsg | `Popup blocked — allow popups for this site to print the report.` | `ป็อปอัปถูกบล็อก กรุณาอนุญาตเพื่อพิมพ์รายงาน` | printPileReport.jsx:43 | ui_label (window.alert) | |
| report.printWindowTitle | `As-Built Pile Report — {{pileNo}}` | — | printPileReport.jsx:52 | ui_label (`<title>` tag, low priority) | |

---

## Summary

- Every page/component is covered: nav ✓(done), PlanView (1 leftover found),
  ResultReadout (18 leftovers found — mostly NOT done despite batch-1 label),
  App.jsx, TopBarRefresh, DataTable, SearchSelect, PhotoGallery, DeviationPlanView,
  Login, SetNewPassword, FormPage, RecordsTable, RecordDetailModal, PilesTable,
  BenchmarksTable, SettingsPage, UsersPage, and all of `src/reports/*`.
- Computed/derived strings (GO NORTH/SOUTH/EAST/WEST, OK/OVER, TRUE/FALSE,
  moved N/S/E/W) are marked `status_from_calculations` — translate only at the
  render layer per your instruction, not inside `calculations.js`.
- Pure data values (pile_no, zone names, emails, role/status enum values, the
  DB-stored Settings `description` column, the hardcoded project name in the
  report) are marked `data_value` and intentionally excluded from translation.
- Found 4 independent hardcoded copies of "before/after driving" text
  (FormPage's `STAGE_BANNER`, FormPage's stage `<option>`s, RecordsTable's
  `STAGE_SHORT`, PileReport's `STAGE_LABEL`) plus PlanView's own copy — worth
  collapsing to shared keys instead of repeating per-file when implementing.
