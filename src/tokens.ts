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
import { resolveToken as resolveTokenInSet, type DesignToken, type ShadowLayer, type TokenCategory, type TokenSet } from 'design-sync-schema';

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

// What every story page actually needs to render one row: the resolved
// value (following any reference chain), whether it started as a
// reference, and the refKey to show alongside it if so.
export interface ResolvedToken<T> {
  resolved: T | null;
  isReference: boolean;
  refKey?: string;
  error?: string;
}

export function describeToken<T>(category: TokenCategory, key: string, token: DesignToken<T>): ResolvedToken<T> {
  const isReference = token.$value.kind === 'reference';
  try {
    const resolved = resolveToken<T>(key, category);
    return { resolved, isReference, refKey: isReference ? (token.$value as { refKey: string }).refKey : undefined };
  } catch (err) {
    return { resolved: null, isReference, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface GroupedEntry<T> {
  key: string;
  label: string;
  value: T;
}

// Figma style/variable names are slash-delimited paths (e.g.
// "additional palette/cobalt/cobalt-50", or for multi-mode variables
// "Theme/Loveship-Dark/components/accordion/colors/accordion-bg-color").
// Group by the first two segments when there are more than two — for
// variable collections that's collection+mode, which keeps each group to a
// browsable size instead of one multi-thousand-entry blob per collection.
export function groupBySection<T>(record: Record<string, T>): Map<string, GroupedEntry<T>[]> {
  const groups = new Map<string, GroupedEntry<T>[]>();
  for (const key of Object.keys(record).sort()) {
    const segments = key.split('/');
    const depth = segments.length > 2 ? 2 : 1;
    const section = segments.slice(0, depth).join('/');
    const rest = segments.slice(depth);
    const label = rest.length > 0 ? rest.join(' / ') : section;
    const list = groups.get(section) ?? [];
    list.push({ key, label, value: record[key] });
    groups.set(section, list);
  }
  return groups;
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
