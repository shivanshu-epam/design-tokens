import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CollapsibleGroup, SearchBox, useFilteredGroups } from '../components/TokenBrowser';
import { shadowCss, tokens } from '../tokens';

function Shadows() {
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(tokens.shadow, query);
  const resultCount = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter shadows…"
        resultCount={resultCount}
        totalCount={Object.keys(tokens.shadow).length}
      />
      {Array.from(groups.entries()).map(([section, entries]) => (
        <CollapsibleGroup key={section} title={section} count={entries.length} forceOpen={hasQuery}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 32, paddingTop: 8 }}>
            {entries.map(({ key, label, value }) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    height: 72,
                    width: '90%',
                    margin: '0 auto',
                    borderRadius: 8,
                    background: '#fff',
                    boxShadow: shadowCss(value.$value),
                  }}
                />
                <div style={{ fontSize: 12, marginTop: 12, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </CollapsibleGroup>
      ))}
    </div>
  );
}

const meta: Meta<typeof Shadows> = {
  title: 'Design Tokens/Shadows',
  component: Shadows,
};
export default meta;

type Story = StoryObj<typeof Shadows>;
export const Elevation: Story = {};
