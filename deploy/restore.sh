#!/bin/sh
# Restores a dump made by deploy/backup.sh into the live database (replaces its content).
#   docker compose stop backend
#   docker compose run --rm backup sh /scripts/restore.sh /backups/cabinet_pro_2026-10-03_0100.sql.gz
#   docker compose start backend
# The backend must run with the same DATA_ENCRYPTION_KEY as when the dump was made.
set -eu
file=${1:?Usage: restore.sh /backups/<fichier>.sql.gz}
DB=${MYSQL_DATABASE:-cabinet_pro}
HOST=${MYSQL_HOST:-mysql}
export MYSQL_PWD="${MYSQL_ROOT_PASSWORD?MYSQL_ROOT_PASSWORD manquant}"

gzip -t "$file"
echo "Restauration de $file dans $DB (le contenu actuel sera remplacé). Ctrl+C dans les 10 secondes pour annuler."
sleep 10
mysql -h "$HOST" -u root -e "DROP DATABASE IF EXISTS \`$DB\`; CREATE DATABASE \`$DB\`"
gunzip -c "$file" | mysql -h "$HOST" -u root "$DB"
echo "Restauration terminée : $(mysql -h "$HOST" -u root -N -e "SELECT COUNT(*) FROM \`$DB\`.Patient") patient(s)."
