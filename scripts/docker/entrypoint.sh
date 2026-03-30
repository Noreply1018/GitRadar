#!/usr/bin/env bash

set -euo pipefail

TZ_VALUE="${TZ:-Asia/Shanghai}"
SCHEDULE_CONFIG_FILE="/app/config/schedule.json"
SCHEDULE="${GITRADAR_CRON_SCHEDULE:-}"
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

if [[ -f "${SCHEDULE_CONFIG_FILE}" ]]; then
  CONFIGURED_SCHEDULE="$(node -e '
const fs = require("node:fs");

try {
  const raw = fs.readFileSync(process.argv[1], "utf8");
  const parsed = JSON.parse(raw);
  const value = parsed?.dailySendTime;

  if (typeof value !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
    process.exit(1);
  }

  const [hour, minute] = value.split(":").map(Number);
  process.stdout.write(`${minute} ${hour} * * *`);
} catch {
  process.exit(1);
}
' "${SCHEDULE_CONFIG_FILE}" 2>/dev/null || true)"

  if [[ -n "${CONFIGURED_SCHEDULE}" ]]; then
    SCHEDULE="${CONFIGURED_SCHEDULE}"
  fi
fi

if [[ -z "${SCHEDULE}" ]]; then
  SCHEDULE="17 8 * * *"
fi

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
