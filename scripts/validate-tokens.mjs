#!/usr/bin/env node
// CI/local validator for design-tokens.json. Exits non-zero on any schema
// violation, circular/broken token reference, cross-category duplicate
// variable id, or malformed shadow layer. Wired into CI by the roadmap's
// Phase 4 (.github/workflows/validate-tokens.yml); usable standalone now:
//
//   node scripts/validate-tokens.mjs design-tokens.json
//
// Mirrors the reference-resolution rules in the plugin's shared/tokens.ts
// (resolveToken/validateTokenSet) — reimplemented in plain JS here since
// this repo has no build step / shared module with the plugin repo.

import { readFileSync } from 'fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-tokens.mjs <path-to-design-tokens.json>');
  process.exit(2);
}

const CATEGORIES = ['color', 'typography', 'shadow', 'dimension', 'string', 'boolean'];

let tokens;
try {
  tokens = JSON.parse(readFileSync(filePath, 'utf8'));
} catch (err) {
  console.error(`Couldn't read/parse ${filePath}: ${err.message}`);
  process.exit(2);
}

const errors = [];

function parseRefKey(refKey) {
  const idx = refKey.indexOf('/');
  if (idx === -1) return null;
  return { category: refKey.slice(0, idx), key: refKey.slice(idx + 1) };
}

function resolve(category, key, visited) {
  const visitKey = `${category}/${key}`;
  if (visited.has(visitKey)) {
    throw new Error(`circular reference at ${visitKey}`);
  }
  visited.add(visitKey);
  const bucket = tokens[category];
  const token = bucket && bucket[key];
  if (!token) {
    throw new Error(`token not found: ${visitKey}`);
  }
  if (!token.$value || typeof token.$value !== 'object' || !('kind' in token.$value)) {
    throw new Error(`malformed $value at ${visitKey} (expected { kind: 'value'|'reference', ... })`);
  }
  if (token.$value.kind === 'value') return token.$value.value;
  if (token.$value.kind === 'reference') {
    const parsed = parseRefKey(token.$value.refKey);
    if (!parsed) throw new Error(`malformed refKey at ${visitKey}: ${token.$value.refKey}`);
    return resolve(parsed.category, parsed.key, visited);
  }
  throw new Error(`unknown $value.kind at ${visitKey}: ${token.$value.kind}`);
}

// 1. Schema + reference validation.
for (const category of CATEGORIES) {
  const bucket = tokens[category];
  if (bucket === undefined) continue; // categories are optional in the file
  if (typeof bucket !== 'object' || Array.isArray(bucket)) {
    errors.push({ category, key: '(root)', message: `"${category}" must be an object` });
    continue;
  }
  for (const key of Object.keys(bucket)) {
    try {
      resolve(category, key, new Set());
    } catch (err) {
      errors.push({ category, key, message: err.message });
    }
  }
}

// 2. Cross-category duplicate variable ids. One Figma variable has exactly
// one resolvedType, so the same variableId legitimately repeats across
// mode-scoped keys WITHIN a category (that's just its Light/Dark/etc.
// values) but should never show up under two different categories.
const variableIdCategories = new Map(); // variableId -> Set<category>
for (const category of CATEGORIES) {
  const bucket = tokens[category];
  if (!bucket) continue;
  for (const token of Object.values(bucket)) {
    const variableId = token?.$extensions?.['design-sync.variableId'];
    if (!variableId) continue;
    const set = variableIdCategories.get(variableId) ?? new Set();
    set.add(category);
    variableIdCategories.set(variableId, set);
  }
}
for (const [variableId, categories] of variableIdCategories) {
  if (categories.size > 1) {
    errors.push({
      category: [...categories].join('+'),
      key: '(cross-category)',
      message: `variable id ${variableId} appears in multiple categories: ${[...categories].join(', ')}`,
    });
  }
}

// 3. Malformed shadow layers, checked on the RESOLVED value — a shadow
// token that's a reference to a valid shadow still passes.
const shadowBucket = tokens.shadow ?? {};
for (const key of Object.keys(shadowBucket)) {
  let resolved;
  try {
    resolved = resolve('shadow', key, new Set());
  } catch {
    continue; // already reported above
  }
  if (!Array.isArray(resolved)) {
    errors.push({ category: 'shadow', key, message: 'resolved value is not an array of shadow layers' });
    continue;
  }
  resolved.forEach((layer, i) => {
    const problems = [];
    if (layer.type !== 'DROP_SHADOW' && layer.type !== 'INNER_SHADOW') problems.push('type');
    if (typeof layer.color !== 'string') problems.push('color');
    if (typeof layer.offsetX !== 'number') problems.push('offsetX');
    if (typeof layer.offsetY !== 'number') problems.push('offsetY');
    if (typeof layer.blur !== 'number') problems.push('blur');
    if (typeof layer.spread !== 'number') problems.push('spread');
    if (problems.length > 0) {
      errors.push({ category: 'shadow', key, message: `layer ${i} malformed field(s): ${problems.join(', ')}` });
    }
  });
}

if (errors.length === 0) {
  console.log(`[validate-tokens] ${filePath} is valid.`);
  process.exit(0);
}

console.error(`[validate-tokens] ${errors.length} problem(s) in ${filePath}:`);
for (const e of errors) {
  console.error(`  ${e.category}/${e.key} — ${e.message}`);
}
process.exit(1);
