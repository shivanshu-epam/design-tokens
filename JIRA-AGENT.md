# JIRA-triggered token agent

Turns a JIRA ticket into a reviewed pull request against `design-tokens.json`,
automatically — no one has to open Figma or the plugin for a straightforward token
change. This is the *reverse* of the plugin's own sync direction: normally Figma →
GitHub; this pipeline is JIRA → GitHub, closing a different loop entirely.

Built and validated end-to-end 2026-08-12. Roadmap spec: `design-sync-roadmap-phases-1-11.md`
§25 (Phase 24) in the plugin repo (`Figma-Github Sync`).

## Why this exists

Design tokens change for reasons that have nothing to do with a designer sitting in
Figma — a stakeholder files a ticket asking for a brand color to shift, a bug report
says a spacing token is wrong, someone wants a documented, tracked change without
touching the design file at all. Before this, every one of those requests still had to
route through a human manually editing Figma (or `design-tokens.json` directly) and
running a sync. This pipeline lets the ticket itself be the trigger.

## Architecture

```
┌─────────────┐   ticket moves to    ┌──────────────────┐   POST /dispatches   ┌───────────────────┐
│    JIRA     │  "Ready for Agent"   │  JIRA Automation  │ ──────────────────► │  GitHub Actions    │
│  (DS project)│ ───────────────────►│      rule         │   (repository_      │  ticket-agent.yml  │
└──────┬──────┘                      └──────────────────┘    dispatch event)   └─────────┬──────────┘
       ▲                                                                                  │
       │ comment + status transition                                                      ▼
       │                                                                    ┌──────────────────────────┐
       │                                                                    │  scripts/ticket-agent.mjs │
       │                                                                    │  1. fetch ticket (JIRA)   │
       │                                                                    │  2. parse structured desc │
       │                                                                    │  3. resolve + validate    │
       │                                                                    │     against real tokens   │
       │                                                                    │  4. branch, commit, push  │
       │                                                                    │  5. open PR (gh CLI)      │
       │                                                                    └─────────┬──────────────────┘
       │                                                                              │
       │                                                                              ▼
       │                                                                     ┌──────────────────┐
       │                                                                     │   Pull Request     │
       │                                                                     │  (human reviews,    │
       │                                                                     │   never auto-merged)│
       │                                                                     └────────┬────────────┘
       │                                                                              │ merged or closed
       │                                                                              ▼
       │                                                        ┌────────────────────────────────────┐
       └────────────────────────────────────────────────────────┤ .github/workflows/                  │
                                                                  │   ticket-agent-resolve.yml           │
                                                                  │ scripts/ticket-agent-resolve.mjs     │
                                                                  └───────────────────────────────────────┘
```

Two independent triggers, two independent GitHub Actions workflows, one shared JIRA
client module. Nothing here talks to Figma or the plugin at all — this operates purely
on `design-tokens.json` in this repo, the same file the plugin syncs.

## The pieces

### `scripts/jira-client.mjs` — shared JIRA REST helper
Three functions, used by both workflows below:
- `getIssue(issueKey)` — fetches summary + description.
- `addComment(issueKey, text)` — posts a plain-text comment.
- `transition(issueKey, statusName)` — moves the ticket to a named status. JIRA
  addresses transitions by numeric id, not name, so this first lists the issue's
  *currently available* transitions and matches by the human-readable status name
  (case-insensitive) — if that status isn't reachable from the ticket's current state,
  it throws with the list of what *is* available, rather than failing silently.

Uses **JIRA REST API v2**, not v3, deliberately — v2 returns/accepts `description` and
comment `body` as plain strings. v3 uses Atlassian Document Format (a nested JSON
structure) for the same fields, which would need its own parser for no benefit here.

Auth: HTTP Basic, `email:apiToken` base64-encoded — standard JIRA Cloud API auth.

### `scripts/ticket-agent.mjs` — the main pipeline
Triggered by `ticket-agent.yml` on `repository_dispatch`. Full sequence:

1. Fetch the ticket, parse its description for four fields (see "Ticket format" below).
2. **Any missing field** → comment explaining what's missing, transition to "In
   Design," stop. No branch, no PR.
3. Resolve the token path against the *real*, current `design-tokens.json` (same
   category/key split and reference-following logic as `validate-tokens.mjs`).
   - Token doesn't exist → clarification comment, stop.
   - Token is a **reference** (points at another token, not a direct value) → not
     supported yet, clarification comment, stop. Silently editing what a reference
     resolves to would mean editing a *different* token than the one named in the
     ticket — exactly the kind of guess this pipeline refuses to make.
   - Ticket's stated "Current value" doesn't match what's actually in the file right
     now → clarification comment (the ticket is stale against real state), stop.
4. If everything checks out: apply the new value, write the file back
   (`JSON.stringify(tokens, null, 2)` — matches the file's existing formatting exactly,
   so the PR diff is just the one changed line, not a reformatting noise-diff).
5. Run `node scripts/validate-tokens.mjs design-tokens.json` before committing
   anything. Validation failure → revert the file (`git checkout --`), comment with the
   validator's own error output, stop.
6. Branch (`design-sync/agent-{ISSUE-KEY}-{timestamp}`), commit, push.
7. Open a PR via the `gh` CLI (preinstalled on GitHub-hosted runners). The PR body
   includes the ticket link, an **"Interpreted as"** line restating what the agent
   understood the request to be, and the ticket's stated reason — this is the actual
   review surface a human uses to sanity-check the agent's interpretation without
   re-reading the raw ticket.
8. Comment on the ticket with the PR link, transition to "In Review."

### `scripts/ticket-agent-resolve.mjs` — closes the loop
Triggered by `ticket-agent-resolve.yml` on `pull_request: types: [closed]`, but **only**
for PRs whose branch matches `design-sync/agent-*` (checked via the workflow's own `if:`
condition, before the script even runs — a human-authored PR closing never touches JIRA).

Extracts the issue key straight out of the branch name (embedded at creation time — no
extra API round-trip needed to look it up). Then:
- **Merged** → transition to "Live," comment confirming the merge.
- **Closed without merging** → transition back to "In Design," comment noting the PR
  closed and inviting the ticket to be revised and re-queued.

## Ticket format

Structured only, for this version — free-text interpretation (an LLM reading "make the
button a bit darker" and figuring out the rest) is a deliberate, separate future
extension, not something this pipeline attempts. A ticket's description must contain:

```
Token: category/token-key
Current value: <exact current value>
New value: <the value to change it to>
Reason: <why — included in the PR body, otherwise unused>
```

`Token` is split on the **first** `/` into category + key (categories:
`color`, `typography`, `shadow`, `dimension`, `string`, `boolean` — matching
`design-tokens.json`'s own top-level shape). Everything after that first slash is the
key as-is, including any further slashes — token keys in this repo routinely contain
them (e.g. `additional palette/yellow/yellow-5`).

## JIRA-side setup (already done, documented here for anyone rebuilding it)

- **Site**: `epam-ai-ux.atlassian.net`, project **`DS`** ("Design Tokens"), Team-managed.
- **Statuses**: To Do → In Design → Ready for Agent → In Review → Live.
  - **Ready for Agent** is the trigger status.
  - **In Design** is both "still being drafted" and where the agent bounces a ticket
    back to when it can't act on it — reused rather than adding a separate "Needs
    Info" status.
  - **In Review** = a PR is open, waiting on a human.
  - **Live** = merged. ("Approved" was considered and deliberately dropped — Storybook's
    auto-deploy on merge (`.github/workflows/deploy-storybook.yml`) happens close enough
    to instantly that a separate "merged but not yet live" state added no real signal.)
- **Automation rule** (Project settings → Automation): trigger "Work item transitioned"
  → to status "Ready for Agent"; action "Send web request" →
  `POST https://api.github.com/repos/shivanshu-epam/design-tokens/dispatches` with a
  JSON body:
  ```json
  {
    "event_type": "jira-ticket-ready",
    "client_payload": {
      "issueKey": "{{issue.key}}",
      "issueSummary": "{{issue.summary}}"
    }
  }
  ```
  (Use JIRA's own `{}` smart-value picker to insert these — typing the variable name by
  hand risks leaving literal placeholder text in the body; see "Gotchas" below.)
  Headers: `Content-Type: application/json`, `Authorization: Bearer <a GitHub token>`,
  `Accept: application/vnd.github+json`.

## GitHub-side setup

- **3 repo secrets** (Settings → Secrets and variables → Actions) on `design-tokens`:
  `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
- **Workflow permissions** (Settings → Actions → General → "Workflow permissions"):
  "Allow GitHub Actions to create and approve pull requests" must be checked — see
  "Gotchas" below for why this bit us during setup.
- **No GitHub App, no separate bot PAT for the response side.** `ticket-agent.yml`
  declares `permissions: { contents: write, pull-requests: write }` and uses the
  automatically-provided `secrets.GITHUB_TOKEN` — since the workflow runs *inside* this
  repo, that's sufficient to push a branch and open a PR. (The token used in the JIRA
  Automation rule's own web-request header is a separate, one-way credential — JIRA
  needs *some* GitHub token to fire the initial dispatch; a fine-grained PAT scoped to
  just this repo with Contents: Read and write is enough for that specific call.)

## The one non-negotiable guardrail

**Nothing this pipeline opens ever gets merged automatically.** Every PR waits for an
explicit human merge, no exceptions, no "safe changes" carve-out. The risk being managed
here is *interpretation* risk (did the agent understand the ticket correctly), not
*change size* risk — a one-token change carries the same interpretation risk as a
five-token one, so there's no size threshold that would make auto-merge safe. This is
architecturally different from the plugin's own PR-based sync (Phase 3), where a human
already made the change in Figma and the PR is just formalizing something known-correct.

## Gotchas hit during real setup (keep for next time)

1. **JIRA's smart-value picker, not typed-by-hand variable names.** The Automation
   rule's web request body needs `{{issue.key}}`/`{{issue.summary}}` inserted via
   JIRA's own `{}` picker in the body field. Typing a placeholder string and forgetting
   to actually replace it produces a very confusing failure: GitHub receives the
   literal placeholder text as the issue key and returns `404 Issue does not exist`,
   which reads like a permissions problem, not a copy-paste one.
2. **"Allow GitHub Actions to create and approve pull requests" is off by default**,
   separately from the `permissions: pull-requests: write` already declared in the
   workflow file. Both gates have to be open — the workflow-level permission alone
   isn't enough. Symptom: `gh pr create` fails with
   `GraphQL: GitHub Actions is not permitted to create or approve pull requests`, after
   everything else (fetch, parse, resolve, validate, branch, push) already succeeded.
3. **A Connect-tab bug in the Figma plugin itself** (unrelated to this pipeline, but hit
   while debugging the above) — pasting a token, tabbing away, and clicking Connect
   could send an *empty* Authorization header, because an auto-validate-on-blur feature
   re-rendered the form from stale state before the token had been persisted. Fixed in
   the plugin repo (`Figma-Github Sync`, commit `b2e9a15`) — not this repo, but worth
   knowing about if a *plugin* connection (not this JIRA pipeline) throws
   `401 Bad credentials` after a token that curl-tests fine.

## Testing checklist

All three paths should be re-verified after any change to `ticket-agent.mjs` or
`ticket-agent-resolve.mjs`:

- **Happy path** — a valid structured ticket → moves to "Ready for Agent" → PR opens →
  merge it → ticket reaches "Live."
- **Clarification/bounce path** — a ticket with a deliberately wrong "Current value" (or
  a nonexistent token path) → no branch/PR created, a comment explains why, ticket
  returns to "In Design."
- **Close-without-merge path** — a valid ticket's PR gets closed instead of merged →
  ticket returns to "In Design" with a comment, ready to be re-queued.

## Not built yet (deliberately out of scope for this version)

- **Free-text ticket interpretation.** Right now a ticket must use the exact structured
  format above. Reading unstructured prose ("make the primary button a bit darker") and
  inferring the token/value would need an actual LLM call in the pipeline — a real
  capability addition, not a refactor, and the roadmap's own reasoning (§25) is that this
  is the highest-risk part of the whole feature, worth its own dedicated pass once the
  structured path has more real-world mileage on it.
- **Cascading edits** (changing a primitive that other tokens reference through). Only
  direct-value tokens are supported; reference tokens are explicitly rejected with a
  clarification comment rather than silently cascading a change to whatever they point at.
- **Auto-merge of any kind.** See the guardrail section above — not a gap, a deliberate
  permanent decision.
