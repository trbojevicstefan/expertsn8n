import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

function getHtmlInputs() {
  const inputs = { main: resolve(__dirname, 'index.html') };
  const partnersDir = resolve(__dirname, 'partners');
  if (existsSync(partnersDir)) {
    for (const file of readdirSync(partnersDir).filter(f => f.endsWith('.html'))) {
      inputs['partners/' + file.replace('.html', '')] = resolve(partnersDir, file);
    }
  }
  return inputs;
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: { input: getHtmlInputs() },
  },
});
