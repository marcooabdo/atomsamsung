import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-public-safe',
      closeBundle() {
        const publicDir = 'public';
        const outDir = 'dist';
        try {
          const files = readdirSync(publicDir);
          files.forEach(file => {
            if (file.includes(' ')) return; // Skip files with spaces
            try {
              const src = join(publicDir, file);
              const dest = join(outDir, file);
              if (statSync(src).isFile()) {
                copyFileSync(src, dest);
              }
            } catch (err) {
              console.warn(`Skipped problematic file: ${file}`);
            }
          });
        } catch (err) {
          console.warn('Could not copy some public files');
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['xlsx'],
  },
  build: {
    copyPublicDir: false, // Disable default copy, use our custom plugin
  },
});
