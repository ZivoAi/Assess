#!/usr/bin/env bash
# Disposable socket-only services: never inherit production DB/Redis settings.
set -euo pipefail
cd "$(dirname "$0")/.."
for binary in initdb pg_ctl redis-server redis-cli; do
  command -v "$binary" >/dev/null || { echo "Missing isolated-test dependency: $binary"; exit 1; }
done
root="$(mktemp -d /tmp/zivopal-assess-test.XXXXXX)"
cleanup() {
  redis-cli -s "$root/redis.sock" shutdown nosave >/dev/null 2>&1 || true
  pg_ctl -D "$root/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$root"
}
trap cleanup EXIT
initdb -D "$root/data" --auth=trust --username=migration_test >/dev/null
pg_ctl -D "$root/data" -l "$root/postgres.log" \
  -o "-k $root -c listen_addresses='' -c unix_socket_permissions=0700" -w start >/dev/null
redis-server --port 0 --unixsocket "$root/redis.sock" --unixsocketperm 700 \
  --daemonize yes --pidfile "$root/redis.pid" --logfile "$root/redis.log" --save "" --appendonly no
DATABASE_URL="postgresql://migration_test@localhost/postgres?host=$root" \
REDIS_URL="$root/redis.sock" ASSESS_DB_SCHEMA=assess_fixture NODE_ENV=test \
ZIVOPAL_CORE_URL=https://core.fixture.invalid \
ZIVOPAL_SERVICE_KEY=synthetic-core-assess-workflow-key \
ISOLATED_ASSESS_TEST_ROOT="$root" node scripts/grading-workflow-check.cjs
