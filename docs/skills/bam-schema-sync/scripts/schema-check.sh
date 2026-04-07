#!/bin/bash
# BAM Schema Sync — Post-Migration Verification Script
# Run from Claude Code terminal after every supabase db push

REPO="/Users/derekshaw/bam-platform"
TYPES_FILE="$REPO/types/database.types.ts"
PROJECT_ID="niabwaofqsirfsktyyff"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  BAM Schema Sync Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$REPO"

if [ -f "$TYPES_FILE" ]; then
  MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$TYPES_FILE" 2>/dev/null)
  SIZE=$(wc -l < "$TYPES_FILE")
  echo "✅ Types file exists — modified: $MODIFIED — lines: $SIZE"
else
  echo "❌ TYPES FILE MISSING"
  echo "   Run in Regular Terminal:"
  echo "   supabase gen types typescript --project-id $PROJECT_ID > types/database.types.ts"
  exit 1
fi

echo ""
TABLE_COUNT=$(grep -c "Row:" "$TYPES_FILE" 2>/dev/null || echo "0")
MIGRATION_COUNT=$(ls "$REPO/supabase/migrations/"*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "📊 Tables in types: $TABLE_COUNT"
echo "📦 Migration files: $MIGRATION_COUNT"
echo ""

echo "🔍 Running TypeScript check..."
TS_OUTPUT=$(npx tsc --noEmit 2>&1 | head -20)
if [ -z "$TS_OUTPUT" ]; then
  echo "✅ TypeScript: CLEAN"
else
  echo "❌ TypeScript errors:"
  echo "$TS_OUTPUT"
fi

echo ""
GIT_STATUS=$(git status --short types/database.types.ts 2>/dev/null)
if [ -n "$GIT_STATUS" ]; then
  echo "⚠️  Types file has uncommitted changes — run: git add types/database.types.ts && git commit -m 'chore: regenerate types'"
else
  echo "✅ Types file committed"
fi

echo ""
echo "REMINDER: After every supabase db push, run in Regular Terminal:"
echo "  supabase gen types typescript --project-id $PROJECT_ID > types/database.types.ts"
echo ""
