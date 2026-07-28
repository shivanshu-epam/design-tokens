import type { Meta, StoryObj } from '@storybook/react-vite';
import { groupBySection, tokens } from '../tokens';

function ColorPalette() {
  const groups = groupBySection(tokens.color);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {Array.from(groups.entries()).map(([section, entries]) => (
        <section key={section} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666' }}>{section}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {entries.map(({ key, label, value }) => (
              <div key={key}>
                <div style={{ height: 64, borderRadius: 6, border: '1px solid #ddd', background: value.$value }} />
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'ui-monospace, monospace' }}>{value.$value}</div>
              </div>
            ))}
          </div>
        </section>
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
