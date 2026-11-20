# OAMS Tahap 4 (Audit dan Maintenance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stock opname sessions with QR scanning and a result report, maintenance from report to completion, asset disposal with revert, and one shared status guard for every flow that changes an asset's status.

**Architecture:** New backend modules `stock-opnames`, `maintenance`, `disposals`, plus `AssetStateGuard` in the `assets` module that every status-changing flow (loans, mutations, maintenance, disposals, archive, PATCH status) calls inside its transaction and finishes with a conditional `updateMany` on the expected status. Partial unique indexes (one `OPEN` opname, one open maintenance per asset, one active disposal per asset) are raw SQL in the migration. Frontend adds three menus, a phone-friendly opname scanner page reusing the Tahap 2 `QrScannerView`, a Pemeliharaan tab and two actions on the asset detail page, and dashboard cards.

**Tech Stack:** as Tahap 3; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-20-oams-tahap4-audit-maintenance-design.md` (sections 13 holds the builder rulings; read it).

## Global Constraints

- Everything in Tahap 1–3 Global Constraints still applies (ESM `.js` suffixes, `/api/v1`, error shape, 400 `Validasi gagal.` + `errors`, pagination, Indonesian copy, audit every change with `entityId = assetId` for asset events, "today" = Asia/Jakarta via `common/dates/jakarta.ts`).
- Locations stay hidden: no location field, filter or result anywhere in Tahap 4.
- Statuses `UNDER_MAINTENANCE` and `DISPOSED` are set only by their flows; `MISSING` is not used. `POST /assets` and `PATCH /assets/:id` refuse `BORROWED`, `RETURNED`, `UNDER_MAINTENANCE`, `MISSING`, `DISPOSED`; message for the last three: `Status ini diatur oleh pemeliharaan/pelepasan`.
- 409 messages, verbatim: `Masih ada sesi stock opname yang terbuka.`, `Sesi stock opname sudah ditutup.`, `Anda bukan petugas sesi ini.`, `Sudah ada laporan pemeliharaan yang terbuka untuk barang ini.`, `Barang sedang diperbaiki.`, `Pemeliharaan sudah selesai.`, `Barang sudah dilepas.`, `Pelepasan sudah dibatalkan.`, plus the Tahap 3 ones (`Barang sudah diarsipkan.`, `Barang sedang dipinjam.`, `Sudah ada mutasi yang menunggu persetujuan.`).
- New permission `disposals.manage` (Super Admin, Admin Inventaris). Existing `stock_opnames.manage|execute`, `maintenance.manage|report` keep the Tahap 1 role matrix.
- Audit modules: `stock_opnames` (`opname.created|closed|cancelled` entity = session; `opname.scanned|confirmed|unregistered|condition_applied` entity = asset when known), `maintenance` (`maintenance.reported|started|completed|cancelled`), `disposals` (`disposal.created|reverted`). `ASSET_HISTORY_MODULES` gains all three.
- Commit after each task with trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push. Stop any dev servers you start (see memory: `pg_ctl stop`, kill the nest watcher tree, `preview_stop`).

## Review Focus

1. Loan, maintenance start and disposal fired at the same instant on one asset: exactly one succeeds, the asset ends in that flow's status, and no orphan open row remains. Test in Task 2.
2. An item borrowed or put into repair after the opname snapshot and never scanned must close as `ON_LOAN` / `IN_MAINTENANCE`, never `NOT_FOUND`. Test in Task 3.
3. Scanning the same QR twice, scanning by asset code, by full URL, and by bare token all hit the same row and never double-count. Test in Task 3.
4. Reverting a disposal whose QR label was already inactive before the disposal must leave the label inactive. Test in Task 5.
5. Completing maintenance on an asset whose `previous_status` was itself flow-managed (`BORROWED`, `UNDER_MAINTENANCE`, `DISPOSED`) restores `AVAILABLE`, never a flow status. Test in Task 4.

---

### Task 1: Schema, migration, permission, status rules

**Files:**
- Modify: `backend/prisma/schema.prisma`; Create: `backend/prisma/migrations/<ts>_tahap4_audit_maintenance/migration.sql` (via `prisma migrate dev --name tahap4_audit_maintenance --create-only`, then append SQL)
- Modify: `backend/src/common/auth/permissions.catalog.ts`, `backend/src/modules/assets/dto/create-asset.dto.ts`, `backend/src/modules/assets/dto/update-asset.dto.ts`
- Test: `backend/test/assets.e2e-spec.ts` (extend), `backend/test/seed.e2e-spec.ts` or `employees.e2e-spec.ts` (role grant)

**Interfaces:**
- Enums: `OpnameStatus { OPEN CLOSED CANCELLED }`, `OpnameResult { PENDING MATCHED CONDITION_DIFFERS NOT_FOUND UNREGISTERED ON_LOAN IN_MAINTENANCE REMOVED }`, `MaintenanceStatus { REPORTED IN_PROGRESS COMPLETED CANCELLED }`, `DisposalReason { BROKEN LOST SOLD DONATED OTHER }`; `ConditionSource` gains `OPNAME`, `MAINTENANCE`.
- Models per spec §7: `StockOpname` (+ `officers StockOpnameOfficer[]`), `StockOpnameOfficer { opnameId, userId, @@id([opnameId, userId]) }`, `StockOpnameItem`, `MaintenanceRecord`, `AssetDisposal` (+ `labelWasActive Boolean`). `AssetPhoto.maintenanceId String?` (FK, SetNull), `AssetDocument.disposalId String?` (FK, SetNull). `StockOpnameItem` unique `@@unique([opnameId, assetId])`.
- Appended SQL: `CREATE UNIQUE INDEX stock_opnames_one_open ON stock_opnames((true)) WHERE status = 'OPEN';`, `CREATE UNIQUE INDEX maintenance_one_open ON maintenance_records(asset_id) WHERE status IN ('REPORTED','IN_PROGRESS');`, `CREATE UNIQUE INDEX asset_disposals_one_active ON asset_disposals(asset_id) WHERE reverted_at IS NULL;`.
- Catalog: `PERMISSIONS.DISPOSALS_MANAGE = 'disposals.manage'` (module `disposals`, "Melepas barang dari inventaris"); Admin inherits via the exclusion filter; Petugas and Viewer do not get it.
- `create-asset.dto.ts`: `FLOW_STATUSES = [BORROWED, RETURNED, UNDER_MAINTENANCE, MISSING, DISPOSED]`; `CREATABLE_STATUSES` = all others; `STATUS_FLOW_MANAGED = 'Status ini diatur oleh pemeliharaan/pelepasan'`. Validation message: `BORROWED`/`RETURNED` keep `Status ini diatur oleh peminjaman`, the other three use the new message (custom validator `IsManualStatus` returning the right message per value).

- [ ] **Step 1: e2e (red)** in `assets.e2e-spec.ts`: POST with `status: 'DISPOSED'` → 400 `errors.status[0] === 'Status ini diatur oleh pemeliharaan/pelepasan'`; PATCH with `status: 'UNDER_MAINTENANCE'` → same; PATCH `BORROWED` still → `Status ini diatur oleh peminjaman`. Seed test: Admin role holds `disposals.manage`, Petugas does not. Run → FAIL.
- [ ] **Step 2:** schema, migration + SQL, `prisma generate`, catalog, DTO validator.
- [ ] **Step 3:** backend unit + e2e + lint green. Commit `feat(backend): tahap 4 schema, disposal permission and flow-managed statuses`.

---

### Task 2: AssetStateGuard and cross-flow locking

**Files:**
- Create: `backend/src/modules/assets/asset-state.guard.ts`, `backend/src/modules/assets/asset-state.guard.spec.ts`
- Modify: `assets.module.ts` (provide/export), `assets.service.ts` (archive, update status), `loans.service.ts` (create, return), `mutations.service.ts` (`assertMutable`, `applyApproval`)
- Test: `backend/test/asset-state.e2e-spec.ts`

**Interfaces:**
- `type AssetBlocker = 'archived' | 'borrowed' | 'pendingMutation' | 'inMaintenance' | 'disposed'`.
- `AssetStateGuard.load(db: Db, assetId: string): Promise<AssetState>` where `AssetState { id; status: AssetStatus; archivedAt: Date|null; activeLoanId: string|null; pendingMutationId: string|null; openMaintenance: {id; status: MaintenanceStatus}|null; activeDisposalId: string|null }` (404 `Barang tidak ditemukan.`).
- `AssetStateGuard.assertFree(state: AssetState, allow?: AssetBlocker[]): void` — throws 409 with the matching verbatim message in priority order archived → disposed → borrowed → inMaintenance (only `IN_PROGRESS` counts) → pendingMutation, skipping blockers listed in `allow`.
- `AssetStateGuard.setStatus(db: Db, assetId: string, from: AssetStatus, to: AssetStatus): Promise<void>` — `updateMany({ where: { id, status: from, archivedAt: null }, data: { status: to } })`, 409 `Barang sudah berubah, muat ulang lalu coba lagi.` when `count !== 1`.
- `restorableStatus(previous: AssetStatus): AssetStatus` — returns `previous` unless it is one of `FLOW_STATUSES`, then `AVAILABLE` (replaces the Tahap 3 inline fallback in loans).
- Loans: create uses `load` + `assertFree(state)` + `setStatus(state.status → BORROWED)` inside its transaction; return uses `setStatus(BORROWED → restorableStatus(prev))`. Mutations: `assertMutable` delegates to `assertFree(state, ['pendingMutation'])` on approve and `assertFree(state)` on request. Archive: `assertFree(state, ['disposed'])` (archiving a disposed asset stays allowed) with Tahap 3 archive messages kept for loan/mutation. PATCH status: `assertFree` for borrowed/inMaintenance/disposed then `setStatus(current → new)`.

- [ ] **Step 1: Unit tests (red)** `asset-state.guard.spec.ts`: `restorableStatus('IN_USE') === 'IN_USE'`, `restorableStatus('BORROWED') === 'AVAILABLE'`, `restorableStatus('DISPOSED') === 'AVAILABLE'`; `assertFree` priority (archived before borrowed) and `allow` skipping.
- [ ] **Step 2: e2e (red)** `asset-state.e2e-spec.ts`: on one fresh asset fire `POST /loans`, `POST /maintenance` + `start` (seed an open REPORTED row directly then call `start`), and `POST /disposals` concurrently with `Promise.all` → exactly one 2xx among the three status changers, the asset status equals that flow's status, and counts of active loan / in-progress maintenance / active disposal sum to 1 (Review Focus 1). Mark `it.todo` parts that need Tasks 4–5 routes and enable them in those tasks; the loan-vs-archive and loan-vs-PATCH-status races run now.
- [ ] **Step 3:** implement guard, refactor loans/mutations/assets to use it; all Tahap 3 e2e must stay green.
- [ ] **Step 4:** unit + e2e + lint green. Commit `refactor(backend): shared asset state guard with conditional status updates`.

---

### Task 3: Stock opname module

**Files:**
- Create: `backend/src/modules/stock-opnames/{stock-opnames.module,stock-opnames.controller,stock-opnames.service,stock-opnames.mapper,scan-value}.ts`, `scan-value.spec.ts`, `dto/*.ts`
- Modify: `backend/src/app.module.ts`, `assets.service.ts` (`ASSET_HISTORY_MODULES`, statistics `openOpname`), `asset-conditions.service.ts` (accept `OPNAME` source)
- Test: `backend/test/stock-opnames.e2e-spec.ts`

**Interfaces:**
- `parseScanValue(raw: string): { token: string } | { assetCode: string } | null` in `scan-value.ts`: bare 43-char token, `/a/<token>` path or URL → token; `INV-YYYY-NNNN+` (case-insensitive, trimmed) → assetCode; anything else null.
- `StockOpnameDto { id; name; notes; status; plannedDate: string; officers: {id; fullName}[]; counts: Record<OpnameResult, number>; total: number; scanned: number; createdBy; createdAt; closedBy; closedAt; cancelledAt }`; `OpnameItemDto { id; asset: {id; assetCode; name; category: {name}}|null; expectedCondition; observedCondition; result; scannedAt; scannedBy; rawValue; note; conditionAppliedAt }`; `ScanResultDto { item: OpnameItemDto; alreadyScanned: boolean }`.
- Service: `create(dto, actor)` (409 `Masih ada sesi stock opname yang terbuka.` via P2002 on `stock_opnames_one_open`; snapshot = all assets `archivedAt null` and status ≠ `DISPOSED`, one row each with `expectedCondition`, `expectedStatus`, `result: PENDING`), `list(q)`, `get(id)`, `items(id, q: {result?, search?})`, `scan(id, value, actor)`, `confirm(id, itemId, {observedCondition, note?}, actor)`, `close(id, actor)`, `cancel(id, actor)`, `applyCondition(id, itemId, actor)`, `report(id)`.
- `scan`: session must be `OPEN` (409 `Sesi stock opname sudah ditutup.`); if officers listed and actor not among them and lacks `stock_opnames.manage` → 403 `Anda bukan petugas sesi ini.`; resolve asset by token (`asset_labels.public_token`) or `assetCode`; row found → if `scannedAt` null set `scannedAt`, `scannedBy`, `observedCondition = expectedCondition`, `result = MATCHED`, return `alreadyScanned: false`; else return it with `alreadyScanned: true`. No row (unknown, archived, disposed, created after snapshot) → insert `UNREGISTERED` row with `rawValue`, `assetId` when known (note `Terdaftar setelah sesi dibuka` / `Barang diarsipkan` / `Barang sudah dilepas`), and the same raw value scanned twice returns the existing unregistered row with `alreadyScanned: true`.
- `confirm`: row must be scanned; `observedCondition === expectedCondition` → `MATCHED`, else `CONDITION_DIFFERS`; repeatable while `OPEN`.
- `close`: per `PENDING` row, using live state at close: active loan → `ON_LOAN`; maintenance `IN_PROGRESS` → `IN_MAINTENANCE`; asset archived or disposed → `REMOVED`; otherwise `NOT_FOUND`. Status `CLOSED`, `closedBy/At`.
- `applyCondition`: session `CLOSED`, row `CONDITION_DIFFERS`, `conditionAppliedAt` null, asset not archived/disposed → `AssetConditionsService.record(tx, assetId, {condition: observedCondition, notes: 'Stock opname: <name>', source: 'OPNAME'}, actor)`, store `conditionLogId`, `conditionAppliedAt`.
- `report`: `{ session: StockOpnameDto; groups: Record<'MATCHED'|'CONDITION_DIFFERS'|'NOT_FOUND'|'UNREGISTERED'|'ON_LOAN'|'IN_MAINTENANCE', OpnameItemDto[]> }` (REMOVED excluded from groups and from `total`).
- Routes per spec §8.1. GET routes need `stock_opnames.execute` **or** `stock_opnames.manage`: check in the service (`ForbiddenException(FORBIDDEN_MESSAGE)`), no decorator.
- Statistics: `openOpname: { id; name; scanned; total } | null`.

- [ ] **Step 1: Unit (red)** `scan-value.spec.ts`: token, `https://x/a/<token>`, `/a/<token>`, `inv-2026-0007 ` → `{ assetCode: 'INV-2026-0007' }`, `hello` → null.
- [ ] **Step 2: e2e (red)** `stock-opnames.e2e-spec.ts`: Admin creates (snapshot count = active non-disposed assets; second create → 409 verbatim); Petugas not listed as officer when officers are set → 403 verbatim; listed Petugas scans by URL, by token and by code → same item, second scan `alreadyScanned: true` and `scanned` count unchanged (Review Focus 3); confirm different condition → `CONDITION_DIFFERS`, confirm again same → `MATCHED`; unknown QR → `UNREGISTERED` once; asset borrowed after snapshot and asset put `IN_PROGRESS` after snapshot, both unscanned → close gives `ON_LOAN` / `IN_MAINTENANCE` (Review Focus 2; create the maintenance row directly if Task 4 is not done); remaining unscanned → `NOT_FOUND`; scan after close → 409 verbatim; `applyCondition` writes a condition log with source `OPNAME` and changes the asset condition, second call → 409; report groups exclude `REMOVED`; Viewer → 403 on list; history of a scanned asset contains `opname.scanned`.
- [ ] **Step 3:** implement; register module.
- [ ] **Step 4:** unit + e2e + lint green. Commit `feat(backend): stock opname sessions, scanning and report`.

---

### Task 4: Maintenance module

**Files:**
- Create: `backend/src/modules/maintenance/{maintenance.module,maintenance.controller,maintenance.service,maintenance.mapper}.ts`, `dto/*.ts`
- Modify: `app.module.ts`, `asset-files.service.ts` + `upload-file.dto.ts` (`maintenanceId`), `assets.mapper.ts` / `asset.dto.ts` (`openMaintenance` on detail), `assets.service.ts` (history modules, statistics `openMaintenance`, `inMaintenance`), `asset-state.e2e-spec.ts` (enable maintenance race)
- Test: `backend/test/maintenance.e2e-spec.ts`

**Interfaces:**
- `MaintenanceDto { id; status; asset: {id; assetCode; name}; description; reportedBy; reportedAt; technician; startedAt; startedBy; completedAt; completedBy; cost: string|null; technicianNotes; resultCondition; previousStatus; cancelledAt; cancelReason; photos: AssetPhotoDto[] }`.
- `AssetDetailDto.openMaintenance: { id; status: 'REPORTED'|'IN_PROGRESS'; description; reportedAt } | null`.
- Service: `list(q: {status?, assetId?, search?})`, `get(id)`, `report({assetId, description}, actor)` (asset not archived/disposed; P2002 on `maintenance_one_open` → 409 `Sudah ada laporan pemeliharaan yang terbuka untuk barang ini.`), `start(id, {technician?, startedAt?}, actor)` (only from `REPORTED`; guard `assertFree(state, ['inMaintenance'])` so a pending mutation or loan also blocks; store `previousStatus`, `setStatus(state.status → UNDER_MAINTENANCE)`), `complete(id, {completedAt?, cost?, technicianNotes?, resultCondition?}, actor)` (only `IN_PROGRESS`, else 409 `Pemeliharaan sudah selesai.`; `setStatus(UNDER_MAINTENANCE → restorableStatus(previousStatus))`; condition via `record(..., source: 'MAINTENANCE')` when given), `cancel(id, {reason}, actor)` (from `REPORTED` or `IN_PROGRESS`; the latter restores status).
- Photos: `addPhoto` accepts `maintenanceId` with the same rule as `conditionLogId` (holders of `maintenance.report` may attach to a maintenance row of the same asset).
- Loans and mutations on an `IN_PROGRESS` asset → 409 `Barang sedang diperbaiki.` (via guard).

- [ ] **Step 1: e2e (red)** `maintenance.e2e-spec.ts`: Petugas reports → 201 `REPORTED`, asset status unchanged; second report → 409 verbatim; Petugas start → 403; Admin start → asset `UNDER_MAINTENANCE`; loan / mutation request now → 409 `Barang sedang diperbaiki.`; complete with `resultCondition: 'GOOD'`, `cost: 250000` → asset status restored to `IN_USE`, condition log source `MAINTENANCE`; complete again → 409 verbatim; a record whose `previousStatus` was forced to `BORROWED` restores `AVAILABLE` (Review Focus 5); cancel from IN_PROGRESS restores status; Petugas photo with own `maintenanceId` → 201; history contains `maintenance.reported|started|completed`; Viewer may list (200). Enable the maintenance part of the Task 2 race. Run → FAIL.
- [ ] **Step 2:** implement; register module.
- [ ] **Step 3:** unit + e2e + lint green. Commit `feat(backend): maintenance records`.

---

### Task 5: Disposals module and QR lock

**Files:**
- Create: `backend/src/modules/disposals/{disposals.module,disposals.controller,disposals.service,disposals.mapper}.ts`, `dto/*.ts`
- Modify: `app.module.ts`, `qr.service.ts` (`setActive`, `regenerate`, `bulkGenerate` refuse/skip disposed), `asset-files.service.ts` + `upload-file.dto.ts` (`disposalId` on documents), `assets.service.ts` (list hides `DISPOSED` unless `status` filter or `includeArchived`; statistics `disposed`, `active` excludes disposed; history modules), `asset.dto.ts` (`activeDisposal` on detail), `asset-state.e2e-spec.ts` (enable disposal race)
- Test: `backend/test/disposals.e2e-spec.ts`

**Interfaces:**
- `DisposalDto { id; asset: {id; assetCode; name}; reason; disposedAt: string; description; value: string|null; recipient; previousStatus; labelWasActive; disposedBy; createdAt; revertedAt; revertedBy; revertReason; documents: AssetDocumentDto[] }`.
- `AssetDetailDto.activeDisposal: { id; reason; disposedAt: string } | null`.
- Service: `list(q: {reason?, search?, includeReverted?})`, `get(id)`, `create(dto, actor)` (guard `assertFree(state)`; P2002 on `asset_disposals_one_active` → 409 `Barang sudah dilepas.`; store `previousStatus`, `labelWasActive = label.isActive`; `setStatus(→ DISPOSED)`; label `isActive=false`; open `REPORTED` maintenance is cancelled with reason `Barang dilepas`), `revert(id, {reason}, actor)` (409 `Pelepasan sudah dibatalkan.` if reverted; `setStatus(DISPOSED → restorableStatus(previousStatus))`; label re-activated only if `labelWasActive`).
- `disposedAt`: calendar date, not in the future.
- QR: `setActive(true)`/`regenerate` on a disposed asset → 409 `Barang sudah dilepas.`; `bulkGenerate` puts disposed assets in `skipped` like archived ones.

- [ ] **Step 1: e2e (red)** `disposals.e2e-spec.ts`: Petugas → 403; Admin disposes with reason `SOLD`, `value: 1500000`, `recipient` → asset `DISPOSED`, QR public lookup 404, hidden from default `/assets` list but present with `?status=DISPOSED`, statistics `disposed` ≥ 1; QR activate / regenerate → 409 verbatim; disposing a borrowed asset → 409 `Barang sedang dipinjam.`; disposing an `IN_PROGRESS` asset → 409 `Barang sedang diperbaiki.`; revert → status restored, label active again; asset whose label was deactivated before disposal stays inactive after revert (Review Focus 4); revert twice → 409 verbatim; document upload with `disposalId`; history contains `disposal.created|reverted`. Enable the disposal part of the Task 2 race. Run → FAIL.
- [ ] **Step 2:** implement; register module.
- [ ] **Step 3:** unit + full e2e + lint green. Commit `feat(backend): asset disposals with revert and QR lock`.

---

### Task 6: Frontend — types, API clients, nav, maintenance and disposal pages, asset detail

**Files:**
- Modify: `frontend/src/types/api.ts`, `frontend/src/lib/api/assets.ts`, `frontend/src/lib/operation-labels.ts`, `frontend/src/lib/asset-labels.ts` (manual statuses), `frontend/src/components/layout/nav-items.ts` (+ test), `frontend/src/features/assets/asset-form.tsx` (status select excludes flow statuses), `frontend/src/features/assets/asset-history.tsx` (labels), `frontend/src/app/(app)/assets/[id]/page.tsx`
- Create: `frontend/src/lib/api/{maintenance,disposals,stock-opnames}.ts`, `frontend/src/features/maintenance/{maintenance-table,report-maintenance-dialog,maintenance-action-dialog,maintenance-status-badge}.tsx`, `frontend/src/features/disposals/{disposal-form,disposal-table,revert-disposal-dialog}.tsx`, `frontend/src/features/disposals/disposal-form.schema.ts` (+ test), `frontend/src/features/assets/asset-maintenance-tab.tsx`, `frontend/src/app/(app)/maintenance/{page,[id]/page}.tsx`, `frontend/src/app/(app)/disposals/{page,new/page,[id]/page}.tsx`

**Interfaces:**
- Types mirroring Tasks 3–5 DTOs: `StockOpname`, `OpnameItem`, `OpnameResult`, `ScanResult`, `OpnameReport`, `MaintenanceRecord`, `MaintenanceStatus`, `Disposal`, `DisposalReason`; `AssetDetail.openMaintenance`, `AssetDetail.activeDisposal`; `AssetStatistics.openMaintenance|inMaintenance|disposed|openOpname`.
- Labels: `MAINTENANCE_STATUS_LABEL` (`REPORTED: 'Dilaporkan', IN_PROGRESS: 'Dikerjakan', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan'`), `DISPOSAL_REASON_LABEL` (`BROKEN: 'Rusak total', LOST: 'Hilang', SOLD: 'Dijual', DONATED: 'Dihibahkan', OTHER: 'Lainnya'`), `OPNAME_RESULT_LABEL` (`MATCHED: 'Sesuai', CONDITION_DIFFERS: 'Kondisi berbeda', NOT_FOUND: 'Tidak ditemukan', UNREGISTERED: 'Tidak terdaftar', ON_LOAN: 'Sedang dipinjam', IN_MAINTENANCE: 'Dalam perbaikan', PENDING: 'Belum dipindai', REMOVED: 'Tidak dihitung'`); history labels for every audit action in Global Constraints.
- Nav (section Inventaris, after Peminjaman): `Stock Opname` `/stock-opnames` (`ClipboardList`, perms `stock_opnames.execute` or `stock_opnames.manage`), `Pemeliharaan` `/maintenance` (`Wrench`, `assets.view`), `Pelepasan` `/disposals` (`PackageX`, `disposals.manage`).
- `disposalFormSchema`: `{ assetId min1 'Pilih barang'; reason enum; disposedAt date ≤ today 'Tanggal tidak boleh di masa depan'; description min1 'Keterangan wajib diisi'; value numeric optional; recipient optional }`, `toDisposalPayload`.
- Asset detail: header buttons `Lapor kerusakan` (`maintenance.report`, hidden if archived/disposed or open maintenance exists) and `Lepaskan barang` (`disposals.manage`, → `/disposals/new?assetId=`); banners `Sedang diperbaiki sejak …` / `Ada laporan kerusakan: …` / `Barang sudah dilepas (alasan, tanggal)` with link; tab `maintenance` label `Pemeliharaan`; loan/mutation buttons disabled with title when in maintenance or disposed.
- `/maintenance`: tabs Dilaporkan | Dikerjakan | Selesai | Semua; actions Mulai / Selesaikan / Batalkan per row for `maintenance.manage` via `MaintenanceActionDialog({ record, mode: 'start'|'complete'|'cancel' })`; `ReportMaintenanceDialog({ asset? })` with description + `FileDrop` photos (uploads with `maintenanceId`).
- `/disposals/new`: `AssetPicker` + form + strong confirmation (`ConfirmDialog` "Barang akan keluar dari inventaris aktif dan QR-nya dinonaktifkan."); `/disposals/[id]` with `Batalkan pelepasan` (`RevertDisposalDialog`, reason required) and document upload.

- [ ] **Step 1: Unit (red)** `disposal-form.schema.test.ts` (future date error, description required, payload numeric value), nav test (Admin sees Stock Opname, Pemeliharaan, Pelepasan; Petugas sees Stock Opname and Pemeliharaan; Viewer sees Pemeliharaan only).
- [ ] **Step 2:** implement.
- [ ] **Step 3:** lint + build + test green; browser check (report → start → complete on an asset; dispose → revert), stop dev servers afterwards. Commit `feat(frontend): maintenance and disposal pages`.

---

### Task 7: Frontend — stock opname pages and dashboard

**Files:**
- Create: `frontend/src/app/(app)/stock-opnames/{page,[id]/page,[id]/report/page}.tsx`, `frontend/src/features/stock-opnames/{create-opname-dialog,opname-scanner,opname-item-list,opname-summary,opname-report}.tsx`, `frontend/src/features/stock-opnames/opname-summary.ts` (+ test)
- Modify: `frontend/src/features/dashboard/asset-statistics.tsx`

**Interfaces:**
- `opnameProgress(counts: Record<OpnameResult, number>): { scanned: number; total: number; percent: number }` (`total` = all rows except `REMOVED` and `UNREGISTERED`; `scanned` = `MATCHED` + `CONDITION_DIFFERS`; `percent` rounded, 0 when `total` is 0).
- `OpnameScanner({ opnameId, onScanned })`: `QrScannerView` (Tahap 2) + text input; sends raw value to `POST /stock-opnames/:id/scan`; shows last item card with condition radio + `Simpan` (confirm) and an `alreadyScanned` notice `Sudah dihitung pada …`; paused while a request is in flight; same QR within 3 s ignored client-side.
- `/stock-opnames`: table (Nama, Tanggal, Status, Progres `34/41`), `CreateOpnameDialog` (name, planned date default today, notes, officers multi-select of active users from `/users/lookup`, empty = any holder of `stock_opnames.execute`) for `stock_opnames.manage`.
- `/stock-opnames/[id]` OPEN: scanner (top, phone-first), counters, tabs Belum dipindai | Sudah dipindai | Tidak terdaftar; Admin buttons Tutup sesi / Batalkan (ConfirmDialog). CLOSED/CANCELLED: summary + link to report.
- `/stock-opnames/[id]/report`: groups per result with counts, rows, `Terapkan kondisi` button on `CONDITION_DIFFERS` rows for `stock_opnames.manage`, `Cetak` (`window.print()`, reuse `.no-print`).
- Dashboard: cards `Dalam perbaikan` (→ `/maintenance?status=IN_PROGRESS`), `Laporan kerusakan baru` (→ `/maintenance?status=REPORTED`), `Stock opname berjalan` (progress, → session) when `openOpname`.

- [ ] **Step 1: Unit (red)** `opname-summary.test.ts` for `opnameProgress`.
- [ ] **Step 2:** implement.
- [ ] **Step 3:** lint + build + test green; browser check at 375 px width (create session, scan by typed code, confirm a different condition, close, apply condition, print view); stop dev servers. Commit `feat(frontend): stock opname pages and dashboard cards`.

---

### Task 8: Docs, review, deploy

- [ ] **Step 1:** root `npm run lint && npm run build && npm test` green.
- [ ] **Step 2:** one fresh reviewer (most capable model) on `git diff 7771bda..HEAD` with spec, Review Focus and ledger rulings; fix Critical/Important by TDD; record deferred Minors.
- [ ] **Step 3:** `docs/tahap-4-audit-maintenance.md` (same structure as Tahap 3) and README updates; commit `docs: Tahap 4 audit and maintenance documentation`.
- [ ] **Step 4 (after the owner pushes):** server `git pull --ff-only && docker compose up -d --build`; smoke test (report → start → complete maintenance; dispose → revert; opname create → scan by code → close → report); archive/clean the test data afterwards.
