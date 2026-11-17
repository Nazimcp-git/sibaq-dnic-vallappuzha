import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env in the project directory
  const env = loadEnv(mode, process.cwd(), '');

  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyC8uMIj-oPS5fPrtTKEQNqMutG1pgWzM5I",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "exaam-sheild.firebaseapp.com",
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || "https://exaam-sheild-default-rtdb.firebaseio.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "exaam-sheild",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "exaam-sheild.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "260193808780",
    appId: env.VITE_FIREBASE_APP_ID || "1:260193808780:web:7d3b8878484ed45f07a6a9"
  };

  return {
    root: '.',
    publicDir: false,
    plugins: [
      {
        name: 'html-firebase-env-injector',
        transformIndexHtml(html) {
          const configScript = `
  <!-- Injected Firebase Environment Configuration from .env via Vite -->
  <script>
    window.__FIREBASE_CONFIG__ = ${JSON.stringify(firebaseConfig, null, 2)};
  </script>`;
          if (html.includes('<!-- Firebase v8 SDK -->')) {
            return html.replace('<!-- Firebase v8 SDK -->', `${configScript}\n  <!-- Firebase v8 SDK -->`);
          }
          if (html.includes('</head>')) {
            return html.replace('</head>', `${configScript}\n</head>`);
          }
          return html;
        }
      },
      {
        name: 'copy-static-assets-on-build',
        closeBundle() {
          const distDir = resolve(__dirname, 'dist');
          if (!fs.existsSync(distDir)) return;

          const dirsToCopy = ['js', 'css', 'data', 'assets'];
          const filesToCopy = ['manifest.json', 'sw.js', 'offline.html', 'database.rules.json'];

          dirsToCopy.forEach(dir => {
            const srcPath = resolve(__dirname, dir);
            const destPath = resolve(distDir, dir);
            if (fs.existsSync(srcPath)) {
              fs.cpSync(srcPath, destPath, { recursive: true, force: true });
            }
          });

          filesToCopy.forEach(file => {
            const srcPath = resolve(__dirname, file);
            const destPath = resolve(distDir, file);
            if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
              fs.copyFileSync(srcPath, destPath);
            }
          });
        }
      }
    ],
    server: {
      port: 5173,
      open: false,
      host: true
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          register: resolve(__dirname, 'register.html'),
          setup: resolve(__dirname, 'setup.html'),
          offline: resolve(__dirname, 'offline.html')
        }
      }
    }
  };
});
