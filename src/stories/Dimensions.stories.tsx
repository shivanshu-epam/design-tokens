import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchBox, TokenGroup, useFilteredTree } from '../components/TokenBrowser';
import { countLeaves, describeToken, tokens } from '../tokens';

function referenceChainText(chain: { key: string }[], resolved: string | null): string {
  const path = chain.map((hop) => hop.key).join(' → ');
  return resolved ? `${path} (${resolved})` : path;
}

function Dimensions() {
  const [query, setQuery] = useState('');
  const tree = useFilteredTree(tokens.dimension, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter dimensions (e.g. border-radius, spacing)…"
        resultCount={countLeaves(tree)}
        totalCount={Object.keys(tokens.dimension).length}
      />
      <TokenGroup
        node={tree}
        forceOpen={hasQuery}
        renderLeaves={(entries) => (
          <>
            {entries.map(({ key, label, value }) => {
              const { resolved, isReference, chain, description, sourceType, error } = describeToken('dimension', key, value);
              const px = resolved ? parseFloat(resolved) : NaN;
              const barWidth = Number.isFinite(px) ? Math.min(Math.max(px, 1), 200) : 0;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ width: 260, flexShrink: 0, fontSize: 12, color: '#333' }}>
                    {label}
                    {isReference && <span style={{ marginLeft: 6, fontSize: 9, color: '#888' }}>REF</span>}
                    {sourceType && <span style={{ marginLeft: 6, fontSize: 9, color: '#6366f1' }}>{sourceType.toUpperCase()}</span>}
                    {description && <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{description}</div>}
                  </div>
                  <div style={{ width: 210, flexShrink: 0 }}>
                    {barWidth > 0 && (
                      <div role="img" aria-label={`${label}, ${resolved}`} style={{ height: 8, width: barWidth, borderRadius: 2, background: '#6366f1' }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: error ? '#c00' : '#888', fontFamily: 'ui-monospace, monospace' }}>
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

const meta: Meta<typeof Dimensions> = {
  title: 'Design Tokens/Dimensions',
  component: Dimensions,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Custom dimension tokens (spacing, radii, etc.) — hand-entered in the plugin\'s Custom Tokens tab, plus FLOAT variables synced from Figma. The bar length is a rough visual size cue, not to scale.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof Dimensions>;
export const Scale: Story = {};
