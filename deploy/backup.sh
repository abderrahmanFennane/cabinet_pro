#!/bin/sh
# Daily MySQL backup with an automatic restore test. Runs in the "backup" service of docker-compose.yml.
#  - one compressed dump per day in /backups (bind-mounted to ./backups on the server), kept BACKUP_KEEP_DAYS days
#  - every new dump is restored into a scratch database and checked, the result goes to /backups/last-restore-test.txt
#  - medical fields stay encrypted inside the dump: keep DATA_ENCRYPTION_KEY with the backups, but stored separately
# Manual run:     docker compose run --rm backup now
# Restore a dump: see deploy/restore.sh
set -eu

DIR=/backups
DB=${MYSQL_DATABASE:-cabinet_pro}
HOST=${MYSQL_HOST:-mysql}
USER=${MYSQL_USER_NAME:-root}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
HOUR=${BACKUP_HOUR_UTC:-1}   # 1h UTC = 2h in Morocco
export MYSQL_PWD="${MYSQL_ROOT_PASSWORD?MYSQL_ROOT_PASSWORD manquant}"
mkdir -p "$DIR"

log() { echo "[backup $(date -u +%FT%TZ)] $*"; }
q() { mysql -h "$HOST" -u "$USER" -N -B -e "$1"; }

restore_test() {
  file=$1
  scratch="${DB}_restore_test"
  q "DROP DATABASE IF EXISTS \`$scratch\`; CREATE DATABASE \`$scratch\`"
  gunzip -c "$file" | mysql -h "$HOST" -u "$USER" "$scratch"
  report=""
  status=OK
  for table in Cabinet User Patient Appointment Consultation Invoice _prisma_migrations; do
    live=$(q "SELECT COUNT(*) FROM \`$DB\`.\`$table\`" 2>/dev/null || echo "?")
    restored=$(q "SELECT COUNT(*) FROM \`$scratch\`.\`$table\`" 2>/dev/null || echo "absente")
    report="$report $table=$restored/$live"
    # Rows written after the dump started may be missing; a table that is missing or empty is not.
    if [ "$restored" = "absente" ] || { [ "$live" != "0" ] && [ "$restored" = "0" ]; }; then status=ECHEC; fi
  done
  q "DROP DATABASE \`$scratch\`"
  echo "$status $(date -u +%FT%TZ) $(basename "$file") (restauré/actuel)$report" > "$DIR/last-restore-test.txt"
  log "test de restauration $status :$report"
  [ "$status" = OK ]
}

backup() {
  file="$DIR/${DB}_$(date -u +%Y-%m-%d_%H%M).sql.gz"
  log "sauvegarde -> $file"
  mysqldump -h "$HOST" -u "$USER" --single-transaction --quick --routines --triggers --set-gtid-purged=OFF --no-tablespaces "$DB" | gzip > "$file.tmp"
  gzip -t "$file.tmp"
  # A dump that stops half-way has no completion line: refuse it.
  gunzip -c "$file.tmp" | tail -n 1 | grep -q "Dump completed" || { log "dump incomplet"; rm -f "$file.tmp"; return 1; }
  mv "$file.tmp" "$file"
  restore_test "$file"
  find "$DIR" -name "${DB}_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
  log "terminé ($(du -h "$file" | cut -f1))"
}

if [ "${1:-}" = "now" ]; then backup; exit $?; fi

log "planifiée chaque jour à ${HOUR}h UTC, conservation ${KEEP_DAYS} jours"
while true; do
  today=$(date -u +%Y-%m-%d)
  if [ "$(date -u +%H)" -ge "$HOUR" ] && ! ls "$DIR/${DB}_${today}_"*.sql.gz >/dev/null 2>&1; then
    backup || log "ÉCHEC de la sauvegarde"
  fi
  sleep 600
done
