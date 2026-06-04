import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

function copyIcons() {
  return {
    name: 'copy-icons',
    buildStart() {
      const iconsDir = resolve(__dirname, 'icons');
      const distIconsDir = resolve(__dirname, 'dist', 'icons');
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true });
      }
      for (const file of ['icon16.png', 'icon48.png', 'icon128.png']) {
        copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file));
      }
    },
    writeBundle() {
      const iconsDir = resolve(__dirname, 'icons');
      const distIconsDir = resolve(__dirname, 'dist', 'icons');
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true });
      }
      for (const file of ['icon16.png', 'icon48.png', 'icon128.png']) {
        copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file));
      }
    },
  };
}

export default defineConfig({
  plugins: [
    webExtension({
      manifest: 'manifest.json',
    }),
    copyIcons(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
