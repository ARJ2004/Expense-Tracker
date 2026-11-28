#!/usr/bin/env bash
# Publishes a signed release APK to the website: uploads it to S3 and points /get at it.
# Run from your Mac with the AWS profile that owns the stack (CI is not allowed to touch apk/*).
#
#   ./infra/web/publish-apk.sh <path/to/app-release.apk> <versionName> <versionCode>
#
# Needs: aws CLI v2, and the stack outputs (it reads them itself). Optional: AWS_PROFILE.
set -euo pipefail

APK="${1:?path to the signed APK}"
VERSION_NAME="${2:?versionName, e.g. 1.0.0}"
VERSION_CODE="${3:?versionCode, e.g. 2}"
STACK="${STACK:-altus-web}"
REGION="${AWS_REGION:-ap-south-1}"

out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET="$(out BucketName)"
KVS_ARN="$(out KeyValueStoreArn)"
SITE_URL="$(out SiteUrl)"
KEY="apk/altus-${VERSION_NAME}-${VERSION_CODE}.apk"

if [[ "$(head -c 2 "$APK")" != "PK" ]]; then echo "Not an APK: $APK" >&2; exit 1; fi
SHA256="$(shasum -a 256 "$APK" | cut -d' ' -f1)"
SIZE="$(wc -c < "$APK" | tr -d ' ')"
echo "Uploading $KEY ($SIZE bytes, sha256 $SHA256)"

aws s3 cp "$APK" "s3://$BUCKET/$KEY" --region "$REGION" \
  --content-type application/vnd.android.package-archive \
  --content-disposition "attachment; filename=\"altus-${VERSION_NAME}.apk\"" \
  --cache-control 'public, max-age=31536000, immutable' \
  --metadata "sha256=$SHA256"

REMOTE_SIZE="$(aws s3api head-object --region "$REGION" --bucket "$BUCKET" --key "$KEY" --query ContentLength --output text)"
[[ "$REMOTE_SIZE" == "$SIZE" ]] || { echo "Size mismatch after upload ($REMOTE_SIZE vs $SIZE)" >&2; exit 1; }

printf '{"versionName":"%s","versionCode":%s,"path":"/%s","sizeBytes":%s,"sha256":"%s","date":"%s"}\n' \
  "$VERSION_NAME" "$VERSION_CODE" "$KEY" "$SIZE" "$SHA256" "$(date +%F)" > /tmp/altus-latest.json
aws s3 cp /tmp/altus-latest.json "s3://$BUCKET/apk/latest.json" --region "$REGION" \
  --content-type application/json --cache-control 'public, max-age=60'

# Point /get at the new file (takes effect within seconds; no invalidation needed).
ETAG="$(aws cloudfront-keyvaluestore describe-key-value-store --kvs-arn "$KVS_ARN" --query ETag --output text)"
aws cloudfront-keyvaluestore put-key --kvs-arn "$KVS_ARN" --if-match "$ETAG" --key apk_latest --value "/$KEY" > /dev/null

echo
echo "Published. Check: curl -sI $SITE_URL/get   (302 to /$KEY)"
echo "Then record it on the Download page:"
echo "  pnpm --filter @et/web release:apk $APK $VERSION_NAME $VERSION_CODE <signing-cert-sha256>"
echo "  git commit -am 'web: APK $VERSION_NAME' && git push   (the site redeploys)"
