#!/bin/bash
# Import JSON snapshots back into D1 (bulk upsert via INSERT OR REPLACE).
# Usage: ./scripts/db-import.sh [table_name]
#   If table_name is provided, only that table is imported.
#   Otherwise, all tables in db-snapshots/ are imported.
# Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_KEY, CLOUDFLARE_EMAIL env vars

set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
DB_ID="${CLOUDFLARE_D1_DB_ID:-}"
API_KEY="${CLOUDFLARE_API_KEY:-}"
EMAIL="${CLOUDFLARE_EMAIL:-}"

if [ -z "$ACCOUNT_ID" ] || [ -z "$DB_ID" ] || [ -z "$API_KEY" ] || [ -z "$EMAIL" ]; then
  echo "Error: Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DB_ID, CLOUDFLARE_API_KEY, and CLOUDFLARE_EMAIL env vars"
  exit 1
fi

SNAPSHOT_DIR="db-snapshots"
TARGET_TABLE="${1:-}"

if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo "Error: $SNAPSHOT_DIR directory not found. Run db-dump.sh first."
  exit 1
fi

run_sql() {
  local sql="$1"
  curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database/$DB_ID/query" \
    -H "X-Auth-Email: $EMAIL" \
    -H "X-Auth-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": $(echo "$sql" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}"
}

import_table() {
  local TABLE="$1"
  local FILE="$SNAPSHOT_DIR/$TABLE.json"

  if [ ! -f "$FILE" ]; then
    echo "  Skipping $TABLE (no snapshot file)"
    return
  fi

  local COUNT=$(python3 -c "import json; print(len(json.load(open('$FILE'))))")
  echo "  Importing $TABLE ($COUNT rows)..."

  # Generate and execute INSERT OR REPLACE statements in batches
  python3 -c "
import json, sys

with open('$FILE') as f:
    rows = json.load(f)

if not rows:
    print('    No rows to import')
    sys.exit(0)

# Generate SQL statements
for i, row in enumerate(rows):
    cols = list(row.keys())
    vals = []
    for c in cols:
        v = row[c]
        if v is None:
            vals.append('NULL')
        elif isinstance(v, (dict, list)):
            vals.append(\"'\" + json.dumps(v).replace(\"'\", \"''\") + \"'\")
        elif isinstance(v, (int, float)):
            vals.append(str(v))
        else:
            vals.append(\"'\" + str(v).replace(\"'\", \"''\") + \"'\")
    sql = f\"INSERT OR REPLACE INTO $TABLE ({', '.join(cols)}) VALUES ({', '.join(vals)});\"
    print(sql)
" | while IFS= read -r sql; do
    RESULT=$(run_sql "$sql")
    SUCCESS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")
    if [ "$SUCCESS" != "True" ]; then
      echo "    Warning: Failed to import row"
    fi
  done

  echo "    -> Done"
}

echo "Importing D1 data from $SNAPSHOT_DIR/..."

if [ -n "$TARGET_TABLE" ]; then
  import_table "$TARGET_TABLE"
else
  # Import in dependency order (elements first since others reference it)
  for TABLE in elements activities observations changelog; do
    import_table "$TABLE"
  done
fi

echo ""
echo "Import complete!"
