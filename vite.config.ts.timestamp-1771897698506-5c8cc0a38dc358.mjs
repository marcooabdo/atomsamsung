// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import { copyFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "copy-public-safe",
      closeBundle() {
        const publicDir = "public";
        const outDir = "dist";
        try {
          const files = readdirSync(publicDir);
          files.forEach((file) => {
            if (file.includes(" ")) return;
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
          console.warn("Could not copy some public files");
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ["lucide-react"],
    include: ["xlsx"]
  },
  build: {
    copyPublicDir: false
    // Disable default copy, use our custom plugin
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjb3B5RmlsZVN5bmMsIHJlYWRkaXJTeW5jLCBzdGF0U3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHtcbiAgICAgIG5hbWU6ICdjb3B5LXB1YmxpYy1zYWZlJyxcbiAgICAgIGNsb3NlQnVuZGxlKCkge1xuICAgICAgICBjb25zdCBwdWJsaWNEaXIgPSAncHVibGljJztcbiAgICAgICAgY29uc3Qgb3V0RGlyID0gJ2Rpc3QnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGZpbGVzID0gcmVhZGRpclN5bmMocHVibGljRGlyKTtcbiAgICAgICAgICBmaWxlcy5mb3JFYWNoKGZpbGUgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGUuaW5jbHVkZXMoJyAnKSkgcmV0dXJuOyAvLyBTa2lwIGZpbGVzIHdpdGggc3BhY2VzXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBjb25zdCBzcmMgPSBqb2luKHB1YmxpY0RpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGNvbnN0IGRlc3QgPSBqb2luKG91dERpciwgZmlsZSk7XG4gICAgICAgICAgICAgIGlmIChzdGF0U3luYyhzcmMpLmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgY29weUZpbGVTeW5jKHNyYywgZGVzdCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFNraXBwZWQgcHJvYmxlbWF0aWMgZmlsZTogJHtmaWxlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBjb3B5IHNvbWUgcHVibGljIGZpbGVzJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gICAgaW5jbHVkZTogWyd4bHN4J10sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgY29weVB1YmxpY0RpcjogZmFsc2UsIC8vIERpc2FibGUgZGVmYXVsdCBjb3B5LCB1c2Ugb3VyIGN1c3RvbSBwbHVnaW5cbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxjQUFjLGFBQWEsZ0JBQWdCO0FBQ3BELFNBQVMsWUFBWTtBQUdyQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTjtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sY0FBYztBQUNaLGNBQU0sWUFBWTtBQUNsQixjQUFNLFNBQVM7QUFDZixZQUFJO0FBQ0YsZ0JBQU0sUUFBUSxZQUFZLFNBQVM7QUFDbkMsZ0JBQU0sUUFBUSxVQUFRO0FBQ3BCLGdCQUFJLEtBQUssU0FBUyxHQUFHLEVBQUc7QUFDeEIsZ0JBQUk7QUFDRixvQkFBTSxNQUFNLEtBQUssV0FBVyxJQUFJO0FBQ2hDLG9CQUFNLE9BQU8sS0FBSyxRQUFRLElBQUk7QUFDOUIsa0JBQUksU0FBUyxHQUFHLEVBQUUsT0FBTyxHQUFHO0FBQzFCLDZCQUFhLEtBQUssSUFBSTtBQUFBLGNBQ3hCO0FBQUEsWUFDRixTQUFTLEtBQUs7QUFDWixzQkFBUSxLQUFLLDZCQUE2QixJQUFJLEVBQUU7QUFBQSxZQUNsRDtBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0gsU0FBUyxLQUFLO0FBQ1osa0JBQVEsS0FBSyxrQ0FBa0M7QUFBQSxRQUNqRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxJQUN4QixTQUFTLENBQUMsTUFBTTtBQUFBLEVBQ2xCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUE7QUFBQSxFQUNqQjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
