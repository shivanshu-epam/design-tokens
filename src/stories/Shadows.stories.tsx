import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchBox, TokenGroup, useFilteredTree } from '../components/TokenBrowser';
import { countLeaves, describeToken, shadowCss, tokens } from '../tokens';

function referenceChainText(chain: { key: string }[]): string {
  return chain.map((hop) => hop.key).join(' → ');
}

function Shadows() {
  const [query, setQuery] = useState('');
  const tree = useFilteredTree(tokens.shadow, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter shadows…"
        resultCount={countLeaves(tree)}
        totalCount={Object.keys(tokens.shadow).length}
      />
      <TokenGroup
        node={tree}
        forceOpen={hasQuery}
        renderLeaves={(entries) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 32, paddingTop: 8, paddingBottom: 8 }}>
            {entries.map(({ key, label, value }) => {
              const { resolved, isReference, chain, description, sourceType, error } = describeToken('shadow', key, value);
              const accessibleName = error ? `${label}, error: ${error}` : `${label} shadow`;
              return (
                <div key={key} style={{ textAlign: 'center' }}>
                  <div
                    role="img"
                    aria-label={accessibleName}
                    title={accessibleName}
                    style={{
                      height: 72,
                      width: '90%',
                      margin: '0 auto',
                      borderRadius: 8,
                      background: '#fff',
                      boxShadow: resolved ? shadowCss(resolved) : undefined,
                      border: error ? '1px dashed #f88' : undefined,
                    }}
                  />
                  <div style={{ fontSize: 12, marginTop: 12, fontWeight: 600 }}>
                    {label}
                    {isReference && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: '#888', fontWeight: 400 }}>REF → {referenceChainText(chain)}</span>
                    )}
                    {sourceType && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: '#6366f1', fontWeight: 400 }}>{sourceType.toUpperCase()}</span>
                    )}
                  </div>
                  {description && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{description}</div>}
                  {error && <div style={{ fontSize: 10, color: '#c00' }}>⚠ {error}</div>}
                </div>
              );
            })}
          </div>
        )}
      />
    </div>
  );
}

const meta: Meta<typeof Shadows> = {
  title: 'Design Tokens/Shadows',
  component: Shadows,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Every shadow token synced from Figma Effect styles (drop/inner shadow layers), rendered as a live box-shadow sample.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Shadows>;
export const Elevation: Story = {};
