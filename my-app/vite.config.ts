import { defineConfig } from 'vite';

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        parts: resolve(__dirname, 'src/parts.html'),
        loggys: resolve(__dirname, 'src/loggys.html'),
        messageBoard: resolve(__dirname, 'src/messageBoard.html'),
        settings: resolve(__dirname, 'src/Settings.html'),
      },
    },
  },
});

