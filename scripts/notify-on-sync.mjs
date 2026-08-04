#!/usr/bin/env node
// Posts a summary of new .design-sync/audit-log.jsonl entries to Microsoft
// Teams and/or Slack, whichever webhook secrets are configured. Both
// platforms are optional and independent — set one, the other, or both.
//
// Two trigger shapes, distinguished by GITHUB_EVENT_NAME:
//   - push (path-filtered to audit-log.jsonl): posts one message per audit
//     entry that's new since the previous commit.
//   - workflow_dispatch (the plugin's "Send test notification" button):
//     posts a single fixed test message, regardless of the log's content —
//     this lets a team verify their webhook is wired up correctly without
//     needing to run a real sync first.
//
// Both providers accept the same minimal `{ "text": "..." }` JSON body for
// a plain-text message: that's Slack's classic incoming-webhook contract,
// and it's also what Teams' Workflows app expects when the flow is created
// from the built-in "Post to a channel when a webhook request is received"
// template with its default "Text" field — see the plugin's Connect tab
// for the exact setup steps. Keeping both providers on the same payload
// shape means this script has no per-provider branching beyond "which URL
// to POST to."
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_LOG_PATH = path.join(root, '.design-sync', 'audit-log.jsonl');

async function postText(url, text) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    // A webhook failure (revoked URL, flow deleted in Teams, etc.) shouldn't
    // fail the whole CI run — the sync itself already succeeded and merged;
    // losing a notification is a much smaller problem than a red check on
    // an otherwise-fine PR.
    console.error(`[notify-on-sync] POST to ${url.replace(/\/[^/]+$/, '/…')} failed: ${res.status} ${res.statusText}`);
  }
}

function formatEntry(entry) {
  // Deliberately plain text, no markdown — Teams' Adaptive Card TextBlock
  // and Slack's mrkdwn use two different, incompatible syntaxes for bold
  // and links ([text](url) vs <url|text>), and this script has no way to
  // know which provider(s) will actually receive a given message. Plain
  // text renders identically and correctly on both.
  const when = new Date(entry.timestamp).toLocaleString();
  const changeWord = entry.changes.length === 1 ? 'token' : 'tokens';
  return `Design Sync: ${entry.actor} synced ${entry.changes.length} ${changeWord} — PR #${entry.prNumber}: ${entry.prUrl} (${when})`;
}

async function main() {
  const teamsUrl = process.env.TEAMS_WEBHOOK_URL;
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!teamsUrl && !slackUrl) {
    console.log('[notify-on-sync] Neither TEAMS_WEBHOOK_URL nor SLACK_WEBHOOK_URL is set — nothing to do.');
    return;
  }

  const messages = [];
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    messages.push('🔔 Design Sync test notification — your integration is working.');
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
        messages.push(formatEntry(JSON.parse(line)));
      } catch (err) {
        console.error(`[notify-on-sync] Skipping unparseable audit log line: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (messages.length === 0) return;
  const text = messages.join('\n\n');
  if (teamsUrl) await postText(teamsUrl, text);
  if (slackUrl) await postText(slackUrl, text);
  console.log(`[notify-on-sync] Sent ${messages.length} message(s) to ${[teamsUrl && 'Teams', slackUrl && 'Slack'].filter(Boolean).join(' and ')}.`);
}

main().catch((err) => {
  console.error(`[notify-on-sync] Unexpected error: ${err instanceof Error ? err.stack : String(err)}`);
  process.exitCode = 1;
});
