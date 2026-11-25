import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** While developing, your settings are also saved to settings.local.json in the project (not just the browser), so a
 *  refresh, a new tab, the deck or another browser all open with your work. GET reads it, PUT writes it. */
function settingsFile(): Plugin {
  const file = fileURLToPath(new URL('./settings.local.json', import.meta.url));
  return {
    name: 'coin-loop-settings',
    configureServer(server) {
      server.middlewares.use('/__settings', (req, res) => {
        if (req.method === 'PUT') {
          let body = '';
          req.on('data', (c: Buffer) => (body += c));
          req.on('end', () => {
            try {
              JSON.parse(body);
              fs.writeFileSync(file, body);
              res.statusCode = 204;
            } catch {
              res.statusCode = 400;
            }
            res.end();
          });
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}');
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), settingsFile()],
  server: { port: 4848, strictPort: false },
});
