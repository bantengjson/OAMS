#!/bin/sh
# Restore database OAMS dari berkas backup pg_dump (format custom).
#
#   docker compose run --rm backup /scripts/restore.sh /backups/oams-20261117-0200.dump
#
# Hentikan backend terlebih dahulu (docker compose stop backend) agar tidak ada
# koneksi yang menulis selama restore.
set -eu

file="${1:?Gunakan: restore.sh <berkas.dump>}"
[ -f "$file" ] || { echo "Berkas tidak ditemukan: $file" >&2; exit 1; }

: "${POSTGRES_DB:?POSTGRES_DB wajib diisi}"
: "${POSTGRES_USER:?POSTGRES_USER wajib diisi}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD wajib diisi}"
PGHOST="${PGHOST:-postgres}"
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[restore] memulihkan $file ke database $POSTGRES_DB di $PGHOST ..."
pg_restore -h "$PGHOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges --exit-on-error "$file"
echo "[restore] selesai. Jalankan kembali backend: docker compose start backend"
