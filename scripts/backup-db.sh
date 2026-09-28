#!/bin/sh
# Daily encrypted MySQL backup, kept 30 days (spec section 10).
# Usage (cron): 0 2 * * * BACKUP_PASSPHRASE=... /var/www/cabinet-pro/scripts/backup-db.sh
# Restore:  openssl enc -d -aes-256-cbc -pbkdf2 -in FILE.sql.gz.enc -pass env:BACKUP_PASSPHRASE | gunzip | mysql cabinet_pro
set -eu

DB_NAME="${DB_NAME:-cabinet_pro}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cabinet-pro}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz.enc"

# Credentials come from ~/.my.cnf (never on the command line).
mysqldump --single-transaction --routines --triggers "$DB_NAME" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$FILE"

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz.enc" -mtime +"$RETENTION_DAYS" -delete
echo "Backup written: $FILE"
