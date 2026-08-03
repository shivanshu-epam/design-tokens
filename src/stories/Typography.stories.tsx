import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type CSSProperties } from 'react';
import { CollapsibleGroup, SearchBox, useFilteredGroups } from '../components/TokenBrowser';
import { describeToken, tokens } from '../tokens';

function fontWeight(fontStyle: string): number {
  if (/bold/i.test(fontStyle)) return 700;
  if (/medium/i.test(fontStyle)) return 500;
  if (/light/i.test(fontStyle)) return 300;
  return 400;
}

function TypeScale() {
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(tokens.typography, query);
  const resultCount = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter typography (e.g. button, accent)…"
        resultCount={resultCount}
        totalCount={Object.keys(tokens.typography).length}
      />
      {Array.from(groups.entries()).map(([section, entries]) => (
        <CollapsibleGroup key={section} title={section} count={entries.length} forceOpen={hasQuery}>
          {entries.map(({ key, label, value }) => {
            const { resolved: v, isReference, refKey, error } = describeToken('typography', key, value);
            if (!v) {
              return (
                <div key={key} style={{ padding: '10px 0', borderBottom: '1px solid #eee', fontSize: 11, color: '#c00' }}>
                  {label}: ⚠ {error}
                </div>
              );
            }
            const sampleStyle: CSSProperties = {
              fontFamily: v.fontFamily,
              fontSize: Math.min(v.fontSize, 40),
              fontWeight: fontWeight(v.fontStyle),
              fontStyle: /italic/i.test(v.fontStyle) ? 'italic' : 'normal',
            };
            const lineHeight =
              v.lineHeight.unit === 'AUTO' ? 'auto' : `${v.lineHeight.value}${v.lineHeight.unit === 'PERCENT' ? '%' : 'px'}`;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ width: 220, flexShrink: 0, fontSize: 12, color: '#888' }}>
                  <div style={{ fontWeight: 600, color: '#333' }}>
                    {label}
                    {isReference && <span style={{ marginLeft: 6, fontSize: 9, color: '#888', fontWeight: 400 }}>REF → {refKey}</span>}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    {v.fontSize}px / {lineHeight} · {v.fontStyle}
                  </div>
                </div>
                <div style={sampleStyle}>The quick brown fox jumps</div>
              </div>
            );
          })}
        </CollapsibleGroup>
      ))}
    </div>
  );
}

const meta: Meta<typeof TypeScale> = {
  title: 'Design Tokens/Typography',
  component: TypeScale,
};
export default meta;

type Story = StoryObj<typeof TypeScale>;
export const Scale: Story = {};
