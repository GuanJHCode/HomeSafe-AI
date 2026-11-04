import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const fromConfig = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: {
    fs: {
      allow: [
        fromConfig('.'),
        fromConfig('../../browser-spike/BrowserRuleClient.mjs'),
        fromConfig('../../browser-spike/challenge-summary.mjs'),
      ],
    },
  },
});
