# Cron service that backs up the production database off Railway
# (docs/operations/db-backups.md). Built from the repository root:
#   docker build -f ops/db-backup/Dockerfile .
#
# pg_dump must be at least the server's major version: production runs
# postgres-ssl:18 (.railway/railway.ts), so the client comes from postgres:18.
FROM postgres:18-alpine

RUN apk add --no-cache bash age rclone curl

COPY ops/db-backup/backup.sh /usr/local/bin/backup.sh
RUN chmod 0755 /usr/local/bin/backup.sh

USER postgres

# Replaces the image's entrypoint, which would start a database server.
ENTRYPOINT ["/usr/local/bin/backup.sh"]
CMD []
