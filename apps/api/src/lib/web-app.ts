import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Optional same-origin delivery keeps browser sessions first-party. */
export function installWebApp(app: Express, directory?: string) {
  if (!directory) return;
  const root = resolve(directory);
  const index = resolve(root, 'index.html');
  if (!existsSync(index)) throw new Error('Configured web application build is missing');
  app.use((req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return express.static(root, {
      index: false, maxAge: '1y', immutable: true,
      setHeaders: (response, file) => {
        if (file.endsWith('.html')) response.setHeader('Cache-Control', 'no-store');
      },
    })(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')
      || req.path.split('/').pop()?.includes('.') || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-store').sendFile(index);
  });
}
