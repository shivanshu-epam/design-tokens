#!/usr/bin/env node
// Phase 24 (design-sync-roadmap-phases-1-11.md §25) — closes the loop on a
// ticket-agent PR's own lifecycle. Triggered by
// .github/workflows/ticket-agent-resolve.yml on pull_request:closed,
// filtered to branches this agent created (design-sync/agent-*).
//
// Merged → ticket moves to "Live". Closed without merging → ticket moves
// back to "In Design" so it can be revised and re-queued, with whatever
// reason is available in the comment.
import { addComment, transition } from './jira-client.mjs';

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, BRANCH_NAME, PR_URL, PR_MERGED } = process.env;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Branch shape: design-sync/agent-DS-123-1699999999999
function issueKeyFromBranch(branch) {
  const m = branch.match(/^design-sync\/agent-([A-Za-z][A-Za-z0-9]*-\d+)-\d+$/);
  return m ? m[1] : null;
}

async function main() {
  const baseUrl = requireEnv('JIRA_BASE_URL', JIRA_BASE_URL);
  const email = requireEnv('JIRA_EMAIL', JIRA_EMAIL);
  const apiToken = requireEnv('JIRA_API_TOKEN', JIRA_API_TOKEN);
  const branch = requireEnv('BRANCH_NAME', BRANCH_NAME);
  const prUrl = requireEnv('PR_URL', PR_URL);
  const jira = [baseUrl, email, apiToken];

  const issueKey = issueKeyFromBranch(branch);
  if (!issueKey) {
    console.log(`[ticket-agent-resolve] Branch "${branch}" doesn't match this agent's naming — nothing to do.`);
    return;
  }

  if (PR_MERGED === 'true') {
    console.log(`[ticket-agent-resolve] ${prUrl} merged — transitioning ${issueKey} to Live.`);
    await addComment(
      ...jira,
      issueKey,
      `${prUrl} was merged — this change is live in design-tokens.json. ` +
        "It won't appear in the Figma file until someone opens the Design Sync plugin there and runs Fetch & compare — this repo has no way to push into Figma directly (that needs a Figma Enterprise plan's Variables API, which isn't in use here).",
    );
    await transition(...jira, issueKey, 'Live');
  } else {
    console.log(`[ticket-agent-resolve] ${prUrl} closed without merging — bouncing ${issueKey} back to In Design.`);
    await addComment(
      ...jira,
      issueKey,
      `${prUrl} was closed without merging. Please revise this ticket if the change is still needed and move it back to "Ready for Agent".`,
    );
    await transition(...jira, issueKey, 'In Design');
  }
}

main().catch((err) => {
  console.error(`[ticket-agent-resolve] Fatal: ${err instanceof Error ? err.stack : String(err)}`);
  process.exitCode = 1;
});
