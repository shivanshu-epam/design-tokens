#!/usr/bin/env node
// Phase 24 (design-sync-roadmap-phases-1-11.md §25) — the JIRA-triggered
// token agent's main pipeline. Triggered by .github/workflows/ticket-agent.yml
// on a repository_dispatch fired from a JIRA Automation rule when a ticket
// moves into "Ready for Agent".
//
// Structured tickets only for this pass — a ticket's description must
// contain the four fields parseTicket() looks for. Free-text interpretation
// (an LLM reading "make the button darker") is explicitly out of scope here;
// see §25's own reasoning for why that's the higher-risk half of this
// feature and deserves its own pass once the structured path is proven.
//
// The hard rule this script never breaks: if the ticket doesn't resolve to
// an unambiguous, existing token and a value that matches the repo's actual
// current state, this script comments asking for clarification and stops —
// it never guesses, and never opens a branch/PR on an assumption.
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { getIssue, addComment, transition } from './jira-client.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_PATH = path.join(root, 'design-tokens.json');

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, ISSUE_KEY } = process.env;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Mirrors resolve()/parseRefKey() in scripts/validate-tokens.mjs — kept as
// a separate copy rather than a shared import, matching that script's own
// header note ("reimplemented in plain JS here since this repo has no
// build step / shared module with the plugin repo").
function parseRefKey(refKey) {
  const idx = refKey.indexOf('/');
  if (idx === -1) return null;
  return { category: refKey.slice(0, idx), key: refKey.slice(idx + 1) };
}

function resolve(tokens, category, key, visited = new Set()) {
  const visitKey = `${category}/${key}`;
  if (visited.has(visitKey)) throw new Error(`circular reference at ${visitKey}`);
  visited.add(visitKey);
  const token = tokens[category]?.[key];
  if (!token) throw new Error(`token not found: ${visitKey}`);
  if (token.$value.kind === 'value') return token.$value.value;
  const parsed = parseRefKey(token.$value.refKey);
  if (!parsed) throw new Error(`malformed refKey at ${visitKey}`);
  return resolve(tokens, parsed.category, parsed.key, visited);
}

// The agreed structured format (plain text — JIRA API v2 returns
// description this way, no ADF to walk):
//   Token: color/brand/primary
//   Current value: #3678E2
//   New value: #2a5ec4
//   Reason: ...
function parseTicket(description) {
  const field = (label) => {
    const m = description.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : null;
  };
  return {
    tokenPath: field('Token'),
    currentValue: field('Current value'),
    newValue: field('New value'),
    reason: field('Reason'),
  };
}

function missingFieldsMessage(parsed) {
  const missing = [];
  if (!parsed.tokenPath) missing.push('Token');
  if (!parsed.currentValue) missing.push('Current value');
  if (!parsed.newValue) missing.push('New value');
  return (
    `This ticket is missing required field(s): ${missing.join(', ')}.\n\n` +
    'Please use this format in the description and move the ticket back to "Ready for Agent" when ready:\n\n' +
    'Token: category/token-key\nCurrent value: ...\nNew value: ...\nReason: ...'
  );
}

async function bounceForClarification(jira, issueKey, message) {
  await addComment(...jira, issueKey, message);
  await transition(...jira, issueKey, 'In Design');
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });
}

async function main() {
  const baseUrl = requireEnv('JIRA_BASE_URL', JIRA_BASE_URL);
  const email = requireEnv('JIRA_EMAIL', JIRA_EMAIL);
  const apiToken = requireEnv('JIRA_API_TOKEN', JIRA_API_TOKEN);
  const issueKey = requireEnv('ISSUE_KEY', ISSUE_KEY);
  const jira = [baseUrl, email, apiToken];

  console.log(`[ticket-agent] Fetching ${issueKey}…`);
  const issue = await getIssue(...jira, issueKey);
  const parsed = parseTicket(issue.description ?? '');

  if (!parsed.tokenPath || !parsed.currentValue || !parsed.newValue) {
    console.log('[ticket-agent] Ticket missing required fields — bouncing for clarification.');
    await bounceForClarification(jira, issueKey, missingFieldsMessage(parsed));
    return;
  }

  const refKey = parseRefKey(parsed.tokenPath);
  if (!refKey) {
    await bounceForClarification(
      jira,
      issueKey,
      `Couldn't parse "${parsed.tokenPath}" as a token path — expected the form "category/key", e.g. "color/brand/primary".`,
    );
    return;
  }

  const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  const token = tokens[refKey.category]?.[refKey.key];
  if (!token) {
    await bounceForClarification(
      jira,
      issueKey,
      `No token found at "${parsed.tokenPath}" in the current design-tokens.json. Double-check the path, or this may already have been renamed/removed.`,
    );
    return;
  }

  // References aren't supported by this pass — editing what a reference
  // token resolves to means editing a DIFFERENT token (the one it points
  // at), and silently doing that instead of what the ticket literally named
  // would be exactly the kind of guess §25 rules out.
  if (token.$value.kind !== 'value') {
    await bounceForClarification(
      jira,
      issueKey,
      `"${parsed.tokenPath}" is a reference token (points at ${token.$value.refKey}), not a direct value — this pass doesn't support editing references yet. Please target the underlying primitive token instead.`,
    );
    return;
  }

  const actualCurrent = resolve(tokens, refKey.category, refKey.key);
  const actualCurrentStr = typeof actualCurrent === 'string' ? actualCurrent : JSON.stringify(actualCurrent);
  if (actualCurrentStr.toLowerCase() !== parsed.currentValue.toLowerCase()) {
    await bounceForClarification(
      jira,
      issueKey,
      `The ticket says the current value is "${parsed.currentValue}", but design-tokens.json actually has "${actualCurrentStr}" for "${parsed.tokenPath}" right now. Please refresh the ticket with the real current value and re-queue it.`,
    );
    return;
  }

  console.log(`[ticket-agent] Applying ${parsed.tokenPath}: ${parsed.currentValue} → ${parsed.newValue}`);
  token.$value.value = parsed.newValue;
  writeFileSync(TOKENS_PATH, `${JSON.stringify(tokens, null, 2)}\n`);

  console.log('[ticket-agent] Validating…');
  try {
    sh('node', ['scripts/validate-tokens.mjs', 'design-tokens.json']);
  } catch (err) {
    // Validation failed — revert the file so this run leaves no trace, and
    // tell the ticket why instead of leaving a broken working tree behind.
    sh('git', ['checkout', '--', 'design-tokens.json']);
    await bounceForClarification(
      jira,
      issueKey,
      `The requested change failed validation:\n\n${err.stdout ?? err.message}`,
    );
    return;
  }

  const branch = `design-sync/agent-${issueKey}-${Date.now()}`;
  console.log(`[ticket-agent] Branching to ${branch}…`);
  sh('git', ['config', 'user.name', 'github-actions[bot]']);
  sh('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  sh('git', ['checkout', '-b', branch]);
  sh('git', ['add', 'design-tokens.json']);
  sh('git', ['commit', '-m', `Design Sync agent: ${parsed.tokenPath} → ${parsed.newValue} (${issueKey})`]);
  sh('git', ['push', 'origin', branch]);

  const title = `Design Sync agent: ${parsed.tokenPath} (${issueKey})`;
  const body = [
    `Ticket: ${baseUrl}/browse/${issueKey}`,
    '',
    `**Interpreted as:** change \`${parsed.tokenPath}\` from \`${parsed.currentValue}\` to \`${parsed.newValue}\`.`,
    '',
    parsed.reason ? `**Reason (from ticket):** ${parsed.reason}` : '',
    '',
    '_Opened automatically by the JIRA ticket agent — this PR will not be merged automatically. Please review before merging._',
  ]
    .filter((l) => l !== '')
    .join('\n');

  console.log('[ticket-agent] Opening PR…');
  const prUrl = sh('gh', ['pr', 'create', '--title', title, '--body', body, '--base', 'main', '--head', branch]).trim();

  await addComment(...jira, issueKey, `Opened ${prUrl} — awaiting review.`);
  await transition(...jira, issueKey, 'In Review');
  console.log(`[ticket-agent] Done — ${prUrl}`);
}

main().catch((err) => {
  console.error(`[ticket-agent] Fatal: ${err instanceof Error ? err.stack : String(err)}`);
  process.exitCode = 1;
});
