#!/usr/bin/env bash
# Nightly PostgreSQL backup to S3. Runs on the EC2 host from cron, e.g.
#   15 21 * * * /opt/altus/pg-backup.sh >> /var/log/altus-backup.log 2>&1   (02:45 IST)
#
# Needs: pg_dump matching the server's major version, the AWS CLI, and an instance IAM role
# allowed s3:PutObject on the bucket (no access keys on the box).
# Config comes from the environment (e.g. /etc/altus/backup.env, mode 600, sourced by cron):
#   DATABASE_URL     postgresql://USER:PASSWORD@HOST:5432/expense-tracker
#   BACKUP_BUCKET    S3 bucket name, e.g. altus-db-backups
#   BACKUP_PREFIX    optional key prefix (default: expense-tracker)
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is not set}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is not set}"
prefix="${BACKUP_PREFIX:-expense-tracker}"
stamp="$(TZ=Asia/Kolkata date +%Y-%m-%dT%H%M%S%z)"
key="s3://${BACKUP_BUCKET}/${prefix}/${stamp}.dump.gz"

# Custom format (-Fc) restores table by table with pg_restore; streamed so nothing lands on disk.
pg_dump --format=custom --no-owner --no-privileges "${DATABASE_URL}" \
  | gzip -6 \
  | aws s3 cp - "${key}" --sse AES256 --only-show-errors

echo "$(date -u +%FT%TZ) backup ok ${key}"
