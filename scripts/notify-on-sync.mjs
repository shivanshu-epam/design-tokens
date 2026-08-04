#!/usr/bin/env node
// Posts a summary of new .design-sync/audit-log.jsonl entries to Microsoft
// Teams and/or Slack, whichever webhook secrets are configured. Both
// platforms are optional and independent — set one, the other, or both.
//
// Two trigger shapes, distinguished by GITHUB_EVENT_NAME:
//   - push (path-filtered to audit-log.jsonl): posts one message per audit
//     entry that's new since the previous commit, including the actual
//     per-token before/after values.
//   - workflow_dispatch (the plugin's "Send test notification" button):
//     posts a single fixed test message, regardless of the log's content —
//     this lets a team verify their webhook is wired up correctly without
//     needing to run a real sync first.
//
// Teams and Slack need genuinely different payload shapes — found the hard
// way via a real failed flow run (tracking error: "Property 'type' must be
// 'AdaptiveCard'"). Microsoft's own "Post to a channel when a webhook
// request is received" template doesn't extract a field from the request —
// it treats the ENTIRE POSTed JSON body as the Adaptive Card to render, so
// it must already be a valid `{"type": "AdaptiveCard", ...}` object. Slack's
// classic incoming webhook, by contrast, wants the plain `{"text": "..."}`
// shape. There's no shape that satisfies both, so each provider gets its
// own payload builder below, both fed by the same neutral `Summary` shape.
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_LOG_PATH = path.join(root, '.design-sync', 'audit-log.jsonl');

// audit-log.jsonl stores each change's previousValue/newValue as the FULL
// DesignToken object ({$type, $value: {kind, value|refKey}, $extensions}),
// not a bare scalar — matches the shape sync-logic.ts's computeAuditChanges
// actually writes. Extract just what's worth showing in a notification.
function resolvedValueOf(token) {
  if (token === undefined) return '—';
  const v = token.$value;
  if (!v) return JSON.stringify(token);
  if (v.kind === 'reference') return `→ ${v.refKey}`;
  return typeof v.value === 'string' ? v.value : JSON.stringify(v.value);
}

const MAX_CHANGE_LINES = 12;

function changeLines(changes) {
  const lines = changes
    .slice(0, MAX_CHANGE_LINES)
    .map((c) => `${c.category}/${c.key}: ${resolvedValueOf(c.previousValue)} → ${resolvedValueOf(c.newValue)}`);
  if (changes.length > MAX_CHANGE_LINES) lines.push(`…and ${changes.length - MAX_CHANGE_LINES} more`);
  return lines;
}

function teamsAdaptiveCard({ title, facts, lines, url, urlLabel }) {
  const body = [{ type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true }];
  if (facts.length > 0) body.push({ type: 'FactSet', facts: facts.map(([t, v]) => ({ title: t, value: v })) });
  if (lines.length > 0) body.push({ type: 'TextBlock', text: lines.map((l) => `- ${l}`).join('\n\n'), wrap: true, isSubtle: true, size: 'Small' });
  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
  };
  if (url) card.actions = [{ type: 'Action.OpenUrl', title: urlLabel ?? 'Open', url }];
  return card;
}

function slackPayload({ title, facts, lines, url, urlLabel }) {
  const parts = [title];
  if (facts.length > 0) parts.push(facts.map(([t, v]) => `${t}: ${v}`).join(' · '));
  if (lines.length > 0) parts.push(lines.map((l) => `• ${l}`).join('\n'));
  if (url) parts.push(`${urlLabel ?? 'Open'}: ${url}`);
  return { text: parts.join('\n\n') };
}

async function post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // A webhook failure (revoked URL, flow deleted in Teams, etc.) shouldn't
    // fail the whole CI run — the sync itself already succeeded and merged;
    // losing a notification is a much smaller problem than a red check on
    // an otherwise-fine PR. Note: Teams' webhook trigger returns success as
    // soon as it accepts the request, before the flow has actually run —
    // a 2xx here does NOT guarantee the message posted; check the flow's
    // own run history in Power Automate to confirm delivery.
    console.error(`[notify-on-sync] POST to ${url.replace(/\/[^/]+$/, '/…')} failed: ${res.status} ${res.statusText}`);
  }
}

function summarizeEntry(entry) {
  const when = new Date(entry.timestamp).toLocaleString();
  const changeWord = entry.changes.length === 1 ? 'token' : 'tokens';
  return {
    title: `Design Sync: ${entry.actor} synced ${entry.changes.length} ${changeWord}`,
    facts: [
      ['Actor', entry.actor],
      ['When', when],
    ],
    lines: changeLines(entry.changes),
    url: entry.prUrl,
    urlLabel: `View pull request #${entry.prNumber}`,
  };
}

function testSummary() {
  return {
    title: '🔔 Design Sync test notification',
    facts: [],
    lines: ['Your integration is working.'],
    url: undefined,
    urlLabel: undefined,
  };
}

async function main() {
  const teamsUrl = process.env.TEAMS_WEBHOOK_URL;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!teamsUrl && !slackUrl) {
    console.log('[notify-on-sync] Neither TEAMS_WEBHOOK_URL nor SLACK_WEBHOOK_URL is set — nothing to do.');
    return;
  }

  const summaries = [];
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    summaries.push(testSummary());
  } else {
    // Compare against the previous commit's version of the file to isolate
    // just the entries this push added — audit-log.jsonl only ever grows,
    // so "new lines since HEAD~1" is exactly "what this sync appended."
    let previous = '';
    try {
      previous = execFileSync('git', ['show', 'HEAD~1:.design-sync/audit-log.jsonl'], { cwd: root, encoding: 'utf8' });
    } catch {
      // No previous version (first-ever entry, or file didn't exist before
      // this commit) — treat every current line as new.
    }
    const previousLineCount = previous.split('\n').filter((l) => l.trim()).length;
    const current = readFileSync(AUDIT_LOG_PATH, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    const newLines = current.slice(previousLineCount);
    if (newLines.length === 0) {
      console.log('[notify-on-sync] No new audit entries in this push — nothing to notify.');
      return;
    }
    for (const line of newLines) {
      try {
        summaries.push(summarizeEntry(JSON.parse(line)));
      } catch (err) {
        console.error(`[notify-on-sync] Skipping unparseable audit log line: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (summaries.length === 0) return;
  for (const summary of summaries) {
    if (teamsUrl) await post(teamsUrl, teamsAdaptiveCard(summary));
    if (slackUrl) await post(slackUrl, slackPayload(summary));
  }
  console.log(`[notify-on-sync] Sent ${summaries.length} message(s) to ${[teamsUrl && 'Teams', slackUrl && 'Slack'].filter(Boolean).join(' and ')}.`);
}

main().catch((err) => {
  console.error(`[notify-on-sync] Unexpected error: ${err instanceof Error ? err.stack : String(err)}`);
  process.exitCode = 1;
});
