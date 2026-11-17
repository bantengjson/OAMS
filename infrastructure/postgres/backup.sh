#!/bin/sh
# Backup harian PostgreSQL OAMS (format custom pg_dump, bisa di-restore selektif).
# Dijalankan di container `backup` (image postgres) oleh docker-compose.
set -eu

: "${POSTGRES_DB:?POSTGRES_DB wajib diisi}"
: "${POSTGRES_USER:?POSTGRES_USER wajib diisi}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD wajib diisi}"
PGHOST="${PGHOST:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

export PGPASSWORD="$POSTGRES_PASSWORD"
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M)"
target="$BACKUP_DIR/oams-$stamp.dump"
tmp="$target.part"

echo "[backup] $(date -Iseconds) membuat $target"
pg_dump -h "$PGHOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$tmp"
mv "$tmp" "$target"

# hapus backup yang lebih tua dari retensi
find "$BACKUP_DIR" -name 'oams-*.dump' -type f -mtime +"$BACKUP_RETENTION_DAYS" -delete

echo "[backup] selesai: $(ls -1 "$BACKUP_DIR"/oams-*.dump | wc -l) berkas tersimpan"
