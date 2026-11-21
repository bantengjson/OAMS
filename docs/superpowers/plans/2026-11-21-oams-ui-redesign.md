# OAMS UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every OAMS page into the approved light, lightly coloured enterprise look without touching the sidebar, features, routes or API contracts.

**Architecture:** New design tokens and the Inter font live in `globals.css`/`layout.tsx`; the sidebar keeps its old tokens through a `sidebar-legacy` wrapper in `AppShell`. Shared `components/ui` keep their props and gain new looks, plus a few new building blocks (StatTile, MetricStrip, StatusChips, FilterBar, ColumnMenu, SortableHeader, BulkBar, CSS charts). Pages are then restyled stage by stage; only logic that decides something (tones, column prefs, URL state, chips, activity rows, chart visibility) gets new pure functions with unit tests.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4 (`@theme inline` tokens), lucide-react, TanStack Query, Vitest; backend NestJS 12 + Prisma 7 (one statistics addition).

**Spec:** `docs/superpowers/specs/2026-11-20-oams-ui-redesign-design.md`

## Global Constraints

- `frontend/src/components/layout/sidebar.tsx` and `nav-items.ts` are not edited. Sidebar computed styles at 1440 px and 375 px (drawer open) must equal the baseline snapshot from Task 1.
- Tokens: page `#F7F8FA`, card `#FFFFFF`, primary `#2457D6` (hover `#1D47B5`), heading `#172033`, body `#475569`, secondary `#64748B`, border `#E2E8F0`, success `#16A36A`, warning `#D99A28`, danger `#DC5656`.
- Accent tones (fg/soft bg): blue `#2457D6/#EAF0FC`, green `#16A36A/#E7F6EF`, violet `#7C5CD6/#F0ECFB`, amber `#D99A28/#FCF3E2`, red `#DC5656/#FCEDED`, teal `#0E9AA7/#E3F5F6`, orange `#E07B39/#FCEFE5`, slate `#64748B/#EEF1F5`.
- Colour meaning (spec §7.2): status AVAILABLE green, IN_USE blue, STORED slate, BORROWED violet, UNDER_MAINTENANCE orange, MISSING red, DISPOSED slate, RETURNED teal; condition GOOD green, MINOR_DAMAGE amber, MAJOR_DAMAGE orange, UNUSABLE red; flows mutation violet, loan blue, overdue red, maintenance orange, damage report amber, disposal slate, opname teal.
- Type: Inter via `next/font/google`; page title 26 px semibold, section 16 px semibold, body 14 px, caption 12 px, numbers `tabular-nums`. Content padding 28–32 px desktop / 16 px phone, max width 1440 px. Card radius 11 px, button/input 8 px, card shadow `0 1px 2px rgba(16,24,40,.04)`.
- No new npm dependencies. No schema change. No route or API contract change (only the additive statistics fields of Task 3).
- No mock numbers: every figure comes from an API; missing data hides the block or shows an honest empty state.
- `frontend/src/app/print.css` and sticker layout files are not edited.
- UI copy stays Indonesian. Existing props of `components/ui` components stay valid.
- Commits: local only, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the owner pushes.
- Dev servers: reuse the owner's running `npm run dev` when up; anything I start is stopped fully afterwards.

## Review Focus

1. A Viewer or Petugas opens the dashboard: no 403 toasts, no empty KPI or activity panel; they see only blocks their permissions allow (Task 4 test `dashboardBlocks`).
2. A hand-edited inventory URL (`?status=FOO&page=-3&categoryId=abc&sort=evil`) opens the page with sane defaults instead of an error (Task 5 test `parseAssetQuery`).
3. Rows ticked under one filter must not be printed after the filter or page changes (Task 5 test `selectionFor`).
4. A fresh install with 0 assets: no `NaN%`, no division by zero, charts hidden or empty-state (Task 2 test `donutSegments`, Task 4 test `showYearChart`).
5. Category colours stay the same when counts or sort order change (Task 1 test `categoryTone`).

---

### Task 1: Tokens, font, sidebar lock, tones

**Files:**
- Modify: `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, `frontend/src/components/layout/app-shell.tsx`
- Create: `frontend/src/lib/tones.ts`, `frontend/src/lib/tones.test.ts`
- Workspace: `.superpowers/sdd/2026-11-21-oams-ui-redesign/sidebar-baseline.json`

**Interfaces:**
- Produces: `type Tone = 'blue'|'green'|'violet'|'amber'|'red'|'teal'|'orange'|'slate'`; `STATUS_TONE: Record<AssetStatus, Tone>`; `CONDITION_TONE: Record<AssetCondition, Tone>`; `FLOW_TONE: Record<'mutation'|'loan'|'overdue'|'maintenance'|'damageReport'|'disposal'|'opname', Tone>`; `categoryTone(categoryId: string): Tone`; `TONE_CLASS: Record<Tone, { text: string; bg: string; dot: string; border: string }>` (Tailwind class names using tokens `--color-tone-<t>` and `--color-tone-<t>-soft`).
- Produces CSS: `.sidebar-legacy` restoring old `--primary #1d4ed8`, `--primary-hover #1e40af`, `--primary-foreground #fff`, `--ring #2563eb`, `--sidebar*` values and the old system font stack; utility `font-inter` (`var(--font-inter)`).

- [ ] **Step 1: Record the sidebar baseline before any change.** On the owner's running dev app, run a browser script that collects `getComputedStyle` (backgroundColor, color, fontFamily, fontSize, fontWeight, lineHeight, padding, width, height, borderRadius) for: `aside`, logo square, "OAMS" text, every section label, an inactive item, the active item, the hover state of one item (hover via the tool), and the footer text, at 1440×900 and at 375×812 with the drawer open. Save as `sidebar-baseline.json` plus two screenshots. Expected: file written.
- [ ] **Step 2: Write `tones.test.ts`** with `expect(STATUS_TONE.BORROWED).toBe('violet')`, `STATUS_TONE.UNDER_MAINTENANCE` `'orange'`, `STATUS_TONE.DISPOSED` `'slate'`, `CONDITION_TONE.MINOR_DAMAGE` `'amber'`, `FLOW_TONE.overdue` `'red'`; `categoryTone(id)` returns the same tone on repeated calls and for the same id regardless of call order, and over 50 random uuids uses at least 6 distinct tones.
- [ ] **Step 3:** Run `npx vitest run src/lib/tones.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `lib/tones.ts` (categoryTone: stable string hash modulo the 8 tones); add tokens, tone colours, radii, shadow, `.sidebar-legacy` and `font-inter` to `globals.css`; load Inter in `layout.tsx` with `variable: '--font-inter'`; in `AppShell` wrap `<Sidebar>` in `<div className="sidebar-legacy contents">`, give the content column `font-inter`, set main padding `px-4 py-6 lg:px-8 lg:py-7` and inner `max-w-[1440px]`. Dialog and toast containers get `font-inter` where they render outside the column.
- [ ] **Step 5:** Run the tones test — Expected: PASS. Run `npx tsc --noEmit -p . && npm run lint`.
- [ ] **Step 6: Sidebar check:** repeat the Step 1 script; diff against the baseline. Expected: identical JSON; screenshots match.
- [ ] **Step 7: Commit** `feat(frontend): redesign tokens, Inter font and sidebar lock`.

### Task 2: Shared components

**Files:**
- Modify: `frontend/src/components/ui/{button,input,select,badge,card,tabs,dialog,confirm-dialog,alert,pagination,table,page-header,file-drop,spinner}.tsx`, `frontend/src/components/layout/{header,user-menu}.tsx`
- Create: `frontend/src/components/ui/{stat-tile,metric-strip,status-chips,filter-bar,column-menu,sortable-header,bulk-bar,icon-chip,charts}.tsx`, `frontend/src/lib/column-prefs.ts` (+ `.test.ts`), `frontend/src/components/ui/charts.test.ts`

**Interfaces:**
- Consumes: Task 1 tones.
- Produces:
  - `Badge` gains `tone?: Tone` (pill on soft background, no border); existing `variant` values keep working.
  - `PageHeader` gains `meta?: ReactNode`; renders the white card with a 4 px primary left accent.
  - `Table` wrapper: `relative`, `overflow-x-auto lg:overflow-visible`; `THead` cells sticky (`lg:sticky lg:top-16`) under the 64 px topbar.
  - `StatTile({ label, value, hint?, icon, tone, href?, loading?, error? })`; `MetricStrip({ items: { label, value, icon, tone, href?, emphasize?: boolean }[] })`; `IconChip({ icon, tone, size?: 'sm'|'md' })`.
  - `StatusChips<K extends string>({ items: { key: K; label: string; count: number; tone: Tone }[]; value: K; onChange })`.
  - `FilterBar({ children, right? })`; `BulkBar({ count, children, onClear })`; `SortableHeader({ label, field, sort, order, onSort })`.
  - `ColumnMenu({ columns: { key: string; label: string; required?: boolean }[]; visible: Set<string>; onChange })`.
  - `loadColumnPrefs(tableId: string, columns: ColumnDef[], defaults: string[]): Set<string>`, `saveColumnPrefs(tableId: string, visible: Set<string>): void` (key `oams.columns.<tableId>`).
  - `donutSegments(parts: { value: number; color: string }[]): string` (CSS `conic-gradient` argument); `DonutChart`, `BarList`, `ColumnChart` components.
- Header shows breadcrumb `OAMS / <active label>`; UserMenu shows initials avatar, name, role; behaviour unchanged.

- [ ] **Step 1: Write tests.** `column-prefs.test.ts`: no stored value → defaults; stored value with unknown key → key ignored; required column always present even if stored list omits it; corrupt JSON → defaults. `charts.test.ts`: `donutSegments([{value:90,color:'a'},{value:10,color:'b'}])` → `'a 0% 90%, b 90% 100%'`; all zeros → `''`; never contains `NaN`.
- [ ] **Step 2:** Run both — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the restyles (props unchanged) and the new components to the spec §7–8 values; restyle `header.tsx`/`user-menu.tsx`.
- [ ] **Step 4:** Run `npx vitest run` — Expected: all PASS (existing tests included). `npx tsc --noEmit -p . && npm run lint`.
- [ ] **Step 5: Browser check** on the owner's dev app: dashboard, assets, one dialog, one toast at 1440 and 375; console has no new errors; sidebar diff still identical.
- [ ] **Step 6: Commit** `feat(frontend): redesigned shared components`.

### Task 3: Acquisition-year statistics (backend)

**Files:**
- Modify: `backend/src/modules/assets/assets.service.ts` (statistics), `backend/src/modules/assets/dto/asset-statistics.dto.ts`, `backend/test/assets.e2e-spec.ts` (or the statistics spec that exists), `frontend/src/types/api.ts` (`AssetStatistics`)

**Interfaces:**
- Produces: `AssetStatistics.byAcquisitionYear: { year: number; count: number }[]` (live assets with `acquisition_date`, year in Asia/Jakarta, ascending) and `AssetStatistics.withoutAcquisitionYear: number`.

- [ ] **Step 1: Write the e2e test** `statistics groups live assets by acquisition year`: create assets dated `2023-05-01`, `2023-12-31`, `2025-01-01`, one without a date, one archived dated 2024, one disposed dated 2024; expect `byAcquisitionYear` to contain `{year:2023,count:2}` and `{year:2025,count:1}` (plus whatever pre-existing data adds, asserted by delta), no 2024 entry from the archived/disposed ones, and `withoutAcquisitionYear` increased by 1.
- [ ] **Step 2:** Run `npx vitest run --config ./vitest.config.e2e.ts test/assets.e2e-spec.ts` — Expected: FAIL (field undefined).
- [ ] **Step 3: Implement** with one raw SQL `GROUP BY extract(year from acquisition_date)` over the same live-asset filter the statistics already use.
- [ ] **Step 4:** Run the spec — Expected: PASS; then the whole backend e2e suite — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(backend): acquisition-year statistics`.

### Task 4: Dashboard

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`, `frontend/src/features/dashboard/asset-statistics.tsx` (split as needed)
- Create: `frontend/src/features/dashboard/dashboard-model.ts` (+ `.test.ts`), `frontend/src/features/dashboard/recent-activity.tsx`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `dashboardBlocks(can: (perm: string) => boolean): { users: boolean; operations: { mutations: boolean; loans: boolean; maintenance: boolean }; activity: boolean }` — `users` needs `users.manage`; mutations `mutations.view`; loans `loans.view`; maintenance/disposal metrics `assets.view`; activity `audit_logs.view_all` or `audit_logs.view_operational`.
  - `showYearChart(rows: { year: number; count: number }[]): boolean` — true when at least 2 years have count > 0.
  - `toActivityRow(log: AuditLog): ActivityRow | null` where `ActivityRow = { id; at: string; label: string; tone: Tone; icon: LucideIcon; actor: string; assetId: string | null; assetText: string | null; status: { label: string; tone: Tone } | null }`; returns `null` for modules other than `assets`, `mutations`, `loans`, `maintenance`, `disposals`; label from `ASSET_ACTION_LABEL`; `assetText` from `name`/`assetCode` found in `after` or `before` when present; status for `mutation.requested` → Menunggu (amber), `mutation.approved` → Disetujui (green), `mutation.rejected` → Ditolak (red), `loan.created` → Dipinjam (violet), `maintenance.reported` → Dilaporkan (amber), others `null`.

- [ ] **Step 1: Write `dashboard-model.test.ts`**: Viewer-like permissions (`assets.view`, `loans.view`, `mutations.view`) → `users` false, `activity` false; Super Admin set → all true; `showYearChart([])` false, `[{2025,3}]` false, `[{2024,1},{2025,0}]` false, `[{2024,1},{2025,2}]` true; `toActivityRow` for module `auth` → null; for `mutation.approved` with `after: { name: 'Printer', assetCode: 'INV-2026-0001' }` → label `Mutasi disetujui`, status Disetujui/green, assetText `Printer · INV-2026-0001`.
- [ ] **Step 2:** Run it — Expected: FAIL.
- [ ] **Step 3: Implement** the model and the page per spec §9.1: page header with today's date (Jakarta), `GET /health` status pill, refresh button invalidating the dashboard queries; KPIs via `StatTile`; operations via `MetricStrip` (+ opname row when `openOpname`); Kondisi `DonutChart` whose segments link to `/assets?condition=…`; Per kategori `BarList` top 8 coloured by `categoryTone`; Perolehan `ColumnChart` shown only when `showYearChart`, caption "N barang tanpa tahun perolehan"; activity table from `auditLogsApi.list({ pageSize: 30 })` mapped and cut to 8, only when `activity`. Remove the greeting card and the separate master-data count row (its counts move into KPIs).
- [ ] **Step 4:** Run `npx vitest run`, `npx tsc --noEmit -p .`, `npm run lint` — Expected: PASS.
- [ ] **Step 5: Browser check** as Super Admin and as `petugas` (dev account) at 1440/768/375: blocks match permissions, no 403 in network, console clean, every metric link opens the right list.
- [ ] **Step 6: Commit** `feat(frontend): redesigned dashboard`.

### Task 5: Inventory page

**Files:**
- Modify: `frontend/src/app/(app)/assets/page.tsx`, `frontend/src/features/assets/{asset-filters,asset-table}.tsx`
- Create: `frontend/src/features/assets/asset-list-state.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: Tasks 1–2; `assetsApi.list(AssetQuery)`, `assetsApi.statistics()`.
- Produces:
  - `parseAssetQuery(params: URLSearchParams): AssetListState` and `toSearchParams(state: AssetListState): URLSearchParams`, where `AssetListState = AssetFilterState & { sort: 'name'|'assetCode'|'updatedAt'|'createdAt'; order: 'asc'|'desc'; page: number }`; defaults `sort=createdAt`, `order=desc`, `page=1`; unknown enum values, non-uuid ids, non-positive or non-integer pages fall back to defaults; defaults are omitted when serialising.
  - `statusChipItems(stats: AssetStatistics): { key: AssetStatus | 'ALL'; label: string; count: number; tone: Tone }[]` — `ALL` (count `active`), each status with `byStatus[s] > 0` in `ASSET_STATUSES` order, then `DISPOSED` (count `disposed`) when > 0.
  - `selectionFor(sel: { key: string; ids: string[] }, key: string): string[]` — the ids only when `sel.key === key`, else `[]`; `key` is the serialised query.
- Column ids: `code` (required), `name` (required), `category`, `status`, `condition`, `responsible`, `department` (off by default), `updatedAt`; table id `assets`.

- [ ] **Step 1: Write `asset-list-state.test.ts`**: `parseAssetQuery(new URLSearchParams('status=FOO&page=-3&categoryId=abc&sort=evil&order=up'))` equals the defaults; a valid `status=BORROWED&condition=GOOD&sort=name&order=asc&page=2` round-trips through `toSearchParams` unchanged; `toSearchParams(defaults).toString() === ''`; `statusChipItems` with `byStatus {AVAILABLE:3, IN_USE:0}`, `active 3`, `disposed 2` → keys `['ALL','AVAILABLE','DISPOSED']`; `selectionFor({key:'a',ids:['1']},'b')` → `[]`.
- [ ] **Step 2:** Run it — Expected: FAIL.
- [ ] **Step 3: Implement** the model and the page per spec §9.2: state read from and written to the URL (`router.replace`, Suspense boundary for `useSearchParams`); StatusChips replace the status select (chip `DISPOSED` sets `status=DISPOSED`); FilterBar with search, category, condition, ownership, "Tampilkan arsip & dilepas", ColumnMenu; SortableHeader on code/name/updatedAt; row checkboxes + header checkbox for the page; BulkBar with "Cetak QR terpilih" → `/qr/print?ids=…` (only for holders of `qr.generate`, the permission the Cetak QR page uses); row click opens detail; Pagination shows "Menampilkan a–b dari n".
- [ ] **Step 4:** Run tests, tsc, lint — Expected: PASS.
- [ ] **Step 5: Browser check** 1440/768/375: chips filter, URL updates and reload restores the view, invalid URL shows defaults, selection clears on filter change, bulk print opens the print page with exactly the ticked ids, sticky header at 1440, horizontal scroll inside the card at 768, console clean.
- [ ] **Step 6: Commit** `feat(frontend): redesigned inventory page`.

### Task 6: Asset detail and forms

**Files:**
- Modify: `frontend/src/app/(app)/assets/{[id]/page,[id]/edit/page,create/page}.tsx`, `frontend/src/features/assets/*` (detail tabs, form, history, photos, documents, QR card), `frontend/src/app/(app)/{mutations/new,loans/new,disposals/new}/page.tsx` and their form components

**Interfaces:**
- Consumes: Tasks 1–2 components and tones. No new logic; existing tests must stay green.

- [ ] **Step 1: Restyle** per spec §9.3: detail header (code, name, status pill, condition dot, category), primary actions visible and the rest in a "Lainnya" menu below `lg`, banners in their flow tone, Informasi as 2–3 cards of label–value pairs; forms as sectioned cards with 2-column grid and a bottom action bar.
- [ ] **Step 2:** Run `npx vitest run`, tsc, lint — Expected: PASS.
- [ ] **Step 3: Browser check**: open a detail page, each tab, edit and save an asset, report damage, open a loan form and a disposal form (cancel before submit), at 1440 and 375; console clean.
- [ ] **Step 4: Commit** `feat(frontend): redesigned asset detail and forms`.

### Task 7: Operational pages

**Files:**
- Modify: `frontend/src/app/(app)/{mutations,loans,stock-opnames,maintenance,disposals}/**/page.tsx`, `frontend/src/app/(app)/{scan,qr/print}/page.tsx`, related `features/{mutations,loans,stock-opnames,maintenance,disposals,scan,qr}` components (screen styles only)

**Interfaces:**
- Consumes: Tasks 1–2 (PageHeader, Tabs/StatusChips, FilterBar, Table, Badge tones, MetricStrip for opname counters).

- [ ] **Step 1: Restyle** list pages to the Inventory pattern and detail pages to the asset-detail pattern; opname session stays phone-first; report and print page change on screen only.
- [ ] **Step 2:** Run tests, tsc, lint — Expected: PASS.
- [ ] **Step 3: Browser check** each list and detail page at 1440/768/375; open the opname report print preview and confirm A4 output is legible; open the QR print preview and confirm stickers are unchanged from before (compare with a screenshot taken before this task); console clean.
- [ ] **Step 4: Commit** `feat(frontend): redesigned operational pages`.

### Task 8: Master data, administration, profile, pages outside the shell

**Files:**
- Modify: `frontend/src/app/(app)/{categories,departments,employees,employees/[id],users,roles,audit-logs,profile,locations}/page.tsx`, related `features/*` components, `frontend/src/app/(auth)/{login,forgot-password}/page.tsx`, `frontend/src/app/a/[token]/page.tsx` and `features/public`

**Interfaces:**
- Consumes: Tasks 1–2; Audit Log rows reuse `toActivityRow`'s tone/icon mapping by module (Task 4).

- [ ] **Step 1: Restyle** per spec §9.5–9.6 (light-touch for login, forgot-password and the public QR page).
- [ ] **Step 2:** Run tests, tsc, lint — Expected: PASS.
- [ ] **Step 3: Browser check**: each page at 1440 and 375, one create/edit dialog per master-data page (cancel), roles matrix, audit-log filters, login and logout, public QR page of an active label; console clean.
- [ ] **Step 4: Commit** `feat(frontend): redesigned master data and admin pages`.

### Task 9: QA, review, docs

**Files:**
- Create: `docs/redesign-ui.md`; Modify: `README.md`

- [ ] **Step 1:** Root `npm run lint && npm run build && npm test` — Expected: all green.
- [ ] **Step 2: Visual QA pass** over every route at 1440/1024/768/375 as Super Admin and as `petugas`; fix layout regressions; final sidebar snapshot diff — Expected: identical to baseline.
- [ ] **Step 3: Final review** by one fresh reviewer on the most capable model over `git diff 349f33f..HEAD` with spec, Review Focus and ledger rulings; fix Critical/Important by TDD.
- [ ] **Step 4: Docs**: `docs/redesign-ui.md` (tokens, tones, components, where colour meanings live, sidebar lock, screenshots list) and a README pointer. Commit `docs: UI redesign documentation`.
- [ ] **Step 5 (after the owner pushes):** deploy (`ssh oams-server 'cd ~/oams && git pull --ff-only && docker compose up -d --build'`), check statistics migration-free deploy, pages respond, and the owner checks the look on the server.
