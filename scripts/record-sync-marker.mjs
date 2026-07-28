#!/usr/bin/env node
// Runs automatically after `npm run build-storybook` (npm's implicit
// postbuild-storybook hook). Stamps .storybook-sync.json with the git blob
// SHA of design-tokens.json at build time — `git hash-object` computes the
// exact same SHA GitHub's Contents API reports for that file, so the Figma
// plugin can tell whether Storybook was built from the tokens currently on
// GitHub without needing a live Storybook deployment to query.
import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = path.join(root, 'design-tokens.json');

const tokensBlobSha = execFileSync('git', ['hash-object', tokensPath], { cwd: root }).toString().trim();

const marker = {
  tokensBlobSha,
  builtAt: new Date().toISOString(),
};

writeFileSync(path.join(root, '.storybook-sync.json'), JSON.stringify(marker, null, 2) + '\n');
console.log(`[record-sync-marker] .storybook-sync.json -> tokensBlobSha=${tokensBlobSha}`);
