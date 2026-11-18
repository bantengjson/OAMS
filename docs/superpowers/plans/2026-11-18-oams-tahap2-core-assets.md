# OAMS Tahap 2 (Core Asset Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assets with automatic Asset Codes, QR labels, photos/documents, a browser scanner, a public asset page, sticker printing, and dashboard statistics, on top of the Tahap 1 foundation.

**Architecture:** New backend modules `assets`, `files` (storage + upload validation), `qr`; a shared `OptionalAuth` path in the existing JWT guard; a `SettingsService` for `public_base_url`. Frontend adds the `/assets/*`, `/scan`, `/qr/print` pages inside the authenticated shell and a shell-less public page `/a/[token]`. Files live on disk under `UPLOADS_DIR`.

**Tech Stack:** as Tahap 1, plus backend `qrcode`, `sharp`, `file-type`, `@types/multer` (multer ships with `@nestjs/platform-express`); frontend `qr-scanner`, `qrcode`.

**Spec:** `docs/superpowers/specs/2026-11-18-oams-tahap2-core-assets-design.md` (+ `docs/BLUEPRINT.md`, `docs/tahap-1-foundation.md`).

## Global Constraints

- Everything in Tahap 1's Global Constraints still applies (ESM backend, `/api/v1`, error shape, pagination, Indonesian copy, no hard deletes of master data, audit every important change).
- Asset Code format `INV-{YYYY}-{NNNN}`: year of creation (Asia/Jakarta), number padded to at least 4 digits, per-year sequence, never reused, immutable.
- Public token: 32 random bytes base64url (43 chars). QR content: `${publicBaseUrl}/a/${token}`.
- Public (anonymous) asset fields are exactly: `assetCode, name, category{name}, brand, model, location{name, path}, status, condition, hasPhoto`. Nothing else.
- Upload limits: photos 10 MB (jpeg/png/webp), documents 20 MB (pdf, docx, xlsx, jpeg, png); MIME decided from content via `file-type`.
- Archived assets: excluded from lists unless `includeArchived=true`; `PATCH`, photo/document mutations and QR regenerate return 400 `Barang sudah diarsipkan.`
- Asset mutations are audited under module `assets` (`asset.created|updated|archived|unarchived|photo_added|photo_removed|photo_primary|document_added|document_removed`), QR under module `qr` (`qr.generated|regenerated|deactivated|activated|printed`).

## Review Focus

1. Two assets created at the same instant must receive different codes (sequence is atomic). Test in Task 1.
2. A file whose extension lies about its content (e.g. `.png` holding a PDF) must be rejected with 400, never stored. Test in Task 3.
3. A deactivated or unknown token must give the anonymous visitor a 404 with the Indonesian message and reveal nothing, while a regenerated token immediately invalidates the old one. Test in Task 4.
4. The anonymous public endpoint must never include price, vendor, serial number, responsible person, notes or documents, even when the asset has them. Test in Task 4.
5. A user with `assets.view` but without `assets.update` must be refused on photo/document upload and delete (403), and photo files must not be reachable without a token. Test in Task 3.

---

### Task 1: Schema, enums, Asset Code sequence, settings and uploads config

**Files:**
- Modify: `backend/prisma/schema.prisma`; Create: `backend/prisma/migrations/<ts>_tahap2_assets/migration.sql` (via `prisma migrate dev --name tahap2_assets`)
- Create: `backend/src/modules/assets/asset-code.ts`, `backend/src/modules/assets/asset-code.spec.ts`, `backend/src/common/settings/settings.module.ts`, `backend/src/common/settings/settings.service.ts`
- Modify: `backend/src/config/env.ts` (`PUBLIC_BASE_URL` optional url, `UPLOADS_DIR` default `./uploads`), `backend/.env`, `backend/.env.example`, root `.env.example`, `docker-compose.yml` (backend env `UPLOADS_DIR=/app/uploads`, `PUBLIC_BASE_URL=${PUBLIC_BASE_URL}`), `.gitignore` (`backend/uploads/`)
- Test: `backend/test/asset-code.e2e-spec.ts`

**Interfaces:**
- Prisma: enums `OwnershipType { OFFICE THIRD_PARTY }`, `AcquisitionMethod { PURCHASE GRANT LOAN OTHER }`, `AssetCondition { GOOD MINOR_DAMAGE MAJOR_DAMAGE UNUSABLE }`, `AssetStatus { AVAILABLE IN_USE STORED BORROWED UNDER_MAINTENANCE MISSING DISPOSED RETURNED }`; models `Asset` (fields of blueprint 5.2 in camelCase + `archivedAt`, `archivedById`, `archiveReason`, `createdById`, timestamps; relations category, location, department, responsibleUser, label, photos, documents; indexes on categoryId, locationId, status, condition, archivedAt), `AssetCodeSequence { year Int @id; lastNumber Int }`, `AssetLabel { id; assetId @unique; publicToken @unique VarChar(64); isActive; generatedAt; printedCount Int @default(0); lastPrintedAt?; revokedAt? }`, `AssetPhoto { id; assetId; fileName; originalName; mimeType; sizeBytes Int; width?; height?; isPrimary; caption?; uploadedById?; createdAt }`, `AssetDocument { id; assetId; fileName; originalName; mimeType; sizeBytes Int; title?; uploadedById?; createdAt }`.
- Produces `formatAssetCode(year: number, n: number): string` (`INV-2026-0007`, `INV-2026-12345`), `jakartaYear(date: Date): number`, and `AssetCodeService.next(tx: Prisma.TransactionClient, year: number): Promise<string>` using `INSERT INTO asset_code_sequences(year,last_number) VALUES($1,1) ON CONFLICT (year) DO UPDATE SET last_number = asset_code_sequences.last_number + 1 RETURNING last_number`.
- Produces `SettingsService.getPublicBaseUrl(): Promise<string>` (system_settings `public_base_url` → env `PUBLIC_BASE_URL` → `''`; trailing slash stripped) and `SettingsService.set(key, value, actorId)`.

- [ ] **Step 1: Unit tests** for `formatAssetCode` (padding 4, growth past 9999) and `jakartaYear` (`2026-12-31T17:30:00Z` → 2027). Run → FAIL.
- [ ] **Step 2: Schema + migration + generate**; implement `asset-code.ts`, `SettingsService`, env additions.
- [ ] **Step 3: e2e** `asset-code.e2e-spec.ts`: 25 parallel `AssetCodeService.next()` calls inside separate transactions yield 25 distinct consecutive codes for the year (review focus 1); a second year starts at 0001. Run → PASS.
- [ ] **Step 4:** unit + e2e + lint green. Commit `feat(backend): tahap 2 schema, asset code sequence, settings and upload config`.

---

### Task 2: Assets module (CRUD, filters, archive, history, statistics, user lookup)

**Files:**
- Create: `backend/src/modules/assets/{assets.module,assets.controller,assets.service,assets.mapper}.ts`, `dto/{asset.dto,create-asset.dto,update-asset.dto,asset-query.dto,archive-asset.dto,asset-statistics.dto}.ts`
- Modify: `backend/src/modules/users/users.controller.ts` + `users.service.ts` (`GET /users/lookup`), `backend/src/app.module.ts`
- Test: `backend/test/assets.e2e-spec.ts`

**Interfaces:**
- `AssetListItemDto { id, assetCode, name, category{id,code,name}, location{id,code,name,path}, department{id,code,name}|null, responsibleUser{id,fullName}|null, brand, model, condition, status, ownershipType, hasPhoto, isArchived, updatedAt }`; `AssetDetailDto extends AssetListItemDto { serialNumber, description, acquisitionMethod, acquisitionDate, purchasePrice: string|null, vendor, notes, archivedAt, archiveReason, archivedBy{id,fullName}|null, createdBy{id,fullName}|null, createdAt, photos: AssetPhotoDto[], documents: AssetDocumentDto[], label: { token, isActive, url, printedCount, lastPrintedAt, generatedAt } | null }`.
- `CreateAssetDto`: required `name, categoryId, locationId, ownershipType, acquisitionMethod, condition, status`; optional `brand, model, serialNumber, description, acquisitionDate (ISO date), purchasePrice (decimal string/number ≥ 0), vendor, departmentId, responsibleUserId, notes`. `UpdateAssetDto` = all optional (nullable where sensible). `ArchiveAssetDto { reason?: string }`.
- Service rules: category/location/department/responsible user must exist and be active (400 with Indonesian message naming the field); creation runs in one transaction: code → asset → label (token) → audit; `update` refuses archived; `archive`/`unarchive` set/clear `archivedAt`, audited with reason; `history(id, q)` = `AuditService.list({ entityId: id, module in ['assets','qr'] })` (extend `AuditLogQuery` with `modules?: string[]`); `statistics()` → `{ total, active, archived, byStatus: Record<AssetStatus, number>, byCondition: Record<AssetCondition, number>, byCategory: {id,name,count}[], byOffice: {id,name,count}[] (root OFFICE of each asset's location) }` excluding archived from everything but `archived`.
- `GET /assets` query: `search` (code, name, brand, model, serial), `categoryId`, `locationId` (includes descendants), `condition`, `status`, `ownershipType`, `departmentId`, `responsibleUserId`, `includeArchived`, `sort` in `name|assetCode|updatedAt|createdAt` + `order asc|desc`, pagination. Default sort `createdAt desc`.
- Endpoints: `GET /assets` (`assets.view`), `GET /assets/statistics` (`assets.view`), `POST /assets` (`assets.create`), `GET /assets/:id`, `PATCH /assets/:id` (`assets.update`), `POST /assets/:id/archive`, `POST /assets/:id/unarchive` (`assets.archive`), `GET /assets/:id/history` (`assets.view`); `GET /users/lookup?search` (`master_data.view`) → `{ id, fullName, email, department{name}|null }[]` (active only, max 20).

- [ ] **Step 1: e2e tests (RED)**: create → 201 with `assetCode` `INV-<year>-0001` pattern and a label token; second create gets next number; VIEWER `POST` → 403; invalid category → 400 `Kategori tidak ditemukan atau nonaktif.`; list filters (search by code fragment, by status, by locationId including child rooms, pagination meta); `PATCH` changes status/location; archive hides from list and blocks `PATCH` (400); `includeArchived=true` shows it; unarchive restores; `history` lists `asset.created`, `asset.updated`, `asset.archived`; `statistics` counts match; `users/lookup` works for ADMIN_INVENTARIS and excludes inactive users.
- [ ] **Step 2: Implement.** **Step 3:** suites + lint green. Commit `feat(backend): assets CRUD, filters, archive, history, statistics`.

---

### Task 3: Files — photos and documents

**Files:**
- Create: `backend/src/common/files/{files.module,storage.service,upload-validation}.ts`, `backend/src/common/files/upload-validation.spec.ts`, `backend/src/modules/assets/asset-files.controller.ts`, `backend/src/modules/assets/asset-files.service.ts`, `dto/{asset-photo.dto,asset-document.dto,upload-photo.dto,upload-document.dto}.ts`
- Test: `backend/test/asset-files.e2e-spec.ts`

**Interfaces:**
- `StorageService` (root = `UPLOADS_DIR`): `save(relativeDir, ext, buffer): Promise<{ fileName, absolutePath }>`, `resolve(relativeDir, fileName): string` (rejects `..`), `remove(relativeDir, fileName)`; dirs `assets/<assetId>/photos`, `assets/<assetId>/documents`.
- `detectUpload(buffer, allowed: AllowedKind): Promise<{ mime, ext }>` throwing 400 `Jenis berkas tidak didukung.`; `AllowedKind = 'photo' | 'document'`.
- Photos: `POST /assets/:id/photos` multipart `file` (+ `caption`), `assets.update`, processes with `sharp` → `<uuid>.webp` (max 1920) + `<uuid>.thumb.webp` (320), first photo becomes primary; `GET /assets/:id/photos/:photoId/file?variant=full|thumb` (`assets.view`, `Cache-Control: private, max-age=86400`); `POST /assets/:id/photos/:photoId/primary`; `DELETE /assets/:id/photos/:photoId` (promotes another photo to primary if needed). Documents: `POST /assets/:id/documents` (`file` + `title`), `GET /assets/:id/documents/:docId/file` (attachment with original name), `DELETE`. Multer memory storage with per-route size limits (`limits.fileSize`), 413 → mapped to 400 `Ukuran berkas melebihi batas.`
- DTOs: `AssetPhotoDto { id, isPrimary, caption, width, height, sizeBytes, createdAt, urls: { full, thumb } }` (relative API paths), `AssetDocumentDto { id, title, originalName, mimeType, sizeBytes, createdAt, url }`.

- [ ] **Step 1: Unit test (RED)** `detectUpload`: PNG buffer (from `sharp`) accepted as photo; `%PDF-1.4` buffer accepted as document but rejected as photo; random bytes rejected.
- [ ] **Step 2: e2e (RED)**: upload PNG → 201, `isPrimary` true, `thumb` and `full` downloadable with `image/webp`; second upload not primary, `primary` endpoint switches; a `.png`-named PDF → 400 (review focus 2); 11 MB photo → 400 size message; VIEWER upload → 403 and unauthenticated file GET → 401 (review focus 5); delete removes the row and the file (`fs.existsSync` false); document upload/download sets `Content-Disposition` with the original name; archived asset → 400 on upload.
- [ ] **Step 3: Implement.** **Step 4:** green. Commit `feat(backend): asset photos and documents with content-type validation`.

---

### Task 4: QR module and public endpoint

**Files:**
- Create: `backend/src/modules/qr/{qr.module,qr.controller,qr.service,public-asset.mapper}.ts`, `dto/{qr-info.dto,bulk-qr.dto,public-asset.dto}.ts`, `backend/src/modules/qr/public-asset.mapper.spec.ts`, `backend/src/common/auth/optional-auth.decorator.ts`
- Modify: `backend/src/common/auth/jwt-auth.guard.ts` (honour `IS_OPTIONAL_AUTH_KEY`: no header → continue anonymous; header present → full validation), `backend/src/app.module.ts`
- Test: `backend/test/qr.e2e-spec.ts`

**Interfaces:**
- `QrInfoDto { token, url, isActive, generatedAt, printedCount, lastPrintedAt }`; `GET /assets/:id/qr` (`assets.view`), `POST /assets/:id/qr/regenerate`, `POST /assets/:id/qr/deactivate`, `POST /assets/:id/qr/activate` (`qr.generate`, audited), `GET /assets/:id/qr/download?format=png|svg&size=300..2000` (`assets.view`; PNG via `qrcode.toBuffer`, SVG via `qrcode.toString`, `Content-Disposition: attachment; filename="INV-2026-0001.png"`, error correction `M`, margin 1).
- `POST /qr/bulk-generate { assetIds: string[] (1..500) }` (`qr.generate`) → `{ items: { assetId, assetCode, name, token, url }[], skipped: { assetId, reason }[] }` (creates/reactivates missing labels, skips archived); `POST /qr/mark-printed { assetIds }` (`qr.generate`) → increments `printedCount`, sets `lastPrintedAt`, audits `qr.printed`.
- `GET /qr/public/:token` with `@Public()`-style `@OptionalAuth()` + throttler `auth` limit: anonymous or user without `assets.view` → `PublicAssetDto` (exact field list from Global Constraints); user with `assets.view` → `{ ...AssetDetailDto, isPublicView: false }`; unknown/inactive token or archived asset → 404 `QR Code tidak dikenal atau sudah tidak aktif.` `GET /qr/public/:token/photo?variant=thumb|full` → primary photo bytes or 404.
- `toPublicAsset(asset): PublicAssetDto` is a pure mapper.

- [ ] **Step 1: Unit (RED)** `toPublicAsset` includes exactly the allowed keys and nothing else (snapshot of `Object.keys`).
- [ ] **Step 2: e2e (RED)**: asset creation already produced a label; `GET /assets/:id/qr` url ends with `/a/<token>` and starts with the configured base URL; anonymous `GET /qr/public/:token` → 200 with only public keys and no `purchasePrice`/`serialNumber`/`notes` (review focus 4); with SUPER_ADMIN bearer → full detail; `deactivate` → anonymous 404 message; `activate` restores; `regenerate` → old token 404, new token 200 (review focus 3); archived asset → 404 publicly; `download` PNG has `image/png` and SVG contains `<svg`; `bulk-generate` returns items for existing labels and skips archived; `mark-printed` increments `printedCount`; 61 anonymous public calls from one IP → 429; public photo returns webp after upload.
- [ ] **Step 3: Implement.** **Step 4:** green. Commit `feat(backend): QR labels, downloads, bulk printing data and public asset endpoint`.

---

### Task 5: Frontend — assets list, create and edit

**Files:**
- Create: `frontend/src/lib/api/assets.ts`, `frontend/src/lib/api/qr.ts`, `frontend/src/lib/asset-labels.ts` (Indonesian labels/colors for enums), `frontend/src/features/assets/{asset-filters,asset-table,asset-form,location-select,user-lookup}.tsx`, `frontend/src/features/assets/asset-form.schema.ts` + `.test.ts`, pages `frontend/src/app/(app)/assets/page.tsx`, `assets/create/page.tsx`, `assets/[id]/edit/page.tsx`
- Modify: `frontend/src/types/api.ts` (Asset types + enums), `frontend/src/components/layout/nav-items.ts` (+ Inventaris `/assets` `assets.view`, Scan QR `/scan` `qr.scan`, Cetak QR `/qr/print` `qr.generate`, section "Inventaris"), `nav-items.test.ts`

**Interfaces:**
- `assetsApi.list(query)`, `get(id)`, `create(input)`, `update(id,input)`, `archive(id, reason)`, `unarchive(id)`, `history(id, q)`, `statistics()`, `uploadPhoto(id, file, caption?)`, `setPrimaryPhoto`, `deletePhoto`, `uploadDocument(id, file, title?)`, `deleteDocument`, `photoUrl(id, photoId, variant)`, `documentUrl(id, docId)`; `qrApi.info(id)`, `regenerate`, `deactivate`, `activate`, `downloadUrl(id, format, size)`, `bulkGenerate(ids)`, `markPrinted(ids)`, `publicAsset(token)`; `usersApi.lookup(search)`.
- Upload helper in `client.ts`: `apiUpload<T>(path, formData)` (no JSON content-type, same auth/refresh behaviour); `fetchBlob(path)` for authenticated downloads.
- `assetFormSchema` (zod) mirrors `CreateAssetDto`; `toCreatePayload(values)` converts empty strings to null/undefined and price to number.
- `LocationSelect`: `<select>` of active locations grouped by path (from `locationsApi.list({pageSize:100, isActive:true})`, paged until done). `UserLookup`: text input + debounced `usersApi.lookup`, shows name and department, clears to null.
- Pages: `/assets` list with filter bar (search, kategori, lokasi, status, kondisi, kepemilikan, "tampilkan arsip"), table columns kode, nama, kategori, lokasi, status badge, kondisi badge, PJ; row link to detail; "Tambah barang" for `assets.create`. `/assets/create` and `/assets/[id]/edit` share `AssetForm` (sections Identitas, Perolehan & Kepemilikan, Penempatan, Kondisi & Status, Catatan).

- [ ] **Step 1: Tests (RED)**: `asset-form.schema.test.ts` (required fields, price parsing `"1.500.000"` rejected / `"1500000"` ok, empty optional → null); `nav-items.test.ts` updated expectations (Petugas sees Inventaris + Scan QR; Admin also Cetak QR).
- [ ] **Step 2: Implement.** **Step 3:** vitest, tsc, eslint green; browser: create an asset end to end. Commit `feat(frontend): assets list, create and edit`.

---

### Task 6: Frontend — asset detail (info, photos, documents, QR, history, archive)

**Files:**
- Create: `frontend/src/features/assets/{asset-detail-header,asset-info,asset-photos,asset-documents,asset-qr-card,asset-history,archive-dialog}.tsx`, `frontend/src/components/ui/{tabs,file-drop}.tsx`, `frontend/src/lib/qr-image.ts` (+ `.test.ts`: `qrDataUrl(text, size)` wrapper around `qrcode.toDataURL`), page `frontend/src/app/(app)/assets/[id]/page.tsx`

**Interfaces:**
- Tabs: Informasi, Foto, Dokumen, QR Code, Riwayat. Header: code, name, status/condition badges, buttons Ubah (`assets.update`), Arsipkan/Buka arsip (`assets.archive`), Cetak QR (link to `/qr/print?ids=<id>`).
- Photos: grid with primary badge, upload via `FileDrop` (accept image/*, 10 MB), set primary, delete with confirm, lightbox-less preview (open full in new tab via blob URL). Documents: list with title, size, download (blob fetch), delete.
- QR card: client-rendered QR of `info.url`, token, status active/inactive, buttons unduh PNG, unduh SVG, regenerate (confirm: "stiker lama tidak berlaku"), nonaktifkan/aktifkan, counter dicetak.
- History: audit rows (action label in Indonesian, actor, time, expandable before/after).

- [ ] **Step 1: Test (RED)** `qr-image.test.ts` (`qrDataUrl('x', 200)` returns `data:image/png;base64,` string). **Step 2: Implement.** **Step 3:** green; browser: upload a photo, regenerate QR, archive and unarchive. Commit `feat(frontend): asset detail with photos, documents, QR and history`.

---

### Task 7: Frontend — scanner, public page, print sheet, dashboard statistics

**Files:**
- Create: `frontend/src/lib/scan.ts` (+ `.test.ts`: `parseScannedValue(text): { token } | null` accepting full URL `.../a/<token>`, path `/a/<token>`, or bare token of 43 base64url chars), `frontend/src/features/scan/qr-scanner-view.tsx`, page `frontend/src/app/(app)/scan/page.tsx`; `frontend/src/app/a/[token]/page.tsx` + `frontend/src/features/public/public-asset-card.tsx`; `frontend/src/lib/print-layout.ts` (+ `.test.ts`: `sheetLayout(sizeMm: 30|40): { columns, rows, perPage }` for A4 with 10 mm margins and 4 mm gap → 30 mm: 5×8=40, 40 mm: 4×6=24), `frontend/src/features/qr/print-sheet.tsx`, page `frontend/src/app/(app)/qr/print/page.tsx`, `frontend/src/app/print.css`; dashboard `frontend/src/app/(app)/dashboard/page.tsx` (statistics cards + status/condition bars)

**Interfaces:**
- `/scan`: `qr-scanner` on a `<video>`, camera picker, start/stop, decoded value → `parseScannedValue` → `router.push('/a/<token>')`; manual token/URL input; message when camera unavailable (non-HTTPS or no permission) pointing to manual input.
- `/a/[token]`: outside `(app)`; uses `useAuth` status: fetches `qrApi.publicAsset(token)` (bearer attached automatically when logged in); renders `PublicAssetCard` (anonymous shape) or the full detail link for staff; 404 state with the backend message; photo via `/api/v1/qr/public/<token>/photo?variant=full`.
- `/qr/print`: left: asset picker (search + checkboxes, preselect from `?ids=`); right: sticker size radio 30/40 mm, sheet preview using `sheetLayout`, "Cetak" → `bulkGenerate(ids)` → render pages → `window.print()` → on `afterprint` call `markPrinted(ids)` and toast. `print.css`: `@page { size: A4; margin: 10mm }`, `.sheet` grid in mm, `.no-print` hidden.
- Dashboard: cards total/aktif/diarsipkan + bars per status and per condition from `statistics` (shown when `assets.view`).

- [ ] **Step 1: Tests (RED)** `scan.test.ts`, `print-layout.test.ts`. **Step 2: Implement.** **Step 3:** green; browser: scan page renders manual input (camera may be absent), public page anonymous vs logged in, print preview shows 24 stickers for 40 mm. Commit `feat(frontend): QR scanner, public asset page, sticker printing and dashboard statistics`.

---

### Task 8: Docs, deployment config, review, server deploy

**Files:**
- Modify: `README.md` (uploads volume, `PUBLIC_BASE_URL`, printing tips, camera/HTTPS note), `docker-compose.yml` (env), create `docs/tahap-2-core-assets.md`
- Review: `superpowers:requesting-code-review` whole-range review (Tahap 1 head → Tahap 2 head) with the Review Focus list; fix Critical/Important by TDD.

- [ ] **Step 1:** `npm run lint && npm run build && npm test` green. **Step 2:** review + fixes, commit `fix: address review findings for Tahap 2`. **Step 3:** docs commit. **Step 4 (after the owner pushes):** on the server `git pull --ff-only && docker compose up -d --build`, set `PUBLIC_BASE_URL` in `.env`, verify `/assets`, `/a/<token>`, photo upload persists in the `uploads` volume across `docker compose restart backend`.
