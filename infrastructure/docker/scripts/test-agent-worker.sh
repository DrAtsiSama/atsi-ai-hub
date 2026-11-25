#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)"
TEST_DB="atsi-ai-hub-postgres-test"
TEST_WORKER="atsi-ai-hub-worker-test"

cleanup() {
  if [ -n "${DB_ID:-}" ]; then
    docker rm -f "$DB_ID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$ROOT"

echo "=== Verification environnement ==="

if docker container inspect "$TEST_DB" >/dev/null 2>&1; then
  echo "Un conteneur de test existe deja."
  exit 1
fi

if docker container inspect "$TEST_WORKER" >/dev/null 2>&1; then
  echo "Un conteneur worker de test existe deja."
  exit 1
fi

echo "=== Creation PostgreSQL temporaire ==="

DB_ID=$(docker run -d \
  --name "$TEST_DB" \
  --network none \
  --restart no \
  --memory 512m \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  -e POSTGRES_USER=atsi_test \
  -e POSTGRES_PASSWORD=atsi_test_local \
  -e POSTGRES_DB=atsi_ai_hub_test \
  --pull never \
  postgres:16-alpine)

test "$(docker inspect \
  --format '{{.HostConfig.NetworkMode}}' \
  "$DB_ID")" = "none"

echo "=== Attente PostgreSQL ==="

attempts=0

until docker exec "$DB_ID" \
  pg_isready -h 127.0.0.1 \
  -U atsi_test -d atsi_ai_hub_test
do
  attempts=$((attempts + 1))

  if [ "$attempts" -ge 30 ]; then
    echo "PostgreSQL indisponible"
    exit 1
  fi

  sleep 2
done

echo "=== Application des migrations ==="

for migration in apps/api/migrations/*.sql
do
  echo "--- $migration ---"

  docker exec -i "$DB_ID" \
    psql -X \
    -U atsi_test \
    -d atsi_ai_hub_test \
    -v ON_ERROR_STOP=1 \
    < "$migration"
done

echo "=== Tests complets du worker ==="

docker run --rm \
  --name "$TEST_WORKER" \
  --network "container:$DB_ID" \
  --memory 1g \
  --pull never \
  -v "$ROOT/services/agent-worker:/source:ro" \
  -e ATSI_RUN_INTEGRATION_TESTS=1 \
  node:24-bookworm-slim \
  sh -lc '
    set -eu

    mkdir -p /tmp/atsi-tests
    cd /tmp/atsi-tests

    cp -r /source/src .
    cp /source/package.json .
    cp /source/tsconfig.json .

    ln -s /source/node_modules node_modules

    echo "=== Compilation TypeScript ==="

    node node_modules/typescript/bin/tsc

    echo "=== Execution des tests ==="

    node --test dist/*.test.js
  '

echo "=== Validation terminee ==="
echo "Suppression automatique du PostgreSQL temporaire."
