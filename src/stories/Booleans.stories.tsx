import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CollapsibleGroup, SearchBox, useFilteredGroups } from '../components/TokenBrowser';
import { describeToken, tokens } from '../tokens';

// New in Phase 1 — Figma BOOLEAN variables (feature-flag-shaped values like
// `isDarkModeDefault`) weren't read at all before; see PROJECT.md / the
// roadmap doc.
function Booleans() {
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(tokens.boolean, query);
  const resultCount = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);
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
        resultCount={resultCount}
        totalCount={Object.keys(tokens.boolean).length}
      />
      {Array.from(groups.entries()).map(([section, entries]) => (
        <CollapsibleGroup key={section} title={section} count={entries.length} forceOpen={hasQuery}>
          {entries.map(({ key, label, value }) => {
            const { resolved, isReference, refKey, error } = describeToken('boolean', key, value);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ width: 260, flexShrink: 0, fontSize: 12, color: '#333' }}>
                  {label}
                  {isReference && <span style={{ marginLeft: 6, fontSize: 9, color: '#888' }}>REF</span>}
                </div>
                {error ? (
                  <div style={{ fontSize: 12, color: '#c00' }}>⚠ {error}</div>
                ) : (
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
                    {resolved ? 'true' : 'false'}
                    {isReference ? ` (→ ${refKey})` : ''}
                  </span>
                )}
              </div>
            );
          })}
        </CollapsibleGroup>
      ))}
    </div>
  );
}

const meta: Meta<typeof Booleans> = {
  title: 'Design Tokens/Booleans',
  component: Booleans,
};
export default meta;

type Story = StoryObj<typeof Booleans>;
export const Values: Story = {};
