import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchBox, TokenGroup, useFilteredTree } from '../components/TokenBrowser';
import { countLeaves, describeToken, tokens } from '../tokens';

function referenceChainText(chain: { key: string }[], resolved: string | null): string {
  const path = chain.map((hop) => hop.key).join(' → ');
  return resolved ? `${path} (${resolved})` : path;
}

// New in Phase 1 — Figma STRING variables (font family names, icon keys,
// etc.) weren't read at all before; see PROJECT.md / the roadmap doc.
function Strings() {
  const [query, setQuery] = useState('');
  const tree = useFilteredTree(tokens.string, query);
  const hasQuery = query.trim().length > 0;

  if (Object.keys(tokens.string).length === 0) {
    return <p style={{ fontFamily: 'system-ui, sans-serif', color: '#888', fontSize: 13 }}>No string tokens synced yet.</p>;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter string tokens…"
        resultCount={countLeaves(tree)}
        totalCount={Object.keys(tokens.string).length}
      />
      <TokenGroup
        node={tree}
        forceOpen={hasQuery}
        renderLeaves={(entries) => (
          <>
            {entries.map(({ key, label, value }) => {
              const { resolved, isReference, chain, description, sourceType, error } = describeToken('string', key, value);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ width: 260, flexShrink: 0, fontSize: 12, color: '#333' }}>
                    {label}
                    {isReference && <span style={{ marginLeft: 6, fontSize: 9, color: '#888' }}>REF</span>}
                    {sourceType && <span style={{ marginLeft: 6, fontSize: 9, color: '#6366f1' }}>{sourceType.toUpperCase()}</span>}
                    {description && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{description}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: error ? '#c00' : '#333' }}>
                    {error ? `⚠ ${error}` : isReference ? referenceChainText(chain, resolved) : resolved}
                  </div>
                </div>
              );
            })}
          </>
        )}
      />
    </div>
  );
}

const meta: Meta<typeof Strings> = {
  title: 'Design Tokens/Strings',
  component: Strings,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'STRING variables synced from Figma (font family names, icon keys, and similar text-shaped values).',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Strings>;
export const Values: Story = {};
