import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  base: './',
  build: { target: 'es2022' },
  plugins: [
    {
      name: 'desktop-csp',
      transformIndexHtml(html) {
        return mode === 'desktop'
          ? html.replace("connect-src 'none'", 'connect-src ipc: http://ipc.localhost')
          : html;
      },
    },
  ],
}));
