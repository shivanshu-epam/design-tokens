// Shared JIRA REST client for the ticket-agent scripts (Phase 24 —
// design-sync-roadmap-phases-1-11.md §25). Uses API v2, not v3 — v2
// returns/accepts `description` and comment `body` as plain strings; v3
// uses Atlassian Document Format (a nested JSON structure) for the same
// fields. Sticking to v2 avoids writing an ADF parser for a first version.
//
// Auth is HTTP Basic (email:apiToken, base64) — JIRA_BASE_URL/JIRA_EMAIL/
// JIRA_API_TOKEN are read from process.env by the callers, never hold a
// module-level default, so nothing here can accidentally run without the
// caller having explicitly wired up the three secrets.

function authHeader(email, apiToken) {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

function jiraFetch(baseUrl, email, apiToken, path, init = {}) {
  return fetch(`${baseUrl}/rest/api/2${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(email, apiToken),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export async function getIssue(baseUrl, email, apiToken, issueKey) {
  const res = await jiraFetch(baseUrl, email, apiToken, `/issue/${issueKey}?fields=summary,description`);
  if (!res.ok) {
    throw new Error(`GET issue ${issueKey} failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return { summary: body.fields.summary, description: body.fields.description ?? '' };
}

export async function addComment(baseUrl, email, apiToken, issueKey, text) {
  const res = await jiraFetch(baseUrl, email, apiToken, `/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: text }),
  });
  if (!res.ok) {
    throw new Error(`POST comment on ${issueKey} failed: ${res.status} ${await res.text()}`);
  }
}

// Transitions are addressed by id, not status name, in JIRA's API — this
// lists the issue's currently-available transitions and matches by the
// human-readable name the rest of this codebase uses everywhere else
// (case-insensitive, since JIRA's own UI is inconsistent about casing
// between where a status name is typed vs displayed).
export async function transition(baseUrl, email, apiToken, issueKey, statusName) {
  const listRes = await jiraFetch(baseUrl, email, apiToken, `/issue/${issueKey}/transitions`);
  if (!listRes.ok) {
    throw new Error(`GET transitions for ${issueKey} failed: ${listRes.status} ${await listRes.text()}`);
  }
  const { transitions } = await listRes.json();
  const match = transitions.find((t) => t.to?.name?.toLowerCase() === statusName.toLowerCase());
  if (!match) {
    const available = transitions.map((t) => t.to?.name).join(', ');
    throw new Error(
      `No transition to "${statusName}" available from ${issueKey}'s current status. Available targets: ${available || '(none)'}`,
    );
  }
  const doRes = await jiraFetch(baseUrl, email, apiToken, `/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: match.id } }),
  });
  if (!doRes.ok) {
    throw new Error(`POST transition on ${issueKey} to "${statusName}" failed: ${doRes.status} ${await doRes.text()}`);
  }
}
