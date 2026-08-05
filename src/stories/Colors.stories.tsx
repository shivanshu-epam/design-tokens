import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchBox, TokenGroup, useFilteredTree } from '../components/TokenBrowser';
import { countLeaves, describeToken, tokens } from '../tokens';

function referenceChainText(chain: { category: string; key: string }[], resolved: string | null): string {
  const path = chain.map((hop) => hop.key).join(' → ');
  return resolved ? `${path} → ${resolved}` : path;
}

function ColorPalette() {
  const [query, setQuery] = useState('');
  const tree = useFilteredTree(tokens.color, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter colors (e.g. Loveship-Dark, accordion, yellow)…"
        resultCount={countLeaves(tree)}
        totalCount={Object.keys(tokens.color).length}
      />
      <TokenGroup
        node={tree}
        forceOpen={hasQuery}
        renderLeaves={(entries) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginBottom: 8 }}>
            {entries.map(({ key, label, value }) => {
              const { resolved, isReference, chain, description, sourceType, error } = describeToken('color', key, value);
              const accessibleName = error ? `${label}, error: ${error}` : `${label}, ${resolved ?? 'no value'}`;
              return (
                <div key={key}>
                  <div
                    role="img"
                    aria-label={accessibleName}
                    title={accessibleName}
                    style={{
                      height: 64,
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      background: resolved ?? '#fff',
                      backgroundImage: error
                        ? 'repeating-linear-gradient(45deg, #f88 0, #f88 6px, #fff 6px, #fff 12px)'
                        : undefined,
                    }}
                  />
                  <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                    {label}
                    {isReference && <span style={{ marginLeft: 6, fontSize: 9, color: '#888', fontWeight: 400 }}>REF</span>}
                    {sourceType && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: '#6366f1', fontWeight: 400 }}>{sourceType.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'ui-monospace, monospace' }}>
                    {error ? `⚠ ${error}` : isReference ? referenceChainText(chain, resolved) : resolved}
                  </div>
                  {description && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{description}</div>}
                </div>
              );
            })}
          </div>
        )}
      />
    </div>
  );
}

const meta: Meta<typeof ColorPalette> = {
  title: 'Design Tokens/Colors',
  component: ColorPalette,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Every color token synced from Figma (Paint styles + COLOR variables), grouped adaptively by name — a folder collapses into a flat grid once it has 40 or fewer entries, otherwise it splits into sub-groups. `REF` marks an alias token; the value line shows its full chain down to the concrete color it resolves to.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ColorPalette>;
export const Palette: Story = {};
