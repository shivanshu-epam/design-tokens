import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CollapsibleGroup, SearchBox, useFilteredGroups } from '../components/TokenBrowser';
import { describeToken, tokens } from '../tokens';

// New in Phase 1 — Figma STRING variables (font family names, icon keys,
// etc.) weren't read at all before; see PROJECT.md / the roadmap doc.
function Strings() {
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(tokens.string, query);
  const resultCount = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);
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
        resultCount={resultCount}
        totalCount={Object.keys(tokens.string).length}
      />
      {Array.from(groups.entries()).map(([section, entries]) => (
        <CollapsibleGroup key={section} title={section} count={entries.length} forceOpen={hasQuery}>
          {entries.map(({ key, label, value }) => {
            const { resolved, isReference, refKey, error } = describeToken('string', key, value);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ width: 260, flexShrink: 0, fontSize: 12, color: '#333' }}>
                  {label}
                  {isReference && <span style={{ marginLeft: 6, fontSize: 9, color: '#888' }}>REF</span>}
                </div>
                <div style={{ fontSize: 12, color: error ? '#c00' : '#333' }}>
                  {error ? `⚠ ${error}` : isReference ? `→ ${refKey} (${resolved})` : resolved}
                </div>
              </div>
            );
          })}
        </CollapsibleGroup>
      ))}
    </div>
  );
}

const meta: Meta<typeof Strings> = {
  title: 'Design Tokens/Strings',
  component: Strings,
};
export default meta;

type Story = StoryObj<typeof Strings>;
export const Values: Story = {};
