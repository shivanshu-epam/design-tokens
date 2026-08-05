import type { Preview } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';

// The token set's Theme/* colors are 5 concrete brand+mode combinations
// (not an abstract light/dark pair) — the toolbar control below switches
// which one the preview canvas's background matches, via a class on <body>
// that preview-head.html's CSS keys off of. Swatches themselves don't
// change (a color token IS its own value regardless of context), but a
// token meant to sit on a dark surface is at least being viewed against a
// plausible background instead of a fixed white canvas.
const preview: Preview = {
  parameters: {
    layout: 'padded',
  },
  decorators: [
    withThemeByClassName({
      themes: {
        'Loveship Light': 'theme-loveship-light',
        'Loveship Dark': 'theme-loveship-dark',
        Promo: 'theme-promo',
        'Electric Light': 'theme-electric-light',
        'Electric Dark': 'theme-electric-dark',
      },
      defaultTheme: 'Loveship Light',
      parentSelector: 'body',
    }),
  ],
};

export default preview;
