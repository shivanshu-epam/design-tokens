// Typed access to design-tokens.json (kept at the repo root — this is the
// same file the Design Sync Figma plugin reads from and commits to), plus
// small helpers shared by the token story pages.
import raw from '../design-tokens.json';

export interface ColorToken {
  $type: 'color';
  $value: string;
}

export interface TypographyToken {
  $type: 'typography';
  $value: {
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeight: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
    letterSpacing: { value: number; unit: 'PIXELS' | 'PERCENT' };
  };
}

export interface ShadowLayer {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

export interface ShadowToken {
  $type: 'shadow';
  $value: ShadowLayer[];
}

export interface DimensionToken {
  $type: 'dimension';
  $value: string;
}

export interface TokenSet {
  color: Record<string, ColorToken>;
  typography: Record<string, TypographyToken>;
  shadow: Record<string, ShadowToken>;
  dimension: Record<string, DimensionToken>;
}

export const tokens = raw as unknown as TokenSet;

export interface GroupedEntry<T> {
  key: string;
  label: string;
  value: T;
}

// Figma style names are slash-delimited paths (e.g.
// "additional palette/cobalt/cobalt-50"). Group by the first segment so the
// story pages read the same way the styles are organized in Figma.
export function groupBySection<T>(record: Record<string, T>): Map<string, GroupedEntry<T>[]> {
  const groups = new Map<string, GroupedEntry<T>[]>();
  for (const key of Object.keys(record).sort()) {
    const [section, ...rest] = key.split('/');
    const label = rest.length > 0 ? rest.join(' / ') : section;
    const list = groups.get(section) ?? [];
    list.push({ key, label, value: record[key] });
    groups.set(section, list);
  }
  return groups;
}

export function shadowCss(layers: ShadowLayer[]): string {
  return layers
    .map(
      (l) =>
        `${l.type === 'INNER_SHADOW' ? 'inset ' : ''}${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.spread}px ${l.color}`,
    )
    .join(', ');
}
