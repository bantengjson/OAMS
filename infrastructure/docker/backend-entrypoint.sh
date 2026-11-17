#!/bin/sh
# Entrypoint container backend: migrasi -> seed (opsional) -> start API.
set -eu

cd /app/backend

echo "[oams] Menjalankan migrasi database..."
npx prisma migrate deploy

# Seed idempoten: menjamin role, permission, kategori awal, dan Super Admin ada.
# Dilewati jika kredensial admin awal tidak diberikan atau SEED_ON_START=false.
if [ "${SEED_ON_START:-true}" = "true" ] && [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "[oams] Menjalankan seed..."
  node dist/database/seed-cli.js
else
  echo "[oams] Seed dilewati."
fi

echo "[oams] Menjalankan API di port ${PORT:-4000}..."
exec node dist/main.js
