// Typed access to design-tokens.json (kept at the repo root — this is the
// same file the Design Sync Figma plugin reads from and commits to), plus
// small helpers shared by the token story pages.
//
// Phase 1 schema: `$value` wraps either a concrete value or a *reference*
// to another token (`{ kind: 'reference', refKey: '<category>/<key>' }`)
// instead of every alias being flattened away at sync time. Mirrors
// shared/tokens.ts in the plugin repo — reimplemented here since this repo
// has no shared module with the plugin (see PROJECT.md, §3: the two repos
// only ever talk through this JSON file).
import raw from '../design-tokens.json';

export type TokenCategory = 'color' | 'typography' | 'shadow' | 'dimension' | 'string' | 'boolean';

export type TokenValue<T> = { kind: 'value'; value: T } | { kind: 'reference'; refKey: string };

export interface DesignToken<T> {
  $type: TokenCategory;
  $value: TokenValue<T>;
  $description?: string;
  $extensions?: {
    'design-sync.figmaSourceType'?: 'style' | 'variable';
    'design-sync.variableId'?: string;
  };
}

export interface TypographyValue {
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing: { value: number; unit: 'PIXELS' | 'PERCENT' };
}

export interface ShadowLayer {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

export type ColorToken = DesignToken<string>;
export type TypographyToken = DesignToken<TypographyValue>;
export type ShadowToken = DesignToken<ShadowLayer[]>;
export type DimensionToken = DesignToken<string>;
export type StringToken = DesignToken<string>;
export type BooleanToken = DesignToken<boolean>;

export interface TokenSet {
  color: Record<string, ColorToken>;
  typography: Record<string, TypographyToken>;
  shadow: Record<string, ShadowToken>;
  dimension: Record<string, DimensionToken>;
  string: Record<string, StringToken>;
  boolean: Record<string, BooleanToken>;
}

const parsed = raw as unknown as Partial<TokenSet>;
export const tokens: TokenSet = {
  color: parsed.color ?? {},
  typography: parsed.typography ?? {},
  shadow: parsed.shadow ?? {},
  dimension: parsed.dimension ?? {},
  string: parsed.string ?? {},
  boolean: parsed.boolean ?? {},
};

export function parseRefKey(refKey: string): { category: TokenCategory; key: string } {
  const idx = refKey.indexOf('/');
  if (idx === -1) throw new Error(`Malformed token reference: ${refKey}`);
  return { category: refKey.slice(0, idx) as TokenCategory, key: refKey.slice(idx + 1) };
}

export function resolveToken<T>(
  key: string,
  category: TokenCategory,
  set: TokenSet = tokens,
  visited: Set<string> = new Set(),
): T {
  const visitKey = `${category}/${key}`;
  if (visited.has(visitKey)) throw new Error(`Circular token reference at ${visitKey}`);
  visited.add(visitKey);
  const bucket = set[category] as Record<string, DesignToken<T>>;
  const token = bucket[key];
  if (!token) throw new Error(`Token not found: ${visitKey}`);
  if (token.$value.kind === 'value') return token.$value.value;
  const ref = parseRefKey(token.$value.refKey);
  return resolveToken<T>(ref.key, ref.category, set, visited);
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
