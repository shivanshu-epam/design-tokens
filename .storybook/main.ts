import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(viteConfig) {
    // Our stories never statically `import React from 'react'` (new JSX
    // transform), so Vite's dependency scanner never discovers react/
    // react-dom need CJS->ESM pre-bundling, and the on-demand fallback path
    // breaks with "does not provide an export named 'default'". Forcing
    // them into the eager pre-bundle avoids that.
    viteConfig.optimizeDeps = {
      ...viteConfig.optimizeDeps,
      include: [
        ...(viteConfig.optimizeDeps?.include ?? []),
        'react',
        'react-dom',
        'react/jsx-dev-runtime',
        'react/jsx-runtime',
      ],
    };
    return viteConfig;
  },
};

export default config;
