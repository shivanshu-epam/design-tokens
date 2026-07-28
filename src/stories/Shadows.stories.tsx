import type { Meta, StoryObj } from '@storybook/react-vite';
import { groupBySection, shadowCss, tokens } from '../tokens';

function Shadows() {
  const groups = groupBySection(tokens.shadow);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {Array.from(groups.entries()).map(([section, entries]) => (
        <section key={section} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666' }}>{section}</h2>
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
        </section>
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
