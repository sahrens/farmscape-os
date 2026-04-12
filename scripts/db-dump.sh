#!/bin/bash
# Dump all D1 tables to JSON files in db-snapshots/ for GitHub versioning.
# Usage: ./scripts/db-dump.sh
# Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_KEY, CLOUDFLARE_EMAIL env vars
#           (or set them in .env)

set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
DB_ID="${CLOUDFLARE_D1_DB_ID:-}"
API_KEY="${CLOUDFLARE_API_KEY:-}"
EMAIL="${CLOUDFLARE_EMAIL:-}"

if [ -z "$ACCOUNT_ID" ] || [ -z "$DB_ID" ] || [ -z "$API_KEY" ] || [ -z "$EMAIL" ]; then
  echo "Error: Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DB_ID, CLOUDFLARE_API_KEY, and CLOUDFLARE_EMAIL env vars"
  exit 1
fi

TABLES=("elements" "activities" "observations" "changelog")
SNAPSHOT_DIR="db-snapshots"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$SNAPSHOT_DIR"

echo "Dumping D1 tables at $TIMESTAMP..."

for TABLE in "${TABLES[@]}"; do
  echo "  Exporting $TABLE..."
  RESPONSE=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DB_ID/query" \
    -H "X-Auth-Email: $EMAIL" \
    -H "X-Auth-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": \"SELECT * FROM $TABLE\"}")

  # Extract the results array
  echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success') and data.get('result'):
    rows = data['result'][0].get('results', [])
    print(json.dumps(rows, indent=2, ensure_ascii=False))
else:
    print('[]')
    print('Warning: Failed to export $TABLE', file=sys.stderr)
    if data.get('errors'):
        print(json.dumps(data['errors'], indent=2), file=sys.stderr)
" > "$SNAPSHOT_DIR/$TABLE.json"

  COUNT=$(python3 -c "import json; print(len(json.load(open('$SNAPSHOT_DIR/$TABLE.json'))))")
  echo "    -> $COUNT rows saved to $SNAPSHOT_DIR/$TABLE.json"
done

# Write metadata
cat > "$SNAPSHOT_DIR/_meta.json" << EOF
{
  "exported_at": "$TIMESTAMP",
  "tables": $(printf '%s\n' "${TABLES[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")
}
EOF

echo ""
echo "Done! Snapshot saved to $SNAPSHOT_DIR/"
echo "Commit with: git add $SNAPSHOT_DIR && git commit -m 'DB snapshot $TIMESTAMP'"
