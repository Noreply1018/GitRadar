#!/usr/bin/env bash

set -euo pipefail

TZ_VALUE="${TZ:-Asia/Shanghai}"
SCHEDULE="${GITRADAR_CRON_SCHEDULE:-17 8 * * *}"
CRON_FILE="/etc/cron.d/gitradar"
CRON_LOG="/var/log/gitradar-cron.log"

mkdir -p \
  /app/data/history \
  /app/data/runtime/failures \
  /app/data/runtime/locks \
  /app/data/cache \
  /app/data/exports

ln -snf "/usr/share/zoneinfo/${TZ_VALUE}" /etc/localtime
echo "${TZ_VALUE}" > /etc/timezone

touch "${CRON_LOG}"

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
TZ=${TZ_VALUE}
${SCHEDULE} root cd /app && /app/scripts/docker/run-scheduled-digest.sh >> ${CRON_LOG} 2>&1
EOF

chmod 0644 "${CRON_FILE}"
crontab "${CRON_FILE}"

echo "GitRadar Docker entrypoint started."
echo "Timezone: ${TZ_VALUE}"
echo "Daily schedule: ${SCHEDULE}"

cron
tail -F "${CRON_LOG}" &

exec npm run start:console:docker
