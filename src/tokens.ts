// Typed access to design-tokens.json (kept at the repo root — this is the
// same file the Design Sync Figma plugin reads from and commits to), plus
// small helpers used by the token story pages.
//
// The token schema and reference-resolution logic (TokenSet, DesignToken,
// resolveToken, ...) used to be reimplemented here, hand-duplicated from
// the plugin's shared/tokens.ts. It now lives in one place — the
// `design-sync-schema` package, imported by both repos — so a fix to
// resolution/validation logic only has to happen once.
import raw from '../design-tokens.json';
import {
  parseRefKey,
  resolveToken as resolveTokenInSet,
  type DesignToken,
  type ShadowLayer,
  type TokenCategory,
  type TokenSet,
} from 'design-sync-schema';

export type { TokenCategory, TokenSet, DesignToken, ShadowLayer } from 'design-sync-schema';

const parsed = raw as unknown as Partial<TokenSet>;
export const tokens: TokenSet = {
  color: parsed.color ?? {},
  typography: parsed.typography ?? {},
  shadow: parsed.shadow ?? {},
  dimension: parsed.dimension ?? {},
  string: parsed.string ?? {},
  boolean: parsed.boolean ?? {},
};

// Convenience wrapper: every call site in this repo resolves against the
// one `tokens` singleton loaded above, so the shared `resolveToken` (which
// takes an explicit set, since the plugin resolves against Figma- or
// GitHub-side data that isn't a fixed singleton) doesn't need that param
// repeated everywhere here.
export function resolveToken<T>(key: string, category: TokenCategory, set: TokenSet = tokens): T {
  return resolveTokenInSet<T>(key, category, set);
}

export interface ReferenceHop {
  category: TokenCategory;
  key: string;
}

// Walks the FULL alias chain (not just the immediate hop) by following
// $value.refKey until a concrete value is hit, mirroring resolveToken's own
// cycle-detection so a broken/circular chain reports the same error a
// resolve attempt would, rather than looping forever. `chain` always
// includes the starting token itself, so `chain.length === 1` means "not a
// reference" — callers that only care about the single-hop case (most of
// them) don't need special-casing.
export function describeReferenceChain<T>(category: TokenCategory, key: string, set: TokenSet = tokens): { chain: ReferenceHop[]; resolved: T | null; error?: string } {
  const chain: ReferenceHop[] = [{ category, key }];
  const visited = new Set<string>([`${category}/${key}`]);
  let curCategory = category;
  let curKey = key;
  try {
    for (;;) {
      const bucket = set[curCategory] as Record<string, DesignToken<T>> | undefined;
      const token = bucket?.[curKey];
      if (!token) throw new Error(`Token not found: ${curCategory}/${curKey}`);
      if (token.$value.kind !== 'reference') {
        return { chain, resolved: resolveToken<T>(key, category, set) };
      }
      const next = parseRefKey(token.$value.refKey);
      const visitKey = `${next.category}/${next.key}`;
      if (visited.has(visitKey)) throw new Error(`Circular reference detected at ${visitKey}`);
      visited.add(visitKey);
      chain.push(next);
      curCategory = next.category;
      curKey = next.key;
    }
  } catch (err) {
    return { chain, resolved: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// What every story page actually needs to render one row: the resolved
// value (following the full reference chain), whether it started as a
// reference, the chain itself (for multi-hop display), and whatever
// metadata ($description, Figma source type) the token itself carries —
// this used to be read off the raw token and then discarded before
// reaching any story page.
export interface ResolvedToken<T> {
  resolved: T | null;
  isReference: boolean;
  refKey?: string; // the IMMEDIATE hop's refKey, for callers that only show one hop
  chain: ReferenceHop[];
  description?: string;
  sourceType?: 'style' | 'variable';
  error?: string;
}

export function describeToken<T>(category: TokenCategory, key: string, token: DesignToken<T>): ResolvedToken<T> {
  const isReference = token.$value.kind === 'reference';
  const { chain, resolved, error } = describeReferenceChain<T>(category, key);
  return {
    resolved,
    isReference,
    refKey: isReference ? (token.$value as { refKey: string }).refKey : undefined,
    chain,
    description: token.$description,
    sourceType: token.$extensions?.['design-sync.figmaSourceType'],
    error,
  };
}

export interface GroupedEntry<T> {
  key: string;
  label: string;
  value: T;
}

// Figma style/variable names are slash-delimited paths (e.g.
// "additional palette/cobalt/cobalt-50", or for multi-mode variables
// "Theme/Loveship-Dark/components/accordion/colors/accordion-bg-color").
//
// A previous version of this file grouped by a FIXED first-two-segments
// cutoff. Against this project's real data (5 Theme/* brand+mode variants,
// each with ~1,084 colors under it) that produced unbrowsable
// thousand-entry flat sections, while simultaneously fragmenting short
// keys like "Deprecation/Yes/Deprecation" into their own 1-entry sections.
// A real folder tree, flattened adaptively by size, fixes both: build the
// full tree once (this function), then let the UI decide per-node whether
// there's little enough under it to show flat, or whether to recurse one
// level deeper — see `TokenGroup` in components/TokenBrowser.tsx.
export interface TokenTreeNode<T> {
  name: string; // this node's own path segment ('' for the tree root)
  path: string; // full path to this node, '/'-joined
  children: Map<string, TokenTreeNode<T>>;
  leaves: GroupedEntry<T>[]; // tokens whose full key terminates exactly here
}

export function buildTokenTree<T>(record: Record<string, T>): TokenTreeNode<T> {
  const root: TokenTreeNode<T> = { name: '', path: '', children: new Map(), leaves: [] };
  for (const key of Object.keys(record).sort()) {
    const segments = key.split('/');
    let node = root;
    let path = '';
    // Every segment except the last is a "folder"; the last segment is the
    // leaf's own label, attached to the deepest folder node rather than
    // becoming a folder of its own.
    for (let i = 0; i < segments.length - 1; i++) {
      path = path ? `${path}/${segments[i]}` : segments[i];
      let child = node.children.get(segments[i]);
      if (!child) {
        child = { name: segments[i], path, children: new Map(), leaves: [] };
        node.children.set(segments[i], child);
      }
      node = child;
    }
    node.leaves.push({ key, label: segments[segments.length - 1], value: record[key] });
  }
  return root;
}

export function countLeaves<T>(node: TokenTreeNode<T>): number {
  let total = node.leaves.length;
  for (const child of node.children.values()) total += countLeaves(child);
  return total;
}

// Flattens every leaf under `node` (including nested folders) into one
// list, for display when a subtree is small enough to show without further
// disclosure. Labels a leaf by its path RELATIVE to `node` (the folder
// names actually being collapsed away), not just its own final segment —
// without this, "Deprecation/Yes/Deprecation" and "Deprecation/No/Deprecation"
// would both flatten to the identical label "Deprecation" and become
// indistinguishable once merged into one list.
export function collectLeaves<T>(node: TokenTreeNode<T>, prefix: string[] = []): GroupedEntry<T>[] {
  const here: GroupedEntry<T>[] = node.leaves.map((leaf) => ({
    ...leaf,
    label: prefix.length > 0 ? [...prefix, leaf.label].join(' / ') : leaf.label,
  }));
  const nested: GroupedEntry<T>[] = [];
  for (const [name, child] of node.children) nested.push(...collectLeaves(child, [...prefix, name]));
  return [...here, ...nested];
}

export function filterByQuery<T>(record: Record<string, T>, query: string): Record<string, T> {
  const q = query.trim().toLowerCase();
  if (!q) return record;
  return Object.fromEntries(Object.entries(record).filter(([key]) => key.toLowerCase().includes(q)));
}

export function shadowCss(layers: ShadowLayer[]): string {
  return layers
    .map(
      (l) =>
        `${l.type === 'INNER_SHADOW' ? 'inset ' : ''}${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.spread}px ${l.color}`,
    )
    .join(', ');
}
