import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { groupBySection, tokens } from '../tokens';

function fontWeight(fontStyle: string): number {
  if (/bold/i.test(fontStyle)) return 700;
  if (/medium/i.test(fontStyle)) return 500;
  if (/light/i.test(fontStyle)) return 300;
  return 400;
}

function TypeScale() {
  const groups = groupBySection(tokens.typography);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {Array.from(groups.entries()).map(([section, entries]) => (
        <section key={section} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666' }}>{section}</h2>
          {entries.map(({ key, label, value }) => {
            const v = value.$value;
            const sampleStyle: CSSProperties = {
              fontFamily: v.fontFamily,
              fontSize: Math.min(v.fontSize, 40),
              fontWeight: fontWeight(v.fontStyle),
              fontStyle: /italic/i.test(v.fontStyle) ? 'italic' : 'normal',
            };
            const lineHeight =
              v.lineHeight.unit === 'AUTO' ? 'auto' : `${v.lineHeight.value}${v.lineHeight.unit === 'PERCENT' ? '%' : 'px'}`;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ width: 220, flexShrink: 0, fontSize: 12, color: '#888' }}>
                  <div style={{ fontWeight: 600, color: '#333' }}>{label}</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    {v.fontSize}px / {lineHeight} · {v.fontStyle}
                  </div>
                </div>
                <div style={sampleStyle}>The quick brown fox jumps</div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

const meta: Meta<typeof TypeScale> = {
  title: 'Design Tokens/Typography',
  component: TypeScale,
};
export default meta;

type Story = StoryObj<typeof TypeScale>;
export const Scale: Story = {};
