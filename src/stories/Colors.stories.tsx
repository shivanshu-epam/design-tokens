import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CollapsibleGroup, SearchBox, useFilteredGroups } from '../components/TokenBrowser';
import { tokens } from '../tokens';

function ColorPalette() {
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(tokens.color, query);
  const resultCount = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter colors (e.g. Loveship-Dark, accordion, yellow)…"
        resultCount={resultCount}
        totalCount={Object.keys(tokens.color).length}
      />
      {Array.from(groups.entries()).map(([section, entries]) => (
        <CollapsibleGroup key={section} title={section} count={entries.length} forceOpen={hasQuery}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {entries.map(({ key, label, value }) => (
              <div key={key}>
                <div style={{ height: 64, borderRadius: 6, border: '1px solid #ddd', background: value.$value }} />
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'ui-monospace, monospace' }}>{value.$value}</div>
              </div>
            ))}
          </div>
        </CollapsibleGroup>
      ))}
    </div>
  );
}

const meta: Meta<typeof ColorPalette> = {
  title: 'Design Tokens/Colors',
  component: ColorPalette,
};
export default meta;

type Story = StoryObj<typeof ColorPalette>;
export const Palette: Story = {};
