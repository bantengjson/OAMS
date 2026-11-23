# OAMS Format Inventaris Kantor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAMS adopts the office's own inventory format (numbered item types, rooms A–O, codes `NG.A/012/DPC/2023-01`, 3 conditions, group items for kitchenware, Excel-style report) and imports every item from the merged office list.

**Architecture:** Reuse `categories` as item types (golongan + number + isGroup) and `locations` of type `ROOM` as rooms; replace the per-year code sequence with a per-prefix one; add a separate `group_items` table plus opname count lines for kitchenware; a server-side `.xlsx` report (exceljs); a one-off import CLI that reads a JSON produced from the gitignored merge workbook.

**Tech Stack:** NestJS 12 (ESM) + Prisma 7 + PostgreSQL 17, Vitest (unit `npx vitest run`, e2e `npx vitest run --config ./vitest.config.e2e.ts`), Next.js 16 + React 19 + Tailwind 4 + TanStack Query, exceljs (new).

**Spec:** `docs/superpowers/specs/2026-11-23-oams-format-inventaris-kantor-design.md`

## Global Constraints

- All UI copy in Indonesian; condition labels exactly `Baik` / `Perlu Perbaikan` / `Rusak`; menu label `Jenis Barang`, new menu `Ruangan` (section Data Master). Sidebar **style** must not change (only nav items in `frontend/src/components/layout/nav-items.ts`).
- Code format `{golongan}{.room}/{type 3 digits}/{org}/{year|TT}-{unit}`; unit at least 2 digits (`-01`), grows to 3 after 99; no spaces; org from setting `asset_code_org`, default `DPC`.
- Vehicles (BG) and type NG 001 have no room letter; every other NG unit needs a room.
- Year: required when creating through API/UI; may be null only via the import; an existing year can never be cleared.
- Code corrections only while the label was never printed (`asset_labels.printed_count = 0`); after printing, `categoryId` and the registration room are locked (HTTP 409, message `Stiker sudah dicetak; jenis dan ruangan awal tidak bisa diubah. Arsipkan dan daftarkan ulang bila salah.`).
- Office name everywhere: `DPC PDI Perjuangan Kota Surabaya`.
- **Never commit office data**: nothing from `data-kantor/` or the office Excel enters git (repo is public). Test fixtures use invented names.
- Every user-visible change keeps existing per-unit flows (loans, mutations, opname, maintenance, disposal) working; group items never enter those flows.
- Backend in Bash needs `export PATH="/c/nvm4w/nodejs:$PATH"`. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit locally only; the user pushes.

## Review Focus

1. Two users creating units of the same type/room/year at the same moment must never get the same code → Task 4 concurrency test.
2. A client that edits `categoryId`/`locationId` through the API after the sticker was printed must be refused, not silently re-coded → Task 5 test `refuses jenis change after printing`.
3. Negative or non-integer quantities in group items or opname counts → 400 → Tasks 6 and 7 tests.
4. Running the import's write mode a second time must not wipe the real data → Task 11 test `refuses to run when office data already exists`.
5. Filling the year of a TT item after its sticker was printed keeps the printed code → Task 5 test `keeps code when year filled after printing`.

---

## File Structure

Backend
- `backend/prisma/schema.prisma` + one migration `…_office_format` — model changes (Task 1).
- `backend/src/database/seed.ts` — seed office root + rooms A–O + setting, no categories (Task 1).
- `backend/test/utils/fixtures.ts` (new) — test item types and rooms (Task 1).
- `backend/src/modules/categories/*` — item types (Task 2).
- `backend/src/modules/locations/rooms.controller.ts`, `rooms.service.ts`, `room-letter.ts` (new) — rooms (Task 3).
- `backend/src/modules/assets/asset-code.ts` — prefix codes (Task 4).
- `backend/src/modules/assets/assets.service.ts`, `dto/create-asset.dto.ts`, `dto/update-asset.dto.ts`, `assets.mapper.ts` — fields, multi-unit create, corrections (Task 5).
- `backend/src/modules/group-items/*` (new module) — group items (Task 6).
- `backend/src/modules/stock-opnames/*` — group count lines (Task 7).
- `backend/src/modules/assets/asset-statistics` code in `assets.service.ts` + `dto/asset-statistics.dto.ts` (Task 8).
- `backend/src/modules/reports/*` (new) — xlsx report (Task 9).
- `backend/src/database/import-office/*` (new) — import (Task 11).

Frontend
- `frontend/src/types/api.ts`, `lib/asset-labels.ts`, `lib/tones.ts` — conditions + new fields (Task 10).
- `frontend/src/app/(app)/categories/page.tsx`, `app/(app)/rooms/page.tsx` (new), `components/layout/nav-items.ts` (Task 10).
- `frontend/src/features/assets/*`, `app/(app)/assets/*`, `features/public/public-asset-card.tsx`, `lib/sticker-layout.ts`, mutation form (Task 12).
- `frontend/src/features/group-items/*` (new), opname pages, dashboard card, report button (Task 13).

Data tool (gitignored, not in repo): `data-kantor/merge.py` gains a JSON export (Task 11).

---

### Task 1: Data model switch

**Files:**
- Modify: `backend/prisma/schema.prisma`; Create: `backend/prisma/migrations/<timestamp>_office_format/migration.sql`
- Modify: `backend/src/database/seed.ts`, `backend/test/seed.e2e-spec.ts`
- Create: `backend/test/utils/fixtures.ts`
- Modify: every backend file and test that uses `brand`, `model`, `MINOR_DAMAGE`, `MAJOR_DAMAGE`, `UNUSABLE`, `KOMPUTER_IT`, or the old `asset_code_sequences` (find with `grep -rn`).

**Interfaces:**
- Produces (Prisma):
  - `enum ItemGolongan { BG NG }`
  - `Category` + `golongan ItemGolongan`, `number Int`, `isGroup Boolean @default(false) @map("is_group")`, `@@unique([golongan, number])`; `code` stays unique (`NG-012`).
  - `enum AssetCondition { GOOD NEEDS_REPAIR DAMAGED }` (data mapped: `MINOR_DAMAGE→NEEDS_REPAIR`, `MAJOR_DAMAGE|UNUSABLE→DAMAGED` in assets, asset_condition_logs, stock_opname_items, maintenance records — every column of that enum type).
  - `Asset` − `brand`, − `model`; + `specification String? @db.VarChar(500)` (migration copies `trim(concat_ws(' ', brand, model))`), + `acquisitionYear Int? @map("acquisition_year")` (copied from `acquisition_date` year), + `source String? @db.VarChar(300)`.
  - `AssetCodeSequence { prefix String @id @db.VarChar(40); lastNumber Int @map("last_number") }` (old rows dropped).
  - `GroupItem` (`group_items`): `id`, `categoryId`, `locationId` (required), `name VarChar(200)`, `specification String?`, `acquisitionYear Int?`, `source String?`, `qtyGood Int @default(0)`, `qtyNeedsRepair Int @default(0)`, `qtyDamaged Int @default(0)` (CHECK ≥ 0 in SQL), `notes String?`, `archivedAt`, `archiveReason`, `createdById`, timestamps; indexes on categoryId, locationId, archivedAt.
  - `StockOpnameGroupLine` (`stock_opname_group_lines`): `id`, `opnameId`, `groupItemId`, `expectedGood/NeedsRepair/Damaged Int`, `countedGood/NeedsRepair/Damaged Int?`, `countedAt DateTime?`, `countedById String?`; `@@unique([opnameId, groupItemId])`.
- Produces (seed): `seed()` creates root `Location { type: OFFICE, code: 'KANTOR', name: 'DPC PDI Perjuangan Kota Surabaya' }` and 15 `ROOM` children with codes/names `A Sekretariat, B Ketua, Sekretaris & Bendahara, C Bendahara, D Fraksi, E Rapat Internal, F Rapat Bersama, G Data & Pencetakan KTA, H Mushalla, I Dapur, J BBHAR, K Gudang, L Balai Kreasi, M Meja Satgas, N Ruang Tengah, O Halaman Parkiran` (idempotent upsert by code), and `system_settings` key `asset_code_org` = `"DPC"` if absent. `INITIAL_CATEGORIES` removed.
- Produces (tests): `test/utils/fixtures.ts` → `export async function testTypes(prisma): Promise<{ ng: Category; bg: Category; land: Category; group: Category; roomA: Location; roomB: Location }>` (idempotent: NG 900 "Barang Uji", BG 900 "Kendaraan Uji", NG 001 "Tanah Uji" only if NG 001 absent, NG 901 isGroup "Piring Uji"; rooms A and B from the seed).

- [ ] **Step 1:** Update `seed.e2e-spec.ts`: expect 15 rooms with codes `A`…`O` under root `KANTOR`, setting `asset_code_org` = `DPC`, and no categories created by the seed; running seed twice keeps 15 rooms.
- [ ] **Step 2:** Run `npx vitest run --config ./vitest.config.e2e.ts test/seed.e2e-spec.ts` — Expected: FAIL.
- [ ] **Step 3:** Edit schema, write the migration by hand (`prisma migrate dev --create-only`, then add the enum/data mapping SQL and CHECK constraints), `npx prisma generate`, update seed, add `fixtures.ts`, then fix compile errors and tests across the backend (`brand/model` → `specification`, condition names, `KOMPUTER_IT` → `testTypes()`, asset creates in tests now pass `locationId: roomA.id` and `acquisitionYear`).
- [ ] **Step 4:** Run `npx tsc --noEmit -p tsconfig.json && npx vitest run && npx vitest run --config ./vitest.config.e2e.ts` — Expected: all pass (asset-code e2e may be marked `.todo` until Task 4 only if it asserts the old `INV-` format; note it in the commit).
- [ ] **Step 5:** Commit `feat(backend): office format data model (item types, rooms, 3 conditions, group items)`.

### Task 2: Item types (Jenis Barang) API

**Files:** Modify `backend/src/modules/categories/{categories.service.ts,categories.controller.ts,dto/category.dto.ts}`; Test `backend/test/master-data.e2e-spec.ts` (or new `test/item-types.e2e-spec.ts`).

**Interfaces:**
- Produces: `CategoryDto` + `golongan: 'BG'|'NG'`, `number: number`, `isGroup: boolean`, `label: string` (`"NG 012 · Kursi Merah"`), `inUse: boolean`.
- `POST /categories` body `{ golongan, name, number?, isGroup?, description? }` — `number` defaults to max(number in golongan)+1; `code` set to `${golongan}-${pad3(number)}`.
- `PATCH /categories/:id` — `golongan`, `number`, `isGroup` only while no asset/group item uses the type; else 409 `Jenis sudah dipakai; golongan, nomor, dan jenis kelompok tidak bisa diubah.`
- `GET /categories` query `golongan?`, `isGroup?`; sorted golongan (BG first) then number.

- [ ] **Step 1:** e2e tests: `creates NG type with next number` (after NG 900 exists → 901), `rejects duplicate number in same golongan (409)`, `allows same number in other golongan`, `locks golongan/number/isGroup once used`, `filters by isGroup`.
- [ ] **Step 2:** Run the file — Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run — Expected: PASS.
- [ ] **Step 5:** Commit `feat(backend): numbered item types with golongan`.

### Task 3: Rooms API

**Files:** Create `backend/src/modules/locations/room-letter.ts`, `room-letter.spec.ts`, `rooms.controller.ts`, `rooms.service.ts`, `dto/room.dto.ts`; register in `locations.module.ts`; Test `backend/test/rooms.e2e-spec.ts`.

**Interfaces:**
- `export function nextRoomLetter(existing: readonly string[]): string` — A…Z, then AA, AB, … (bijective base-26 after the highest).
- `RoomDto { id, code, name, isActive, inUse }`.
- `GET /rooms` (any signed-in user with `assets.view`), `POST /rooms {name}` → next letter, `PATCH /rooms/:id {name}`, `POST /rooms/:id/activate|deactivate` (writes need `locations.manage`). Code never editable.
- Produces: `RoomsService.get(id)` used by Tasks 5 and 6 to validate `type === 'ROOM' && isActive`.

- [ ] **Step 1:** Unit tests: `nextRoomLetter(['A'..'O']) === 'P'`, `nextRoomLetter([...'A'..'Z']) === 'AA'`, `nextRoomLetter(['AZ', ...]) === 'BA'`, `nextRoomLetter([]) === 'A'`. e2e: `lists the 15 seeded rooms`, `adds room P`, `viewer cannot add (403)`, `deactivated room hidden from active list`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(backend): rooms A–O with automatic letters`.

### Task 4: Prefix-based asset codes

**Files:** Modify `backend/src/modules/assets/asset-code.ts`, `asset-code.spec.ts`, `backend/test/asset-code.e2e-spec.ts`.

**Interfaces:**
- `export interface CodeParts { golongan: 'BG'|'NG'; roomCode: string | null; typeNumber: number; org: string; year: number | null }`
- `export function codePrefix(p: CodeParts): string` → `NG.A/012/DPC/2023`, `BG/004/DPC/2023`, `NG.J/012/DPC/TT`.
- `export function formatAssetCode(prefix: string, unit: number): string` → `${prefix}-${String(unit).padStart(2,'0')}`.
- `AssetCodeService.next(tx, prefix: string): Promise<string>` — upsert-and-return on `asset_code_sequences(prefix)`.
- `AssetCodeService.org(tx): Promise<string>` — reads `asset_code_org`, default `DPC`.
- `GET /settings/asset-code-org` (`assets.view`) → `{ value }`; `PUT /settings/asset-code-org { value }` (`categories.manage`; 2–10 chars `A-Z0-9`, upper-cased; affects new codes only; audited `setting.asset_code_org_changed`). Controller/service in `backend/src/modules/assets/asset-code-settings.controller.ts`.

- [ ] **Step 1:** Unit: the three prefixes above; `formatAssetCode('NG.A/012/DPC/2023', 1) === 'NG.A/012/DPC/2023-01'`, unit 100 → `-100`. e2e: `numbers per prefix` (two prefixes each start at 01), `parallel creation gives unique codes` (6 concurrent `next` calls in separate transactions → 01..06, no duplicates), `org setting changes new codes only`, `viewer cannot change org (403)`, `org 'd p c' → 400`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(backend): office asset codes per prefix`.

### Task 5: Asset create, update and corrections

**Files:** Modify `assets.service.ts`, `dto/create-asset.dto.ts`, `dto/update-asset.dto.ts`, `dto/asset.dto.ts`, `assets.mapper.ts`, `assets.controller.ts`, `asset-query.dto.ts`; `qr/public-asset.mapper.ts` + `qr/dto/public-asset.dto.ts`; Test `backend/test/assets.e2e-spec.ts`, `backend/test/qr.e2e-spec.ts`.

**Interfaces:**
- `CreateAssetDto`: `categoryId` (non-group type), `locationId?` (rules below), `acquisitionYear` (int 1900–current year+1, required), `specification?`, `source?`, `serialNumber?`, `quantity?` (int 1–100, default 1), plus existing optional fields; `acquisitionMethod` no longer accepted from clients (derived: `source ? 'GRANT' : 'PURCHASE'`).
- Room rules: BG → `locationId` must be absent (400 `Kendaraan tidak memakai ruangan.`); NG number 1 → absent allowed; other NG → required active ROOM (400 `Ruangan wajib diisi.`); group type → 400 `Jenis ini untuk Barang Kelompok.`
- `POST /assets` → `CreatedAssetsDto { items: { id: string; assetCode: string }[] }`; all units in one transaction, codes consecutive, each with an `AssetLabel`; one audit entry per unit.
- `UpdateAssetDto`: `categoryId?`, `locationId?`, `acquisitionYear?` (number; `null` rejected when a year is stored), `specification?`, `source?`, … Correction rule: if `categoryId`/`locationId`/`acquisitionYear` change the prefix → when label `printedCount === 0` regenerate code via `next(tx, newPrefix)` and audit `asset.code_changed {from,to}`; else if `categoryId` or `locationId` changes → 409 (Global Constraints message); a year filled after printing just stores the year.
- `AssetDetailDto`/list: + `specification`, `acquisitionYear`, `source`, `type: { id, golongan, number, name }`, `room: { id, code, name } | null`; − `brand`, − `model`. Query filters `golongan?`, `categoryId?`, `locationId?`; search also matches `specification`, `serialNumber`.
- Public QR DTO: `specification`, `room: { code, name } | null` replace `brand`, `model`, `location`.

- [ ] **Step 1:** e2e tests: `creates 3 units with consecutive codes` (`NG.A/900/DPC/2025-01..03`), `vehicle code has no room` (`BG/900/DPC/2023-01`), `land without room` (NG 001), `NG without room → 400`, `BG with room → 400`, `group type → 400`, `year required → 400`, `source sets GRANT`, `corrects jenis before printing and re-codes`, `refuses jenis change after printing (409)`, `keeps code when year filled after printing`, `cannot clear a stored year (400)`, `mutation to room B keeps code`, `search finds by specification`, public QR shows room and specification.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** Run full backend unit + e2e — PASS.
- [ ] **Step 5:** Commit `feat(backend): office fields, multi-unit create and code corrections`.

### Task 6: Group items API

**Files:** Create `backend/src/modules/group-items/{group-items.module.ts,group-items.controller.ts,group-items.service.ts,group-code.ts,group-code.spec.ts,dto/group-item.dto.ts}`; register in `app.module.ts`; Test `backend/test/group-items.e2e-spec.ts`.

**Interfaces:**
- `groupCode(parts: CodeParts): string` = `codePrefix(parts)` from Task 4 (no unit), e.g. `NG.I/110/DPC/TT`.
- `GroupItemDto { id, code, type: {id, golongan, number, name}, room: {id, code, name}, name, specification, acquisitionYear, source, qtyGood, qtyNeedsRepair, qtyDamaged, total, notes, archivedAt, updatedAt }`.
- `GET /group-items` (`assets.view`; query `locationId?`, `categoryId?`, `search?`, `includeArchived?`), `GET /group-items/:id`, `POST /group-items` (`assets.create`; type must be `isGroup`; room required; year required), `PATCH /group-items/:id` (`assets.update`; body includes `reason` 3–500 chars, required), `POST /group-items/:id/archive {reason}` (`assets.archive`), `GET /group-items/:id/history` (audit entries for the row).
- Audit actions: `group_item.created`, `group_item.updated` (before/after + reason), `group_item.archived`, `group_item.opname_applied` (Task 7). Module `group_items`.
- Produces for Task 8: `GroupItemsService.summary(): Promise<{ types: number; units: number }>` (active rows).

- [ ] **Step 1:** e2e: `creates group item and shows code`, `non-group type → 400`, `negative quantity → 400`, `non-integer quantity → 400`, `update without reason → 400`, `update records before/after in history`, `viewer cannot create (403)`, `archive hides from default list`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(backend): group items for counted goods`.

### Task 7: Stock opname count lines for group items

**Files:** Modify `stock-opnames.service.ts`, `stock-opnames.controller.ts`, `dto/stock-opname.dto.ts`, `stock-opnames.mapper.ts`; Test `backend/test/stock-opnames.e2e-spec.ts`.

**Interfaces:**
- On opname create: one `StockOpnameGroupLine` per active group item, expected = current quantities.
- `GET /stock-opnames/:id/group-lines` → `OpnameGroupLineDto { id, groupItem: GroupItemDto-lite (code,name,room), expected: {good,needsRepair,damaged}, counted: {…} | null, countedAt, countedBy }`.
- `PUT /stock-opnames/:id/group-lines/:lineId` body `{ good, needsRepair, damaged }` (ints ≥ 0; only while opname OPEN; same permission as scanning).
- Close: each counted line whose counts differ → update the group item to counted values + audit `group_item.opname_applied {opnameId, before, after}`; uncounted lines leave the item unchanged. Report gains `groupLines: { matched, different, notCounted }` lists.

- [ ] **Step 1:** e2e: `opname includes group lines with expected counts`, `count update stored`, `negative count → 400`, `closing applies counted numbers`, `uncounted line keeps quantities and is reported as notCounted`, `counting after close → 409`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(backend): count group items in stock opname`.

### Task 8: Dashboard statistics

**Files:** Modify `assets.service.ts` (statistics), `dto/asset-statistics.dto.ts`; Test `backend/test/assets.e2e-spec.ts` (statistics block).

**Interfaces:** `AssetStatisticsDto.byCondition: Record<'GOOD'|'NEEDS_REPAIR'|'DAMAGED', number>`; `byCategory` items get `label` (`NG 012 · Kursi Merah`); new `byRoom: CountByRefDto[]` (name = `A · Sekretariat`); new `groupItems: { types: number; units: number }` from Task 6.

- [ ] **Step 1:** e2e asserts the new keys with fixture data. **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(backend): statistics by room and group items`.

### Task 9: Inventory report (.xlsx)

**Files:** Create `backend/src/modules/reports/{reports.module.ts,reports.controller.ts,inventory-report.ts,inventory-report.spec.ts,inventory-xlsx.ts}`; `npm i exceljs` in backend; Test `backend/test/reports.e2e-spec.ts`.

**Interfaces:**
- `export interface ReportUnit { golongan; typeNumber; typeName; roomCode: string|null; roomName: string|null; year: number|null; specification: string|null; condition: 'GOOD'|'NEEDS_REPAIR'|'DAMAGED'; present: boolean; source: string|null }` (present = not disposed).
- `export interface ReportGroup { golongan; typeNumber; typeName; roomCode; roomName; year; specification; source; good; needsRepair; damaged }`
- `export interface ReportRow { no: string; name: string; qty: number; years: string; specs: string; good: number; needsRepair: number; damaged: number; keterangan: 'Ada'|'Tidak Ada'; source: string }`
- `export function buildReportSections(units: ReportUnit[], groups: ReportGroup[], mode: 'per-room'|'overall'): { title: string; rows: ReportRow[] }[]` — sections: `A. INVENTARIS BARANG BERGERAK (KODE: BG)`, then `B. INVENTARIS BARANG TIDAK BERGERAK/TETAP (KODE: NG)` holding rows without room first, then (per-room) one section per room `RUANG SEKRETARIAT (KODE: A)` in letter order; rows sorted by type number; one row per (room, type, present) — present and disposed units of a type are separate rows (`Ada` / `Tidak Ada`); mixed values written `2025 (2), 2020 (2)` (descending count, then value), a single value plain; `TT` years shown as empty; sources joined `; `.
- `GET /reports/inventory?mode=per-room|overall` (`assets.view`) → `.xlsx` attachment `Daftar Inventaris DPC {YYYY-MM-DD}.xlsx`, header lines `DAFTAR INVENTARIS BARANG` / `DPC PDI PERJUANGAN KOTA SURABAYA` / `TAHUN {year}`, column headers as spec §8.8 (`SUMBER` replaces `KET.`); archived units excluded.

- [ ] **Step 1:** Unit tests on `buildReportSections`: mixed years/specs string, disposed unit row says `Tidak Ada`, group row counts, BG section first, room sections ordered, overall mode collapses rooms. e2e: endpoint returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, workbook opens with exceljs and cell A1 = `DAFTAR INVENTARIS BARANG`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(backend): Excel-style inventory report`.

### Task 10: Frontend foundations — conditions, item types, rooms, menu

**Files:** Modify `frontend/src/types/api.ts`, `lib/asset-labels.ts`, `lib/tones.ts` (+ tests), `components/layout/nav-items.ts` (+ test), `app/(app)/categories/page.tsx`; Create `lib/api/rooms.ts`, `app/(app)/rooms/page.tsx`, `features/rooms/room-form-dialog.tsx`; Modify `lib/api/categories.ts`.

**Interfaces:**
- `AssetCondition = 'GOOD' | 'NEEDS_REPAIR' | 'DAMAGED'`; labels `Baik`/`Perlu Perbaikan`/`Rusak`; tones green/amber/red.
- Nav: `/categories` label `Jenis Barang`; new `{ href: '/rooms', label: 'Ruangan', icon: DoorOpen, section: 'Data Master', permissions: ['locations.manage'] }` placed after Jenis Barang.
- Jenis Barang page: table No (`NG 012`), Nama, Golongan, Kelompok (ya/tidak), status; filter golongan; dialog fields golongan, nomor (prefilled next, editable while unused), nama, jenis kelompok.
- Rooms page: table Kode, Nama, status; add (letter shown as preview "Huruf berikutnya: P"), rename, activate/deactivate.

- [ ] **Step 1:** Unit tests: tones/labels for 3 conditions; nav item test expects `Ruangan` after `Jenis Barang`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npx vitest run && npx tsc --noEmit && npm run lint` — PASS.
- [ ] **Step 5:** Commit `feat(frontend): item types, rooms and 3 conditions`.

### Task 11: Import CLI

**Files:** Create `backend/src/database/import-office/{types.ts,plan.ts,plan.spec.ts,apply.ts,preview-xlsx.ts,cli.ts}`; Test `backend/test/import-office.e2e-spec.ts`. Outside git: extend `data-kantor/merge.py` with `--json data-kantor/import-data.json`.

**Interfaces:**
- `types.ts` — JSON written by merge.py:
  `ImportData { types: { golongan; number; name; isGroup }[]; rooms: { code; name }[]; rows: ImportRow[]; vehicles: VehicleRow[] }`;
  `ImportRow { golongan:'NG'; typeNumber; roomCode: string|null; name; qty: number|string|null; years: string|number|null; specs: string|null; good: number|null; needsRepair: number|null; damaged: number|null; source: string|null; keterangan: string|null; group: boolean; notes: string[]; origin: string }`;
  `VehicleRow { typeNumber; name; year; specification; serialNumber: string|null; oldPlates: string|null; source: string|null; disposed: boolean }`.
- `plan.ts`: `export function planImport(data: ImportData): ImportPlan` where `ImportPlan { types; rooms; units: PlannedUnit[]; groups: PlannedGroup[]; checks: { origin: string; message: string }[] }`. Rules (spec §8.9): qty → int or 1 + check; `"2025 (2), 2020 (2)"` split by parenthesised counts, paired in order with `"LG Dell (2), Lenovo (2)"`; years like `2023/2025`, `2022, 2025` without counts: spread evenly when qty divides, else TT + check; non-year text (e.g. `Nagata`) → TT + check (text kept in specification if spec empty); conditions: first `good` units GOOD, next NEEDS_REPAIR, rest DAMAGED; when good+needsRepair+damaged ≠ qty → all GOOD + check; `keterangan === 'Tidak Ada'` → `disposed: true`; status `IN_USE`; `source` → GRANT.
- `apply.ts`: `export async function applyImport(prisma, plan, opts: { wipe: boolean; actorId: string }): Promise<{ units: number; groups: number; disposed: number }>` — refuses (throws `Data kantor sudah ada; impor dibatalkan.`) when any asset whose code does not start with `INV-` exists; wipes asset-related tables and upload folders `assets/`; creates types, rooms (upsert), units with codes via `AssetCodeService`, labels, disposals (reason OTHER, description `Keterangan Excel: Tidak Ada`), group items; one audit `import.office {counts}`. Single transaction for DB writes (files removed after commit).
- `cli.ts`: `node dist/database/import-office/cli.js --data <import-data.json> [--write] --report <out.xlsx>`; default preview writes the report (sheets: Ringkasan, Barang (every planned unit with code), Barang Kelompok, Daftar Periksa) and touches nothing.

- [ ] **Step 1:** Unit tests (`plan.spec.ts`) with invented rows: mixed years/specs pairing; `2023/2025` qty 2 → one each; qty 3 → TT + check; `Nagata` → TT + check; condition split 5/0/1 of 6; mismatched conditions → all GOOD + check; `1 set` → 1 + check; disposed vehicle. e2e: `preview writes nothing`, `write creates units with office codes`, `refuses to run when office data already exists`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; extend merge.py JSON export (resolved type numbers, rooms, raw year/spec/condition strings per row, vehicles per decisions K4; `ASURANSI DJI OSMO` becomes a note on the DJI Osmo Pocket 4 row, `TOOLIFY` is left out; quantities: INVENTARIS PER RUANGAN, else UPDATE, else overall sheets). **Step 4:** PASS; run preview against `data-kantor/import-data.json` locally and check totals: per-room units equal merge workbook columns.
- [ ] **Step 5:** Commit (repo files only) `feat(backend): one-off office import with preview`.

### Task 12: Frontend assets — form, list, detail, mutation, QR

**Files:** Modify `features/assets/{asset-form.tsx,asset-form.schema.ts(+test),asset-table.tsx,asset-filters.tsx,asset-info.tsx,asset-list-state.ts(+test)}`, `app/(app)/assets/{create,[id]/edit,[id]}/page.tsx`, `features/public/public-asset-card.tsx`, `app/a/[token]/page.tsx`, mutation create form (find with `grep -rn toLocationId frontend/src`), `lib/sticker-layout.ts` (+ test), `features/assets/location-select.tsx` → room select.

**Interfaces:** consumes Task 5 DTOs. Form: Jenis (grouped BG/NG, non-group only), Ruangan (hidden for BG, optional for NG 001, required otherwise), Tahun (required on create; on edit required only if a year exists), Spesifikasi, Sumber (hint `Kosongkan bila dibeli`), Nomor seri / nomor polisi, Jumlah unit (create only, 1–100). On edit, if `label.printedCount > 0`: Jenis and Ruangan disabled with the Global Constraints message as hint. After create: 1 unit → detail page; more → inventory list with toast `{n} barang ditambahkan` and a button `Cetak QR` (opens `/qr/print?ids=…`). List: columns Kode, Nama, Jenis, Ruangan, Kondisi, Status; filters golongan, jenis, ruangan. Mutation form: room select re-enabled. Office name text in the app (`app/(auth)/layout.tsx`, `app/(app)/dashboard/page.tsx` description, `app/(app)/stock-opnames/[id]/report/page.tsx`, public QR page) becomes `DPC PDI Perjuangan Kota Surabaya`. Jenis Barang page shows `Kode organisasi: DPC` with an `Ubah` dialog for users with `categories.manage` (Task 4 endpoint). Sticker: code text auto-shrinks to fit width (`fitFontSize(text, maxWidthMm, baseSizePt)` in sticker-layout).

- [ ] **Step 1:** Unit tests: schema (year required on create, quantity 1–100, room rules by golongan), list-state filters round-trip, `fitFontSize('NG.A/012/DPC/2023-01', 26, 9) < 9`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npx vitest run && npx tsc --noEmit && npm run lint` — PASS.
- [ ] **Step 5:** Commit `feat(frontend): office fields, rooms and codes on assets`.

### Task 13: Frontend group items, opname counting, dashboard, report button

**Files:** Create `features/group-items/{group-item-table.tsx,group-item-form-dialog.tsx,group-item-history.tsx}`, `lib/api/group-items.ts`, `lib/api/reports.ts`; Modify `app/(app)/assets/page.tsx` (tabs `Barang` / `Barang Kelompok`, tab in URL `?tab=kelompok`), opname detail page + `features/stock-opnames/opname-group-lines.tsx` (new) + report, dashboard (`features/dashboard/asset-statistics.tsx` card `Barang Kelompok`), assets page header button `Unduh Daftar Inventaris` (menu: Per ruangan / Keseluruhan).

**Interfaces:** consumes Tasks 6–9. Group edit dialog requires `Alasan perubahan`. Opname counting: one row per group line with three number inputs and `Simpan`; badge `Belum dihitung`/`Sesuai`/`Selisih`.

- [ ] **Step 1:** Unit tests: tab state from URL, opname line badge function `groupLineState(line)` → `'pending'|'match'|'diff'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS (vitest, tsc, lint).
- [ ] **Step 5:** Commit `feat(frontend): group items, opname counting and inventory report`.

### Task 14: Docs, full verification, browser check

**Files:** Create `docs/format-inventaris-kantor.md` (codes, TT rule, corrections, rooms, group items, report, import runbook); Modify `README.md` pointer.

- [ ] **Step 1:** Run full backend unit + e2e, frontend vitest/tsc/lint — all PASS.
- [ ] **Step 2:** Browser check on the user's local stack (reuse it if running; otherwise start and stop own servers): create 3 units → codes `-01..-03`; vehicle without room; edit before/after print; group item edit with reason; opname count; download both report modes and open them; rooms and Jenis Barang pages; sidebar style unchanged (screenshot compare).
- [ ] **Step 3:** Commit `docs: office inventory format`.

### Task 15: Import and release (user-gated)

- [ ] **Step 1:** Locally: `pg_dump` backup, run import preview → give the user `data-kantor/Pratinjau Impor.xlsx`. **Stop until the user approves the preview.**
- [ ] **Step 2:** Local write import; user checks in the app. **Stop until approved.**
- [ ] **Step 3:** Ask the user to push; after "Sudah, deploy": server backup, `git pull --ff-only && docker compose up -d --build`, copy `import-data.json` to the server with `scp` (never into the repo), run preview in the backend container, then write after the user's go-ahead; verify counts and health.
