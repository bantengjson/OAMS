# OAMS Tahap 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the OAMS foundation: a monorepo with a NestJS 12 API (auth, RBAC, users, categories, locations, departments, audit log) on PostgreSQL via Prisma 7, a Next.js 16 dashboard in Indonesian, and Docker Compose deployment files, all tested.

**Architecture:** npm-workspaces monorepo (`backend`, `frontend`). Backend is an ESM NestJS modular monolith: `common/` holds Prisma, audit, auth guards and the HTTP error format; each business area is a module under `modules/` with controller / service / dto. Frontend is a client-rendered App Router app that calls the API through a same-origin `/api` rewrite, holds the access token in memory and relies on an HttpOnly refresh cookie. Local development and tests run PostgreSQL through `embedded-postgres`; the server runs the Compose stack.

**Tech Stack:** Node 24.22 LTS, TypeScript (6 backend / 5 frontend), NestJS 12 (ESM, Vitest, oxlint), Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 17, argon2, `@nestjs/jwt`, `@nestjs/swagger`, `@nestjs/throttler`, class-validator; Next.js 16, React 19.3, Tailwind 4, TanStack Query 5, react-hook-form + zod 4, Vitest + Testing Library; Docker Compose with Nginx.

**Spec:** `docs/superpowers/specs/2026-11-17-oams-tahap1-foundation-design.md` (and the master blueprint `docs/BLUEPRINT.md`).

## Global Constraints

- Node `24.22.3` pinned in `.nvmrc`; every `package.json` has `"engines": { "node": ">=24.15" }`.
- Backend is ESM (`"type": "module"`): relative imports end in `.js`, use `import.meta.dirname`, tests use Vitest (`vi.fn()`).
- All API routes live under `/api/v1`; Swagger UI at `/api/docs`.
- Error body shape everywhere: `{ statusCode: number; message: string; errors?: Record<string, string[]>; path: string; timestamp: string }`.
- List responses: `{ data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }`; `pageSize` max 100.
- Primary keys are UUID; timestamps `timestamptz` stored UTC; display timezone `Asia/Jakarta`.
- No hard deletes of users, roles, categories, locations, departments: use `isActive`. Audit log rows are never updated or deleted.
- Passwords hashed with Argon2id; access JWT lifetime 900 s; refresh token lifetime 7 days, rotated on every refresh, cookie `oams_refresh` HttpOnly, SameSite=Lax, Path=`/api/v1/auth`, Secure when `COOKIE_SECURE=true`.
- All user-facing strings (API messages and UI) in Indonesian.
- Role codes: `SUPER_ADMIN`, `ADMIN_INVENTARIS`, `PETUGAS_INVENTARIS`, `VIEWER`. Permission codes are `modul.aksi` strings from `permissions.catalog.ts`.
- Backend listens on 4000, frontend on 3000, local dev database on 5433.
- Commit after every task; never commit `.env`, `.pgdata`, `node_modules`, `dist`, `.next`, `src/generated`.

## Review Focus

1. Login of a deactivated user with the right password must be refused (403 `Akun dinonaktifkan. Hubungi administrator.`) and must not issue tokens. Test added to Task 5.
2. A refresh token presented a second time after rotation (replay) must be refused and must revoke every active session of that user. Test added to Task 5.
3. Creating a user whose email differs only by letter case from an existing one must return 409, so emails are normalised to lower case on write and on login. Test added to Task 7.
4. Any unique-constraint violation (duplicate category, department or location code) must surface as 409 with the offending field, never as 500. Test added to Task 8.
5. Deactivating the last active Super Admin, or removing that role from them, must be refused with 400 so the system can never lose its administrator. Test added to Task 7.

---

### Task 1: Repository skeleton

**Files:**
- Create: `package.json` (root, workspaces), `.nvmrc`, `.gitignore`, `.editorconfig`, `README.md`, `.env.example`
- Already present: `docs/BLUEPRINT.md`, `docs/superpowers/specs/2026-11-17-oams-tahap1-foundation-design.md`, this plan

**Interfaces:**
- Produces: root scripts `npm run dev:db`, `dev:backend`, `dev:frontend`, `test`, `build`, `lint` (each delegates with `npm run <x> -w backend` / `-w frontend`).

- [ ] **Step 1: Write root `package.json`** with `"private": true`, `"workspaces": ["backend", "frontend"]`, `"engines": { "node": ">=24.15" }`, and the scripts above (`test` runs `npm run test -w backend && npm run test:e2e -w backend && npm run test -w frontend`).
- [ ] **Step 2: Write `.nvmrc`** containing `24.22.3`; `.gitignore` covering `node_modules/`, `dist/`, `.next/`, `.env`, `.env.*.local`, `backend/.pgdata/`, `backend/src/generated/`, `coverage/`, `*.log`, `backups/`; `.editorconfig` (2-space, LF, UTF-8).
- [ ] **Step 3: Write `README.md`** (Indonesian): project name, stack, prerequisites (Node 24 via nvm, no Docker needed locally), local setup commands, test commands, link to blueprint, spec and plan, and a "Deployment" heading pointing at Task 14's instructions (fill in Task 14).
- [ ] **Step 4: Write root `.env.example`** with every variable Task 14's Compose uses: `POSTGRES_DB=oams`, `POSTGRES_USER=oams`, `POSTGRES_PASSWORD=`, `DATABASE_URL=postgresql://oams:${POSTGRES_PASSWORD}@postgres:5432/oams`, `JWT_ACCESS_SECRET=`, `JWT_ACCESS_TTL_SECONDS=900`, `REFRESH_TOKEN_TTL_DAYS=7`, `COOKIE_SECURE=true`, `APP_TIMEZONE=Asia/Jakarta`, `SEED_ADMIN_EMAIL=`, `SEED_ADMIN_PASSWORD=`, `SEED_ADMIN_NAME=Super Admin`, `PUBLIC_BASE_URL=https://inventaris.domainkantor.com`, `API_URL=http://backend:4000`.
- [ ] **Step 5: Verify** `git status` shows the files and `node -v` prints `v24.22.3`.
- [ ] **Step 6: Commit** `chore: bootstrap OAMS monorepo with blueprint, design and plan`.

---

### Task 2: Backend scaffold, config, error format, Swagger, health

**Files:**
- Create via CLI: `backend/` (`npx @nestjs/cli@12 new backend --skip-git --package-manager npm --language TS`, run from repo root, then delete `backend/src/app.controller*.ts`, `app.service.ts`, `test/app.e2e-spec.ts`, `AGENTS.md` and the `@nestjs/mau`/`deploy` entries)
- Create: `backend/src/config/env.ts`, `backend/src/config/config.module.ts`, `backend/src/app.setup.ts`, `backend/src/common/filters/http-exception.filter.ts`, `backend/src/common/dto/pagination.dto.ts`, `backend/src/common/dto/paginated.ts`, `backend/src/modules/health/health.controller.ts`, `backend/src/modules/health/health.module.ts`, `backend/.env.example`
- Modify: `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/package.json`
- Test: `backend/test/health.e2e-spec.ts`, `backend/src/common/filters/http-exception.filter.spec.ts`

**Interfaces:**
- Produces: `loadEnv(source?: NodeJS.ProcessEnv): Env` (zod-parsed, throws listing missing keys), `Env` type with fields `NODE_ENV`, `PORT` (default 4000), `DATABASE_URL`, `JWT_ACCESS_SECRET` (min 32 chars), `JWT_ACCESS_TTL_SECONDS` (default 900), `REFRESH_TOKEN_TTL_DAYS` (default 7), `COOKIE_SECURE` (boolean, default `NODE_ENV === 'production'`), `APP_TIMEZONE` (default `Asia/Jakarta`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`; injectable `EnvService` exposing `get<K extends keyof Env>(key: K): Env[K]`.
- Produces: `configureApp(app: INestApplication): INestApplication` (global prefix `api/v1`, `cookie-parser`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory })`, `HttpExceptionFilter`, `app.set('trust proxy', 1)`, Swagger at `/api/docs` with bearer auth) used by `main.ts` and the test harness.
- Produces: `PaginationQueryDto { page: number = 1; pageSize: number = 20 }` (`@Min(1)`, `@Max(100)`, transformed to numbers), `paginate<T>(data: T[], total: number, q: PaginationQueryDto): Paginated<T>`, type `Paginated<T>`.
- Produces: `HttpExceptionFilter` mapping `HttpException` → error shape; `Prisma.PrismaClientKnownRequestError` `P2002` → 409 `Data dengan nilai yang sama sudah ada.` with `errors: { [field]: ['Nilai sudah digunakan.'] }` (field from `meta.target`); `P2025` → 404 `Data tidak ditemukan.`; anything else → 500 `Terjadi kesalahan pada server.` (logged). Validation errors → 400 `Validasi gagal.` with `errors` grouped by property.

- [ ] **Step 1: Scaffold** with the CLI command above; keep its `tsconfig.json`, `vitest.config*.ts`, `.oxlintrc.json`, `.prettierrc`. Add deps: `@nestjs/config@^12 @nestjs/swagger@^12 class-validator@^0.15 class-transformer@^0.5 cookie-parser@^1.4 zod@^4 dotenv@^17` and dev `@types/cookie-parser tsx`. Set `"engines"` and the `test:e2e` script to `vitest run --config ./vitest.config.e2e.ts` (already there). `npm install` from repo root.
- [ ] **Step 2: Write failing unit test** `http-exception.filter.spec.ts`:

```ts
it('maps Prisma P2002 to 409 with the field name', () => {
  const err = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target: ['email'] } });
  const { status, body } = runFilter(err); // helper builds a fake ArgumentsHost capturing status/json
  expect(status).toBe(409);
  expect(body).toMatchObject({ statusCode: 409, message: 'Data dengan nilai yang sama sudah ada.', errors: { email: ['Nilai sudah digunakan.'] } });
});
it('maps HttpException with validation errors to the shared shape', () => {
  const { status, body } = runFilter(new BadRequestException({ message: 'Validasi gagal.', errors: { name: ['name harus diisi'] } }));
  expect(status).toBe(400);
  expect(body).toMatchObject({ statusCode: 400, message: 'Validasi gagal.', errors: { name: ['name harus diisi'] } });
  expect(typeof body.timestamp).toBe('string');
});
```
  (Until Task 3 installs `@prisma/client`, import `Prisma` from `@prisma/client` after adding it in Step 1 as well: `npm i @prisma/client@^7.10 -w backend`.)
- [ ] **Step 3: Run** `npm run test -w backend` → FAIL (filter missing).
- [ ] **Step 4: Implement** `env.ts`, `config.module.ts` (global module providing `EnvService` built from `loadEnv()`), `http-exception.filter.ts`, `pagination.dto.ts`, `paginated.ts`, `app.setup.ts`, `health.controller.ts` (`GET health` returns `{ status: 'ok', timestamp }`; Task 3 adds `database`), `main.ts` (`configureApp(await NestFactory.create(AppModule)); await app.listen(env.PORT)`).
- [ ] **Step 5: Write e2e test** `test/health.e2e-spec.ts` building the app with `Test.createTestingModule({ imports: [AppModule] })` + `configureApp`, asserting `GET /api/v1/health` → 200 `{ status: 'ok' }` and `GET /api/v1/nope` → 404 body with `statusCode: 404` and a `path` of `/api/v1/nope`. Provide required env vars in `vitest.config.e2e.ts` `test.env` (`DATABASE_URL` placeholder is fine until Task 3, `JWT_ACCESS_SECRET` 32+ chars).
- [ ] **Step 6: Run** `npm run test -w backend && npm run test:e2e -w backend` → PASS. `npm run lint -w backend` clean. Start `npm run start:dev -w backend` once and open `http://localhost:4000/api/docs` to confirm Swagger renders; stop it.
- [ ] **Step 7: Commit** `feat(backend): scaffold NestJS app with env config, error format, swagger and health`.

---

### Task 3: Prisma 7 schema, migrations, embedded PostgreSQL, seed, test harness

**Files:**
- Create: `backend/prisma.config.ts`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/*` (generated), `backend/prisma/seed.ts`, `backend/src/common/prisma/prisma.module.ts`, `backend/src/common/prisma/prisma.service.ts`, `backend/src/common/auth/permissions.catalog.ts`, `backend/scripts/dev-db.ts`, `backend/test/utils/embedded-db.ts`, `backend/test/global-setup.ts`, `backend/test/utils/app.ts`
- Modify: `backend/package.json` (scripts `prisma:generate`, `prisma:migrate` = `prisma migrate dev`, `prisma:deploy`, `prisma:seed` = `tsx prisma/seed.ts`, `dev:db` = `tsx scripts/dev-db.ts`), `backend/vitest.config.e2e.ts` (`globalSetup: ['./test/global-setup.ts']`, `fileParallelism: false`, `testTimeout: 30000`), `backend/src/modules/health/health.controller.ts` (adds `database: 'up' | 'down'` via `SELECT 1`), `backend/.env.example`
- Test: `backend/test/seed.e2e-spec.ts`

**Interfaces:**
- Produces Prisma models (snake_case tables via `@@map`, camelCase fields with `@map`): `User { id, email @unique, passwordHash, fullName, phone?, departmentId?, isActive, lastLoginAt?, createdAt, updatedAt }`, `Role { id, code @unique, name, description?, isSystem }`, `Permission { id, code @unique, module, description }`, `UserRole { userId, roleId, assignedAt, assignedById? } @@id([userId, roleId])`, `RolePermission { roleId, permissionId } @@id([roleId, permissionId])`, `Department { id, code @unique, name, isActive, timestamps }`, `Category { id, code @unique, name, description?, isActive, timestamps }`, `Location { id, parentId?, type LocationType, code @unique, name, description?, isActive, timestamps }` with self relation `parent`/`children`, `enum LocationType { OFFICE BUILDING FLOOR ROOM }`, `RefreshToken { id, userId, tokenHash @unique, expiresAt, revokedAt?, replacedById?, userAgent?, ip?, createdAt }`, `AuditLog { id, actorId?, action, module, entityId?, before Json?, after Json?, ip?, userAgent?, createdAt }`, `SystemSetting { key @id, value Json, updatedAt, updatedById? }`. Generator `prisma-client` with `output = "../src/generated/prisma"`, `moduleFormat = "esm"`, `importFileExtension = "js"`.
- Produces `PrismaService extends PrismaClient` (constructed with `new PrismaPg({ connectionString })`, `onModuleInit` connects, `onModuleDestroy` disconnects) in global `PrismaModule`.
- Produces `permissions.catalog.ts`: `ROLE_CODES`, `RoleCode`, `PERMISSIONS` const object (codes: `dashboard.view`, `assets.view`, `assets.create`, `assets.update`, `assets.archive`, `qr.generate`, `qr.scan`, `mutations.view`, `mutations.request`, `mutations.approve`, `stock_opnames.manage`, `stock_opnames.execute`, `maintenance.manage`, `maintenance.report`, `reports.view`, `reports.full`, `users.manage`, `roles.view`, `roles.manage`, `master_data.view`, `categories.manage`, `locations.manage`, `departments.manage`, `settings.manage`, `settings.limited`, `audit_logs.view_all`, `audit_logs.view_operational`), `PermissionCode`, `PERMISSION_DEFINITIONS: { code; module; description }[]`, `ROLE_DEFINITIONS: { code: RoleCode; name; description; permissions: PermissionCode[] | 'ALL' }[]` following the blueprint matrix: SUPER_ADMIN `'ALL'`; ADMIN_INVENTARIS all except `users.manage`, `roles.manage`, `settings.manage`, `audit_logs.view_all`; PETUGAS_INVENTARIS `dashboard.view, assets.view, qr.scan, mutations.view, mutations.request, stock_opnames.execute, maintenance.report, reports.view, master_data.view`; VIEWER `dashboard.view, assets.view, qr.scan, reports.view, master_data.view`.
- Produces `seed(prisma: PrismaClient, opts: { adminEmail; adminPassword; adminName }): Promise<void>` (idempotent upserts: permissions, roles + role_permissions, 9 categories with codes `ELEKTRONIK, KOMPUTER_IT, FURNITURE, ADMINISTRASI, RAPAT, INFRASTRUKTUR, KENDARAAN, KEBERSIHAN, LAINNYA`, one Super Admin user) and a CLI entry that reads `SEED_ADMIN_*` from env.
- Produces `startEmbeddedDatabase(opts: { port?: number; dataDir: string; persistent: boolean }): Promise<{ url: string; stop(): Promise<void> }>` (user `postgres`, password `postgres`, database `oams`), used by `scripts/dev-db.ts` (port 5433, `backend/.pgdata`, persistent, prints the URL, stops on SIGINT) and by `test/global-setup.ts` (free port, temp dir, runs `prisma migrate deploy` with `execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url } })`, runs `seed()` with `admin@test.local` / `Admin1234!`, sets `process.env.DATABASE_URL`).
- Produces `createTestApp(): Promise<TestContext>` where `TestContext = { app: INestApplication; prisma: PrismaService; http(): TestAgent; loginAs(role: RoleCode): Promise<{ accessToken: string; refreshCookie: string; userId: string; email: string }>; close(): Promise<void> }`. `loginAs` upserts user `<role lowercase>@test.local` with password `Test1234!` and that single role, then logs in over HTTP (uses Task 5's endpoint; until then it only creates the user and returns an empty token).

- [ ] **Step 1: Install** `prisma@^7.10 @prisma/adapter-pg@^7.10 pg@^8` and dev `embedded-postgres@17.11.0-beta.19 @types/pg`. Write `prisma.config.ts` (`import 'dotenv/config'`, `defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' }, datasource: { url: env('DATABASE_URL') } })`) and `schema.prisma` as specified.
- [ ] **Step 2: Write** `embedded-db.ts` and `scripts/dev-db.ts`; run `npm run dev:db -w backend` in the background, write `backend/.env` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/oams` and dev secrets, run `npx prisma migrate dev --name init -w backend` and `npm run prisma:generate -w backend`. Confirm `prisma/migrations/<ts>_init/migration.sql` creates 11 tables.
- [ ] **Step 3: Write failing e2e test** `seed.e2e-spec.ts`:

```ts
it('seeds roles, permissions, categories and the super admin', async () => {
  const ctx = await createTestApp();
  expect(await ctx.prisma.role.count()).toBe(4);
  expect(await ctx.prisma.permission.count()).toBe(PERMISSION_DEFINITIONS.length);
  expect(await ctx.prisma.category.count()).toBe(9);
  const admin = await ctx.prisma.user.findUnique({ where: { email: 'admin@test.local' }, include: { roles: { include: { role: true } } } });
  expect(admin?.roles.map(r => r.role.code)).toEqual(['SUPER_ADMIN']);
  const superAdmin = await ctx.prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' }, include: { permissions: true } });
  expect(superAdmin?.permissions.length).toBe(PERMISSION_DEFINITIONS.length);
  await ctx.close();
});
it('is idempotent', async () => { /* run seed() twice, counts unchanged */ });
it('reports database up on /health', async () => { /* GET /api/v1/health → { status: 'ok', database: 'up' } */ });
```
- [ ] **Step 4: Run** `npm run test:e2e -w backend` → FAIL (no harness / seed).
- [ ] **Step 5: Implement** `permissions.catalog.ts`, `seed.ts`, `prisma.service.ts`, `prisma.module.ts`, `global-setup.ts`, `test/utils/app.ts`, health `database` field.
- [ ] **Step 6: Run** `npm run test:e2e -w backend` → PASS; `npm run prisma:seed -w backend` against the dev DB succeeds and is repeatable.
- [ ] **Step 7: Commit** `feat(backend): prisma 7 schema, migrations, seed and embedded postgres for dev/tests`.

---

### Task 4: Audit log service and request context

**Files:**
- Create: `backend/src/common/context/request-context.ts`, `backend/src/common/context/request-context.middleware.ts`, `backend/src/common/audit/audit.module.ts`, `backend/src/common/audit/audit.service.ts`, `backend/src/common/audit/audit.types.ts`
- Modify: `backend/src/app.module.ts` (apply middleware to all routes; import global `AuditModule`)
- Test: `backend/src/common/audit/audit.service.spec.ts`

**Interfaces:**
- Produces `RequestContext = { requestId: string; ip: string | null; userAgent: string | null; actorId: string | null }`, `requestContext.run(ctx, fn)`, `requestContext.get(): RequestContext | undefined`, `requestContext.setActor(id: string)` (AsyncLocalStorage).
- Produces `AuditEntry = { action: string; module: string; entityId?: string | null; before?: unknown; after?: unknown; actorId?: string | null; ip?: string | null; userAgent?: string | null }` and `AuditService.record(entry: AuditEntry): Promise<void>` (fills `actorId`/`ip`/`userAgent` from context when omitted; never throws to the caller, logs failures), `AuditService.list(q: AuditLogQuery): Promise<Paginated<AuditLogDto>>` with `AuditLogQuery extends PaginationQueryDto { actorId?; module?; action?; entityId?; from?: Date; to?: Date; excludeModules?: string[] }` and `AuditLogDto = { id, actor: { id, fullName, email } | null, action, module, entityId, before, after, ip, userAgent, createdAt }`.

- [ ] **Step 1: Write failing unit tests** (Prisma mocked with `vi.fn()`):

```ts
it('fills actor, ip and user agent from the request context', async () => {
  await requestContext.run({ requestId: 'r1', ip: '10.0.0.1', userAgent: 'vitest', actorId: 'u1' }, () =>
    service.record({ action: 'category.created', module: 'categories', entityId: 'c1', after: { code: 'X' } }));
  expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: 'u1', ip: '10.0.0.1', userAgent: 'vitest', action: 'category.created', module: 'categories', entityId: 'c1', after: { code: 'X' } }) });
});
it('does not throw when the insert fails', async () => { prisma.auditLog.create.mockRejectedValue(new Error('db')); await expect(service.record({ action: 'x', module: 'y' })).resolves.toBeUndefined(); });
it('list applies excludeModules and date range', async () => { /* expect findMany where: { module: { notIn: [...] }, createdAt: { gte, lte } } */ });
```
- [ ] **Step 2: Run** `npm run test -w backend` → FAIL.
- [ ] **Step 3: Implement** context, middleware (generates `requestId` with `randomUUID()`, reads `req.ip` and `user-agent`), service, module.
- [ ] **Step 4: Run** → PASS; lint clean.
- [ ] **Step 5: Commit** `feat(backend): append-only audit log service with request context`.

---

### Task 5: Authentication (login, refresh, logout, me, change password) and JWT guard

**Files:**
- Create: `backend/src/modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `refresh-token.service.ts`, `password.service.ts`, `dto/login.dto.ts`, `dto/change-password.dto.ts`, `auth-user.loader.ts`, `backend/src/common/auth/public.decorator.ts`, `current-user.decorator.ts`, `jwt-auth.guard.ts`, `auth-user.ts`
- Modify: `backend/src/app.module.ts` (`APP_GUARD` JwtAuthGuard, `ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])` with `ThrottlerGuard` applied only on login via `@UseGuards(ThrottlerGuard)` + `@Throttle`), `backend/test/utils/app.ts` (`loginAs` now logs in for real)
- Test: `backend/src/modules/auth/password.service.spec.ts`, `backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Produces `AuthUser = { id: string; email: string; fullName: string; departmentId: string | null; roles: string[]; permissions: string[] }`, `AuthUserLoader.load(userId: string): Promise<AuthUser | null>` (returns null for inactive users).
- Produces `PasswordService.hash(plain): Promise<string>` (argon2id), `verify(hash, plain): Promise<boolean>`, `assertStrong(plain): void` (≥ 8 chars, at least one letter and one digit; throws 400 `Password minimal 8 karakter dan mengandung huruf serta angka.`).
- Produces `RefreshTokenService.issue(userId, meta): Promise<{ raw: string; expiresAt: Date }>` (48 random bytes base64url, stores sha256), `rotate(raw, meta): Promise<{ userId; raw; expiresAt }>` (throws 401 `Sesi tidak valid.`; on a revoked-token replay revokes all of that user's active tokens first), `revoke(raw)`, `revokeAllForUser(userId)`.
- Produces endpoints: `POST /auth/login { email, password }` → 200 `{ accessToken, tokenType: 'Bearer', expiresIn: 900, user: AuthUser }` + cookie; 401 `Email atau password salah.`; 403 `Akun dinonaktifkan. Hubungi administrator.`; updates `lastLoginAt`; audits `auth.login` / `auth.login_failed`. `POST /auth/refresh` (cookie) → same body + rotated cookie. `POST /auth/logout` → 204, revokes, clears cookie. `GET /auth/me` → `AuthUser`. `PATCH /auth/change-password { currentPassword, newPassword }` → 204, revokes all refresh tokens, audits `auth.password_changed`.
- Produces `@Public()` metadata key `isPublic`, `@CurrentUser()` param decorator returning `req.user: AuthUser`, `JwtAuthGuard` (verifies `Authorization: Bearer`, loads `AuthUser`, 401 `Autentikasi diperlukan.` when missing/invalid/inactive, calls `requestContext.setActor`).
- JWT: `@nestjs/jwt` `JwtModule.registerAsync` with `secret = env.JWT_ACCESS_SECRET`, `expiresIn = env.JWT_ACCESS_TTL_SECONDS`, payload `{ sub, email, type: 'access' }`.

- [ ] **Step 1: Write failing unit tests** for `PasswordService` (`hash` produces `$argon2id$`, `verify` true/false, `assertStrong` rejects `'abcdefgh'` and `'12345678'`, accepts `'Test1234'`).
- [ ] **Step 2: Write failing e2e test** `auth.e2e-spec.ts` (uses `createTestApp`, the seeded `admin@test.local` / `Admin1234!`):

```ts
it('logs in and returns an access token plus HttpOnly refresh cookie', ...) // 200, body.user.roles ['SUPER_ADMIN'], set-cookie contains 'oams_refresh=', 'HttpOnly', 'Path=/api/v1/auth', 'SameSite=Lax'
it('rejects a wrong password with 401 and the Indonesian message', ...)
it('rejects a deactivated user with 403 and sets no cookie', ...) // review focus 1
it('GET /auth/me requires a token and returns the profile', ...) // 401 without, 200 with
it('refresh rotates the cookie and the old one is then rejected', ...) // refresh → 200 new cookie; old cookie → 401
it('a replayed refresh token revokes every session of the user', ...) // review focus 2: login twice (2 sessions), refresh with A, replay old A → 401, then refresh with B → 401 too
it('logout clears the cookie and revokes the token', ...)
it('change-password verifies the current password, enforces strength and revokes sessions', ...)
it('rate limits login after 5 attempts per minute', ...) // 6th → 429
```
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** the files listed; register `AuthModule` in `AppModule`; mark `health` controller `@Public()`.
- [ ] **Step 5: Run** unit + e2e → PASS; lint clean; Swagger shows the auth tag with bearer lock icons.
- [ ] **Step 6: Commit** `feat(backend): JWT access tokens, rotating refresh cookies, login/logout/me/change-password`.

---

### Task 6: Permissions guard and roles module

**Files:**
- Create: `backend/src/common/auth/permissions.decorator.ts`, `permissions.guard.ts`, `backend/src/modules/roles/roles.module.ts`, `roles.controller.ts`, `roles.service.ts`, `dto/update-role-permissions.dto.ts`, `dto/role.dto.ts`
- Modify: `backend/src/app.module.ts` (`APP_GUARD` PermissionsGuard after JwtAuthGuard)
- Test: `backend/src/common/auth/permissions.guard.spec.ts`, `backend/test/roles.e2e-spec.ts`

**Interfaces:**
- Produces `@RequirePermissions(...codes: PermissionCode[])` (all required) and `PermissionsGuard` (no metadata → allow; missing any → 403 `Anda tidak memiliki izin untuk tindakan ini.`).
- Produces `RoleDto = { id, code, name, description, isSystem, permissions: string[], userCount: number }`; endpoints `GET /roles` (`roles.view`), `GET /roles/:id` (`roles.view`), `GET /permissions` (`roles.view`) → `{ module: string; permissions: { code; description }[] }[]`, `PUT /roles/:id/permissions { permissions: string[] }` (`roles.manage`) → `RoleDto`; 400 `Permission Super Admin tidak dapat diubah.` for `SUPER_ADMIN`; 400 `Kode permission tidak dikenal: <codes>` for unknown codes; audits `role.permissions_updated` with before/after arrays.

- [ ] **Step 1: Write failing unit test** for the guard with a fake `Reflector` and request: allows when no metadata, allows when user has all codes, throws `ForbiddenException` otherwise.
- [ ] **Step 2: Write failing e2e tests**: VIEWER `GET /roles` → 403; ADMIN_INVENTARIS `GET /roles` → 200 with 4 roles; ADMIN_INVENTARIS `PUT /roles/:viewerId/permissions` → 403; SUPER_ADMIN `PUT` with `['dashboard.view','assets.view']` → 200 and `GET /roles/:id` reflects it and an audit row exists with `action: 'role.permissions_updated'`; `PUT` on SUPER_ADMIN → 400; unknown code → 400.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** → PASS, lint clean.
- [ ] **Step 6: Commit** `feat(backend): permission guard and roles/permissions endpoints`.

---

### Task 7: Users module

**Files:**
- Create: `backend/src/modules/users/users.module.ts`, `users.controller.ts`, `users.service.ts`, `dto/create-user.dto.ts`, `dto/update-user.dto.ts`, `dto/reset-password.dto.ts`, `dto/set-user-roles.dto.ts`, `dto/user-query.dto.ts`, `dto/user.dto.ts`
- Test: `backend/test/users.e2e-spec.ts`

**Interfaces:**
- Produces `UserDto = { id, email, fullName, phone, isActive, department: { id, code, name } | null, roles: { code, name }[], lastLoginAt, createdAt, updatedAt }`.
- Endpoints (all `users.manage`): `GET /users?search&isActive&roleCode&page&pageSize`, `POST /users { email, fullName, password, roleCodes: string[] (min 1), departmentId?, phone? }` → 201, `GET /users/:id`, `PATCH /users/:id { fullName?, phone?, departmentId? }`, `POST /users/:id/deactivate` → 200, `POST /users/:id/activate`, `POST /users/:id/reset-password { newPassword }` → 204 (revokes sessions), `PUT /users/:id/roles { roleCodes }`, `GET /users/:id/activity?page&pageSize` → audit logs where `actorId = id`.
- Rules: email trimmed + lower-cased before any write or lookup; 400 `Anda tidak dapat menonaktifkan akun sendiri.`; 400 `Sistem harus memiliki minimal satu Super Admin aktif.` when deactivating the last active Super Admin or removing their role; 400 `Role tidak dikenal: <codes>`; every mutation audited (`user.created`, `user.updated`, `user.deactivated`, `user.activated`, `user.password_reset`, `user.roles_updated`) with password fields never stored in `before`/`after`.

- [ ] **Step 1: Write failing e2e tests**: create user (201, roles returned); create with same email in different case → 409 (review focus 3); `pageSize=101` → 400; list with `search` matches name and email; ADMIN_INVENTARIS `GET /users` → 403; deactivate self → 400; deactivate the only Super Admin → 400 (review focus 5); `PUT roles` removing SUPER_ADMIN from the only super admin → 400; deactivated user can no longer log in; reset-password then old password fails and new one works; `GET /users/:id/activity` lists the user's own actions; audit `after` of `user.created` has no `passwordHash`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, lint clean.
- [ ] **Step 5: Commit** `feat(backend): user management with role assignment, activation and password reset`.

---

### Task 8: Departments and categories modules

**Files:**
- Create: `backend/src/modules/departments/{departments.module,departments.controller,departments.service}.ts`, `dto/*.ts`; `backend/src/modules/categories/{categories.module,categories.controller,categories.service}.ts`, `dto/*.ts`; `backend/src/common/dto/code.validators.ts`
- Test: `backend/test/master-data.e2e-spec.ts`

**Interfaces:**
- Produces `@IsCode()` validator: trims, upper-cases (`@Transform`), matches `/^[A-Z0-9_]{2,20}$/`, message `Kode hanya boleh huruf besar, angka dan garis bawah (2-20 karakter).`
- Both modules expose `GET /<x>?search&isActive&page&pageSize` (`master_data.view`), `GET /<x>/:id` (`master_data.view`), `POST /<x> { code, name, description? }` (`<x>.manage`), `PATCH /<x>/:id { code?, name?, description? }`, `POST /<x>/:id/deactivate`, `POST /<x>/:id/activate`; DTOs `CategoryDto`/`DepartmentDto = { id, code, name, description?, isActive, createdAt, updatedAt }`; audits `<x>.created|updated|deactivated|activated`.

- [ ] **Step 1: Write failing e2e tests**: VIEWER can list categories (9 seeded) but `POST` → 403; ADMIN_INVENTARIS creates `{ code: 'printer', name: 'Printer' }` → 201 with code `PRINTER`; duplicate code → 409 with `errors.code` (review focus 4); invalid code `'a b'` → 400 `Validasi gagal.`; deactivate hides from `isActive=true` list; same create/duplicate/deactivate cycle for departments.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, lint clean.
- [ ] **Step 5: Commit** `feat(backend): categories and departments master data`.

---

### Task 9: Locations module with hierarchy rules

**Files:**
- Create: `backend/src/modules/locations/{locations.module,locations.controller,locations.service,locations.rules}.ts`, `dto/create-location.dto.ts`, `dto/update-location.dto.ts`, `dto/location-query.dto.ts`, `dto/location.dto.ts`
- Test: `backend/src/modules/locations/locations.rules.spec.ts`, `backend/test/locations.e2e-spec.ts`

**Interfaces:**
- Produces `LOCATION_LEVEL: Record<LocationType, number>` (`OFFICE 0, BUILDING 1, FLOOR 2, ROOM 3`), `assertValidParent(type: LocationType, parentType: LocationType | null): void` (OFFICE must have no parent: `Kantor tidak memiliki lokasi induk.`; others need a parent exactly one level up: `Lokasi induk untuk <nama tipe> harus berupa <nama tipe induk>.`), `buildTree(rows: LocationRow[]): LocationTreeNode[]`.
- DTOs: `LocationDto = { id, code, name, type, description, isActive, parent: { id, code, name, type } | null, path: string (e.g. 'Kantor Pusat / Gedung A / Lantai 2 / Ruang 201'), createdAt, updatedAt }`, `LocationTreeNode = { id, code, name, type, isActive, children: LocationTreeNode[] }`.
- Endpoints: `GET /locations?type&parentId&search&isActive&page&pageSize` (`master_data.view`), `GET /locations/tree?includeInactive` (`master_data.view`), `GET /locations/:id`, `POST /locations { code, name, type, parentId?, description? }` (`locations.manage`), `PATCH /locations/:id { code?, name?, description?, parentId? }` (type immutable; parent change re-validated and cannot create a cycle), `POST /locations/:id/deactivate` (400 `Nonaktifkan lokasi anak terlebih dahulu.` when active children exist), `POST /locations/:id/activate` (400 `Aktifkan lokasi induk terlebih dahulu.` when parent inactive). Audited `location.*`.

- [ ] **Step 1: Write failing unit tests** for `assertValidParent` (ROOM←FLOOR ok, ROOM←BUILDING throws, OFFICE←anything throws, BUILDING←null throws) and `buildTree` (3 rows → nested).
- [ ] **Step 2: Write failing e2e tests**: create OFFICE → BUILDING → FLOOR → ROOM chain, `GET /locations/:roomId` path string matches; ROOM under BUILDING → 400; `GET /locations/tree` nests 4 levels; deactivate FLOOR with active ROOM → 400, after deactivating ROOM succeeds; PETUGAS `POST` → 403 but `GET tree` → 200.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** → PASS, lint clean.
- [ ] **Step 6: Commit** `feat(backend): hierarchical locations (kantor/gedung/lantai/ruangan)`.

---

### Task 10: Audit log endpoint

**Files:**
- Create: `backend/src/modules/audit-logs/{audit-logs.module,audit-logs.controller}.ts`, `dto/audit-log-query.dto.ts`
- Test: `backend/test/audit-logs.e2e-spec.ts`

**Interfaces:**
- `GET /audit-logs?actorId&module&action&entityId&from&to&page&pageSize`: allowed for `audit_logs.view_all` (all rows) or `audit_logs.view_operational` (rows with `module` not in `['auth','users','roles','settings']`); otherwise 403. Uses `AuditService.list`. Guard logic: controller has no `@RequirePermissions`; it checks `user.permissions` itself and sets `excludeModules`.

- [ ] **Step 1: Write failing e2e tests**: SUPER_ADMIN sees `users` module rows; ADMIN_INVENTARIS does not see `users`/`auth` rows but sees `categories` rows; PETUGAS → 403; `module=categories&from=<today>` filters.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, lint clean.
- [ ] **Step 5: Commit** `feat(backend): audit log listing with operational scope`.

---

### Task 11: Frontend scaffold, API client, auth provider, login page

**Files:**
- Create via CLI: `frontend/` (`npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --skip-install --disable-git --yes` from repo root; delete sample svgs and `page.tsx` content)
- Create: `frontend/src/lib/api/client.ts`, `frontend/src/lib/api/auth.ts`, `frontend/src/types/api.ts`, `frontend/src/lib/auth/auth-provider.tsx`, `frontend/src/lib/auth/use-auth.ts`, `frontend/src/lib/query-provider.tsx`, `frontend/src/lib/utils.ts` (`cn`, `formatDateTime(iso)` with `Asia/Jakarta`), `frontend/src/components/ui/{button,input,label,card,alert,spinner}.tsx`, `frontend/src/app/(auth)/login/page.tsx`, `frontend/src/app/(auth)/forgot-password/page.tsx` (static: "Hubungi Super Admin untuk reset password."), `frontend/src/app/page.tsx` (redirects to `/dashboard`), `frontend/vitest.config.ts`, `frontend/src/test/setup.ts`
- Modify: `frontend/next.config.ts` (`output: 'standalone'`, remove `cacheComponents` and `partialPrefetching`, keep the Tailwind turbopack rule, `rewrites: [{ source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://localhost:4000'}/api/:path*` }]`), `frontend/src/app/layout.tsx` (`lang="id"`, providers, `<Toaster />`), `frontend/package.json` (engines, `test` script `vitest run`, deps `@tanstack/react-query@^5 react-hook-form@^7 @hookform/resolvers@^7 zod@^4 lucide-react sonner clsx tailwind-merge`, dev `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`)
- Test: `frontend/src/lib/api/client.test.ts`

**Interfaces:**
- Produces `class ApiError extends Error { status: number; errors?: Record<string, string[]> }`, `setAccessToken(token: string | null)`, `getAccessToken()`, `setUnauthorizedHandler(fn: () => void)`, `apiFetch<T>(path: string, init?: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> }): Promise<T>` (base `/api/v1`, JSON, `credentials: 'include'`, attaches Bearer, on 401 for non-`/auth/` paths performs one shared `POST /auth/refresh`, updates the token and retries once; if refresh fails clears the token, calls the handler and throws), `api = { get, post, put, patch, delete }` thin wrappers.
- Produces `AuthUser` (mirrors backend), `authApi.login(email, password)`, `authApi.refresh()`, `authApi.logout()`, `authApi.me()`, `authApi.changePassword(current, next)`.
- Produces `AuthProvider` with `useAuth(): { status: 'loading' | 'authenticated' | 'anonymous'; user: AuthUser | null; login(email, password): Promise<void>; logout(): Promise<void>; hasPermission(code: string): boolean; hasAnyPermission(codes: string[]): boolean }` (on mount tries `refresh()` then `me()`).
- Login page: form (email, password) with zod validation, Indonesian labels (`Email`, `Password`, `Masuk`), shows `ApiError.message` in an alert, redirects to `?next` or `/dashboard`.

- [ ] **Step 1: Scaffold and install** as above; `npm install` from root.
- [ ] **Step 2: Write failing tests** `client.test.ts` (mock `globalThis.fetch` with `vi.fn()`):

```ts
it('sends the bearer token and parses JSON', ...)
it('refreshes once on 401 and retries the original request', ...) // fetch calls: original 401, /auth/refresh 200 {accessToken:'new'}, retry with 'Bearer new' 200
it('calls the unauthorized handler and throws ApiError when refresh fails', ...)
it('deduplicates concurrent refreshes', ...) // two parallel 401s → exactly one /auth/refresh call
it('wraps error bodies into ApiError with errors map', ...) // 400 { message:'Validasi gagal.', errors:{ email:['...'] } }
```
- [ ] **Step 3: Run** `npm run test -w frontend` → FAIL. **Step 4: Implement** client, auth api, provider, UI primitives, login page, layout, config.
- [ ] **Step 5: Run** tests → PASS; `npm run lint -w frontend` and `npx tsc --noEmit -p frontend` clean; with backend (`dev:db` + `start:dev`) and `npm run dev -w frontend` running, log in at `http://localhost:3000/login` with the dev seed admin and confirm the redirect and the `oams_refresh` cookie in devtools.
- [ ] **Step 6: Commit** `feat(frontend): Next.js scaffold, API client with silent refresh, auth provider and login page`.

---

### Task 12: App shell, dashboard, profile

**Files:**
- Create: `frontend/src/components/layout/{app-shell,sidebar,header,nav-items,user-menu}.tsx`, `frontend/src/components/ui/{dialog,table,badge,select,textarea,dropdown-menu,pagination,empty-state,page-header,confirm-dialog}.tsx`, `frontend/src/app/(app)/layout.tsx`, `frontend/src/app/(app)/dashboard/page.tsx`, `frontend/src/app/(app)/profile/page.tsx`, `frontend/src/features/dashboard/stat-card.tsx`, `frontend/src/features/profile/change-password-form.tsx`
- Test: `frontend/src/components/layout/nav-items.test.ts`

**Interfaces:**
- Produces `NAV_ITEMS: { href: string; label: string; icon: LucideIcon; permissions?: string[] /* any-of */ }[]` and `visibleNavItems(items, hasAnyPermission): NavItem[]`. Items: Dashboard `/dashboard` (`dashboard.view`), Pengguna `/users` (`users.manage`), Role & Izin `/roles` (`roles.view`), Kategori `/categories` (`categories.manage`), Lokasi `/locations` (`locations.manage`), Unit Kerja `/departments` (`departments.manage`), Audit Log `/audit-logs` (`audit_logs.view_all`, `audit_logs.view_operational`), Profil `/profile` (none).
- `(app)/layout.tsx`: `loading` → centered spinner; `anonymous` → `router.replace('/login?next=' + pathname)`; else `AppShell` (sidebar collapsible to a drawer under 1024 px, header with page title, user name, roles badge, logout).
- Dashboard (Tahap 1 scope): greeting card with the user's name and roles; stat cards from list endpoints' `meta.total` shown only when permitted (Pengguna aktif, Kategori aktif, Lokasi aktif, Unit kerja aktif); note card "Statistik inventaris tersedia pada Tahap 2."
- Profile page: read-only profile (nama, email, role, unit kerja) and `ChangePasswordForm` calling `authApi.changePassword`; on success toast `Password berhasil diubah. Silakan login kembali.` then logout.

- [ ] **Step 1: Write failing test** `nav-items.test.ts`: viewer permissions see only Dashboard and Profil; super admin sees all 8; admin inventaris sees Dashboard, Role & Izin, Kategori, Lokasi, Unit Kerja, Audit Log, Profil.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** tests, lint, tsc → clean; in the browser verify the drawer at 375 px width and that a VIEWER (create one via API) sees the reduced menu.
- [ ] **Step 5: Commit** `feat(frontend): role-aware app shell, dashboard and profile with change password`.

---

### Task 13: Master data and user administration pages

**Files:**
- Create: `frontend/src/lib/api/{users,roles,categories,departments,locations,audit-logs}.ts`, `frontend/src/features/categories/{category-table,category-form-dialog}.tsx`, `frontend/src/features/departments/{department-table,department-form-dialog}.tsx`, `frontend/src/features/locations/{location-tree,location-form-dialog}.tsx`, `frontend/src/features/users/{user-table,user-form-dialog,user-roles-dialog,reset-password-dialog}.tsx`, `frontend/src/features/roles/{role-list,role-permissions-editor}.tsx`, `frontend/src/features/audit-logs/{audit-log-table,audit-log-filters}.tsx`, pages `frontend/src/app/(app)/{categories,departments,locations,users,roles,audit-logs}/page.tsx`
- Test: `frontend/src/features/locations/location-tree.test.tsx`

**Interfaces:**
- Each `lib/api/<x>.ts` exposes typed functions mirroring Tasks 6 to 10 (`list(query)`, `get(id)`, `create(dto)`, `update(id, dto)`, `deactivate(id)`, `activate(id)`, plus users' `setRoles`, `resetPassword`, `activity`, roles' `setPermissions`, locations' `tree`).
- Pages use TanStack Query (`queryKey` per resource, invalidate on mutation), `sonner` toasts for success (`Kategori disimpan.` etc.) and `ApiError` messages for failure; server field errors map onto form fields via `setError`.
- Locations page: left tree (expand/collapse, inactive greyed) and right detail panel with actions; "Tambah" picks the type and parent from the selected node.
- Users page: table (nama, email, role badges, unit kerja, status, login terakhir in Asia/Jakarta), dialogs for create/edit, role assignment (checkbox list from `/roles`), reset password, activate/deactivate with `ConfirmDialog`.
- Roles page: role list with permission counts; Super Admin can toggle permissions per module (disabled for `SUPER_ADMIN`).
- Audit log page: filters (modul, aksi, dari, sampai), table, row expands to show `before`/`after` as formatted JSON.

- [ ] **Step 1: Write failing test** `location-tree.test.tsx`: renders nested nodes, collapses children on click, calls `onSelect(id)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** api modules, features and pages.
- [ ] **Step 4: Run** tests, lint, tsc → clean. Browser walkthrough as Super Admin: create a department, a category, the four-level location chain, a PETUGAS user; log in as that user and confirm the limited menu and a 403 toast when hitting `/users` directly.
- [ ] **Step 5: Commit** `feat(frontend): users, roles, categories, departments, locations and audit log pages`.

---

### Task 14: Docker Compose deployment files and docs

**Files:**
- Create: `infrastructure/docker/backend.Dockerfile`, `infrastructure/docker/frontend.Dockerfile`, `infrastructure/docker/backend-entrypoint.sh` (`npx prisma migrate deploy` then `node dist/main.js`), `infrastructure/nginx/nginx.conf`, `infrastructure/nginx/conf.d/oams.conf`, `infrastructure/nginx/certs/.gitkeep`, `infrastructure/postgres/backup.sh`, `infrastructure/postgres/restore.sh`, `docker-compose.yml`, `.dockerignore`
- Modify: `README.md` (Deployment, backup, restore sections), `backend/package.json` (`start:prod` = `node dist/main.js`)

**Interfaces:**
- Compose services: `postgres` (`postgres:17-alpine`, volume `pgdata`, no published ports, healthcheck `pg_isready`), `backend` (build context repo root, `infrastructure/docker/backend.Dockerfile`, env from `.env`, depends on healthy postgres), `frontend` (standalone build, `API_URL=http://backend:4000`), `nginx` (`nginx:1.27-alpine`, ports 80/443, mounts conf + certs, routes `/api/` → `backend:4000`, everything else → `frontend:3000`, `client_max_body_size 20m`, HTTP→HTTPS redirect), `backup` (`postgres:17-alpine`, runs `backup.sh` in a loop every 24 h: `pg_dump -Fc` to `/backups/oams-YYYYMMDD-HHMM.dump`, keeps 14 files; volume `backups` meant to be synced off-server). Networks: `edge` (nginx+frontend+backend) and `internal` (backend+postgres+backup).
- Dockerfiles: multi-stage on `node:24-alpine`; backend image runs `prisma generate` and `nest build`, copies `prisma/`, `prisma.config.ts`, `dist/`, production `node_modules`; frontend image copies `.next/standalone`, `.next/static`, `public`.

- [ ] **Step 1: Write** all files above.
- [ ] **Step 2: Verify what can be verified locally:** parse the Compose file with `npx -y js-yaml docker-compose.yml > /dev/null`; syntax-check the shell scripts with `sh -n infrastructure/postgres/backup.sh infrastructure/postgres/restore.sh infrastructure/docker/backend-entrypoint.sh`; run `npm run build -w backend && npm run build -w frontend` (the same commands the Dockerfiles run). Record in README that `docker compose config` and a full stack run must be executed on the server, because the dev machine has no Docker.
- [ ] **Step 3: Write README sections** (Indonesian): copy `.env.example` → `.env`, generate secrets (`openssl rand -base64 48`), place certs, `docker compose up -d --build`, first login with `SEED_ADMIN_*`, change the password, backup location, restore with `restore.sh <file>`, and the step to test a restore quarterly (blueprint 10.14).
- [ ] **Step 4: Commit** `chore(infra): docker compose stack with nginx, postgres backups and deployment docs`.

---

### Task 15: End-to-end verification

**Files:** none new (fixes only).

- [ ] **Step 1: Run the whole suite from the root:** `npm run lint`, `npm run build`, `npm test` → all green; paste the summary lines into the final report.
- [ ] **Step 2: Manual smoke test** with `dev:db`, `start:dev`, `dev` running and the browser pane: login as seed admin → create department, category, location chain, a PETUGAS user → logout → login as PETUGAS → menu limited → `/users` shows 403 toast → logout. Check `/api/docs` lists every Tahap 1 endpoint.
- [ ] **Step 3: Review** with `superpowers:requesting-code-review` (whole branch), fix findings, re-run Step 1.
- [ ] **Step 4: Commit** any fixes `fix: address review findings for Tahap 1`.
