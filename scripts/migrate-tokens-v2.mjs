#!/usr/bin/env node
// One-time migration: upgrades design-tokens.json from the pre-Phase-1 flat
// shape (`$value: <concrete value>`) to the Phase 1 DTCG-aligned shape
// (`$value: { kind: 'value', value: <concrete> } | { kind: 'reference', refKey }`),
// and adds the new `string`/`boolean` top-level categories.
//
// This is NOT auto-run by the plugin — per the roadmap, a repo-wide schema
// change like this deserves a human looking at the diff before it's
// committed. Run it yourself:
//
//   node scripts/migrate-tokens-v2.mjs
//
// It only rewrites design-tokens.json on disk; you still `git diff`, review,
// and `git add && git commit && git push` yourself.
//
// Note on provenance: pre-migration tokens have no $extensions (the old
// shape never recorded where a token came from), so this script leaves
// $extensions unset for existing tokens rather than guessing. The very next
// sync from the plugin repopulates it correctly for every token anyway
// (see code.ts's readFigmaTokens), so nothing is lost long-term.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = path.join(root, 'design-tokens.json');

if (!existsSync(tokensPath)) {
  console.error(`[migrate-tokens-v2] ${tokensPath} not found.`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(tokensPath, 'utf8'));

const LEGACY_CATEGORIES = ['color', 'typography', 'shadow', 'dimension'];
const ALL_CATEGORIES = [...LEGACY_CATEGORIES, 'string', 'boolean'];

function isAlreadyMigrated(raw) {
  // Heuristic: if every present category's entries already have a $value
  // with a `kind` field, there's nothing to do.
  for (const category of LEGACY_CATEGORIES) {
    const bucket = raw[category];
    if (!bucket) continue;
    for (const token of Object.values(bucket)) {
      if (token && token.$value && typeof token.$value === 'object' && 'kind' in token.$value) {
        return true;
      }
      // Only need to check one token to know the shape.
      return false;
    }
  }
  return false;
}

if (isAlreadyMigrated(raw)) {
  console.log('[migrate-tokens-v2] Already in the v2 shape — nothing to do.');
  process.exit(0);
}

const migrated = {};
let migratedCount = 0;

for (const category of LEGACY_CATEGORIES) {
  const bucket = raw[category] ?? {};
  const next = {};
  for (const [key, token] of Object.entries(bucket)) {
    next[key] = {
      $type: token.$type ?? category,
      $value: { kind: 'value', value: token.$value },
      ...(token.$description ? { $description: token.$description } : {}),
    };
    migratedCount++;
  }
  migrated[category] = next;
}

// New in Phase 1 — start empty; populated by the plugin the next time it
// reads STRING/BOOLEAN variables from Figma.
migrated.string = raw.string ?? {};
migrated.boolean = raw.boolean ?? {};

// Preserve any unknown top-level keys rather than silently dropping them.
for (const key of Object.keys(raw)) {
  if (!ALL_CATEGORIES.includes(key)) migrated[key] = raw[key];
}

writeFileSync(tokensPath, JSON.stringify(migrated, null, 2) + '\n');
console.log(`[migrate-tokens-v2] Migrated ${migratedCount} token(s) to the v2 shape.`);
console.log('[migrate-tokens-v2] Review the diff, then commit and push yourself:');
console.log('  git diff design-tokens.json');
console.log('  git add design-tokens.json');
console.log('  git commit -m "chore: migrate tokens to v2 schema (design-sync)"');
console.log('  git push');
