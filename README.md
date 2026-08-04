# design-tokens

Design tokens synced from Figma, documented in Storybook.

```
Figma (Design Sync plugin)  ─┐
                              ├──►  design-tokens.json  ──►  Storybook
GitHub (manual edits)       ─┘
```

`design-tokens.json` at the repo root is the single source of truth. It's
kept in sync with Figma by the **Design Sync** Figma plugin (Connect →
Sync tab), and documented here in Storybook. You can also edit it directly
on GitHub — the plugin picks up those changes on its next compare.

## Token file format

```json
{
  "color":      { "Theme/Loveship-Dark/.../accordion-bg-color": { "$type": "color", "$value": "#141c29" } },
  "typography": { "_components/button/button-m-(30)": { "$type": "typography", "$value": { "fontFamily": "...", "fontSize": 14, ... } } },
  "shadow":     { "shadows/shadow-level-1": { "$type": "shadow", "$value": [ { "type": "DROP_SHADOW", ... } ] } },
  "dimension":  { "Theme/Loveship-Dark/.../border-radius-3": { "$type": "dimension", "$value": "3px" } }
}
```

Keys are slash-delimited paths mirroring Figma's own naming — either a
style name directly, or for Figma **Variables**, `CollectionName/ModeName/VariableName`
(mode name omitted for single-mode collections). Whatever naming/folder
convention is used in Figma is what shows up here.

## Storybook

```bash
npm install
npm run storybook          # dev server at localhost:6006
npm run build-storybook    # static build -> storybook-static/
```

Four pages under **Design Tokens**: Colors, Typography, Shadows,
Dimensions. Each has a search box (filters by key substring — the fastest
way to find one token in a set this size) and collapsible groups (large
groups, like each variable mode, start collapsed so the page doesn't try
to render thousands of entries at once).

`npm run build-storybook` also runs a **postbuild** step
(`scripts/record-sync-marker.mjs`) that stamps `.storybook-sync.json` with
the git blob SHA of `design-tokens.json` at build time. That's how the
Figma plugin's Status tab knows whether the last Storybook build actually
reflects what's currently on GitHub, without needing a live Storybook
deployment to check against.

This is automated: `.github/workflows/deploy-storybook.yml` runs on every
push to `main`, rebuilds Storybook, deploys it to GitHub Pages, and commits
the refreshed `.storybook-sync.json` back to the repo — no manual build/push
step needed after a token change. (One-time setup: repo Settings → Pages →
Source must be set to "GitHub Actions" for the deploy to publish.)

## Scale

At the time of writing this file has ~11,600 entries (~1.6MB) — EPAM UUI's
full theme system (5 modes × ~1,084 variables) plus typography and
shadows. A few things that follow from that:

- `design-tokens.json` is over GitHub's 1MB inline-content limit for the
  Contents API's default response — anything reading it via that API
  needs the `.raw` media type (`Accept: application/vnd.github.raw+json`)
  to get the actual bytes, not just metadata.
- `src/tokens.ts` deliberately does *not* let TypeScript infer a literal
  type for the JSON import (`src/json.d.ts` types it as `unknown` instead)
  — inferring a literal type over 10k+ keys is slow for no benefit, since
  it gets cast to `TokenSet` immediately anyway.

## Repo layout

```
design-tokens.json         the tokens (source of truth)
.storybook-sync.json        build marker (see above) — generated, but committed
.storybook/                 Storybook config
src/tokens.ts                typed access + grouping/filtering helpers
src/components/TokenBrowser.tsx   shared search + collapsible-group UI
src/stories/                 one story file per token category
scripts/record-sync-marker.mjs    postbuild-storybook hook
```
