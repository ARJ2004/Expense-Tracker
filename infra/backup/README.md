# Database backups

`pg-backup.sh` streams `pg_dump -Fc | gzip` to S3 with server-side encryption. Backups older
than 30 days expire through the bucket's lifecycle rule (`lifecycle.json`).

## Set up (once)

```bash
aws s3api create-bucket --bucket altus-db-backups --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
aws s3api put-public-access-block --bucket altus-db-backups \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-lifecycle-configuration --bucket altus-db-backups --lifecycle-configuration file://lifecycle.json
```

Attach an IAM role to the EC2 instance that allows `s3:PutObject` on `arn:aws:s3:::altus-db-backups/expense-tracker/*`
(and `s3:GetObject` only for whoever restores). Put `DATABASE_URL` and `BACKUP_BUCKET` in
`/etc/altus/backup.env` (mode 600), copy the script to `/opt/altus/`, and add the cron line from
the script's header.

## Restore

Restore into a new database first, check it, then switch the API over.

```bash
aws s3 ls s3://altus-db-backups/expense-tracker/ | tail -5
aws s3 cp s3://altus-db-backups/expense-tracker/<stamp>.dump.gz - | gunzip > restore.dump
createdb expense-tracker-restore
pg_restore --no-owner --no-privileges --dbname=expense-tracker-restore restore.dump
psql expense-tracker-restore -c 'select count(*) from transactions'
```

Test a restore once a month: an untested backup isn't a backup.
