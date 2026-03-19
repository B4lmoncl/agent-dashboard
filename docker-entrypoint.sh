#!/bin/sh
set -e

# Fix volume permissions — the quest-data volume may have been created as root
# before the non-root user was added to the Dockerfile.
# This runs as root (no USER directive before ENTRYPOINT), fixes perms, then
# drops privileges to appuser for the actual server process.
if [ -d /app/data ]; then
  chown -R appuser:appgroup /app/data 2>/dev/null || true
fi

# Drop to non-root user and exec the CMD
exec su-exec appuser "$@"
