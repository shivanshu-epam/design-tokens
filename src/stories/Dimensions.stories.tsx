import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CollapsibleGroup, SearchBox, useFilteredGroups } from '../components/TokenBrowser';
import { tokens } from '../tokens';

function Dimensions() {
  const [query, setQuery] = useState('');
  const groups = useFilteredGroups(tokens.dimension, query);
  const resultCount = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Filter dimensions (e.g. border-radius, spacing)…"
        resultCount={resultCount}
        totalCount={Object.keys(tokens.dimension).length}
      />
      {Array.from(groups.entries()).map(([section, entries]) => (
        <CollapsibleGroup key={section} title={section} count={entries.length} forceOpen={hasQuery}>
          {entries.map(({ key, label, value }) => {
            const px = parseFloat(value.$value);
            const barWidth = Number.isFinite(px) ? Math.min(Math.max(px, 1), 200) : 0;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ width: 260, flexShrink: 0, fontSize: 12, color: '#333' }}>{label}</div>
                <div style={{ width: 210, flexShrink: 0 }}>
                  {barWidth > 0 && <div style={{ height: 8, width: barWidth, borderRadius: 2, background: '#6366f1' }} />}
                </div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'ui-monospace, monospace' }}>{value.$value}</div>
              </div>
            );
          })}
        </CollapsibleGroup>
      ))}
    </div>
  );
}

const meta: Meta<typeof Dimensions> = {
  title: 'Design Tokens/Dimensions',
  component: Dimensions,
};
export default meta;

type Story = StoryObj<typeof Dimensions>;
export const Scale: Story = {};
