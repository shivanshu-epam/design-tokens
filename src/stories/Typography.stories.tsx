import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type CSSProperties } from 'react';
import { SearchBox, TokenGroup, useFilteredTree } from '../components/TokenBrowser';
import { countLeaves, describeToken, tokens } from '../tokens';

function fontWeight(fontStyle: string): number {
  if (/bold/i.test(fontStyle)) return 700;
  if (/medium/i.test(fontStyle)) return 500;
  if (/light/i.test(fontStyle)) return 300;
  return 400;
}

function referenceChainText(chain: { key: string }[]): string {
  return chain.map((hop) => hop.key).join(' → ');
}

function TypeScale() {
  const [query, setQuery] = useState('');
  const tree = useFilteredTree(tokens.typography, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter typography (e.g. button, accent)…"
        resultCount={countLeaves(tree)}
        totalCount={Object.keys(tokens.typography).length}
      />
      <TokenGroup
        node={tree}
        forceOpen={hasQuery}
        renderLeaves={(entries) => (
          <>
            {entries.map(({ key, label, value }) => {
              const { resolved: v, isReference, chain, description, sourceType, error } = describeToken('typography', key, value);
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
                  <div style={{ width: 240, flexShrink: 0, fontSize: 12, color: '#888' }}>
                    <div style={{ fontWeight: 600, color: '#333' }}>
                      {label}
                      {isReference && (
                        <span style={{ marginLeft: 6, fontSize: 9, color: '#888', fontWeight: 400 }}>REF → {referenceChainText(chain)}</span>
                      )}
                      {sourceType && (
                        <span style={{ marginLeft: 6, fontSize: 9, color: '#6366f1', fontWeight: 400 }}>{sourceType.toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                      {v.fontSize}px / {lineHeight} · {v.fontStyle}
                    </div>
                    {description && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{description}</div>}
                  </div>
                  <div style={sampleStyle}>The quick brown fox jumps</div>
                </div>
              );
            })}
          </>
        )}
      />
    </div>
  );
}

const meta: Meta<typeof TypeScale> = {
  title: 'Design Tokens/Typography',
  component: TypeScale,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Every typography token synced from Figma Text styles, rendered as a live sample at its actual font family/size/weight/line-height.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof TypeScale>;
export const Scale: Story = {};
