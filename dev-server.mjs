import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve('C:/Users/Hp/OneDrive/Desktop/My Portfolio/Portfolio-deploy');

// Check for local env files safely without exposing any secrets
const envFiles = ['.env.local', '.env.development.local', '.env'];
let loadedEnvFile = null;
for (const envFile of envFiles) {
  const envPath = path.join(root, envFile);
  if (fs.existsSync(envPath)) {
    try {
      if (process.loadEnvFile) {
        process.loadEnvFile(envPath);
      }
      loadedEnvFile = envFile;
      break;
    } catch (_) {}
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  // 1. Handle Vercel Serverless Function Routes (/api/*)
  if (pathname.startsWith('/api/')) {
    const apiRouteName = pathname.slice(5); // e.g. "contact"
    const apiFile = path.join(root, 'api', `${apiRouteName}.js`);

    if (fs.existsSync(apiFile)) {
      // Read request body
      let rawBody = '';
      for await (const chunk of req) {
        rawBody += chunk;
      }

      try {
        req.body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        req.body = rawBody;
      }

      // Augment res with Vercel/Express-compatible helpers
      res.status = function (code) {
        res.statusCode = code;
        return res;
      };

      res.json = function (data) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
        return res;
      };

      try {
        // Dynamically import the existing serverless handler
        const moduleUrl = new URL(`file://${apiFile.replace(/\\/g, '/')}`).href;
        const handlerModule = await import(moduleUrl);
        const handler = handlerModule.default || handlerModule;

        await handler(req, res);
        return;
      } catch (handlerErr) {
        console.error(`[API Error] ${pathname}:`, handlerErr);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: false,
            error: 'Internal server error while executing serverless route handler.'
          }));
        }
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        error: `Serverless API route not found: ${pathname}`
      }));
      return;
    }
  }

  // 2. Static File Serving
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(root, relativePath);

  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Portfolio Local Development Server running on http://localhost:${PORT}/`);
  console.log(`Serving static files from: ${root}`);
  console.log(`Serverless /api/ routes mapped to: ${path.join(root, 'api')}`);
  if (loadedEnvFile) {
    console.log(`Loaded environment configuration from: ${loadedEnvFile}`);
  } else {
    console.log(`No local .env file found. Reading system process environment.`);
  }
});

