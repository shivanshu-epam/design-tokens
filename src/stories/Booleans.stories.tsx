import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchBox, TokenGroup, useFilteredTree } from '../components/TokenBrowser';
import { countLeaves, describeToken, tokens } from '../tokens';

function referenceChainText(chain: { key: string }[]): string {
  return chain.map((hop) => hop.key).join(' → ');
}

// New in Phase 1 — Figma BOOLEAN variables (feature-flag-shaped values like
// `isDarkModeDefault`) weren't read at all before; see PROJECT.md / the
// roadmap doc.
function Booleans() {
  const [query, setQuery] = useState('');
  const tree = useFilteredTree(tokens.boolean, query);
  const hasQuery = query.trim().length > 0;

  if (Object.keys(tokens.boolean).length === 0) {
    return <p style={{ fontFamily: 'system-ui, sans-serif', color: '#888', fontSize: 13 }}>No boolean tokens synced yet.</p>;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter boolean tokens…"
        resultCount={countLeaves(tree)}
        totalCount={Object.keys(tokens.boolean).length}
      />
      <TokenGroup
        node={tree}
        forceOpen={hasQuery}
        renderLeaves={(entries) => (
          <>
            {entries.map(({ key, label, value }) => {
              const { resolved, isReference, chain, description, sourceType, error } = describeToken('boolean', key, value);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ width: 260, flexShrink: 0, fontSize: 12, color: '#333' }}>
                    {label}
                    {isReference && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: '#888' }}>REF → {referenceChainText(chain)}</span>
                    )}
                    {sourceType && <span style={{ marginLeft: 6, fontSize: 9, color: '#6366f1' }}>{sourceType.toUpperCase()}</span>}
                    {description && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{description}</div>}
                  </div>
                  {error ? (
                    <div style={{ fontSize: 12, color: '#c00' }}>⚠ {error}</div>
                  ) : (
                    // Color is never the only signal — a ✓/✕ glyph carries the
                    // state too, matching how the plugin's own statusBanner
                    // always pairs an icon with color for the same reason.
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: resolved ? '#dcfce7' : '#f3f4f6',
                        color: resolved ? '#166534' : '#4b5563',
                      }}
                    >
                      {resolved ? '✓ true' : '✕ false'}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      />
    </div>
  );
}

const meta: Meta<typeof Booleans> = {
  title: 'Design Tokens/Booleans',
  component: Booleans,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'BOOLEAN variables synced from Figma (feature-flag-shaped values, e.g. isDarkModeDefault).',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Booleans>;
export const Values: Story = {};
