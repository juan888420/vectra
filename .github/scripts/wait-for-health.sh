#!/usr/bin/env bash
# Waits for the container's /api/health to answer, or fails with its logs.
set -euo pipefail

container="$1"

for _ in $(seq 1 30); do
  if curl -fsS http://localhost:3001/api/health > /dev/null 2>&1; then
    exit 0
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$container")" != "true" ]; then
    echo "::error::Container $container exited before becoming healthy"
    docker logs "$container"
    exit 1
  fi
  sleep 1
done

echo "::error::Container $container not healthy after 30s"
docker logs "$container"
exit 1
