#!/bin/sh
set -e

echo "=== Step 1: Update packages to latest versions ==="
npx npm-check-updates -u
rm -rf node_modules package-lock.json
npm install

echo ""
echo "=== Step 2: Verify build still works ==="
npm run build

echo ""
echo "=== Changes ==="
git --no-pager diff --stat package.json package-lock.json 2>/dev/null || true
echo ""
git --no-pager diff package.json 2>/dev/null || true

echo ""
echo "Done. If everything looks good, commit with:"
echo "  git add package.json package-lock.json"
echo "  git commit -m 'chore: update node dependencies'"
