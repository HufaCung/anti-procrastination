import express, { type ErrorRequestHandler } from 'express';
import { databaseKind } from './db/database.js';
import cors from 'cors';
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getJwtSecret } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { projectsRouter } from './routes/projects.js';
import { tasksRouter } from './routes/tasks.js';
import { sessionsRouter } from './routes/sessions.js';
import { settingsRouter } from './routes/settings.js';
import { adminRouter } from './routes/admin.js';
import { bootstrapAdmin } from './services/admin-bootstrap.js';


export const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', adminRouter);

// In production, one Express service serves both the API and the built React app.
app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found' }); });
if (process.env.NODE_ENV === 'production') {
  getJwtSecret();
  const frontendDir = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  const index = path.join(frontendDir, 'index.html');
  if (!fs.existsSync(index)) throw new Error('Frontend build missing. Run npm run build from the repository root.');
  app.use(express.static(frontendDir, { index: false }));
  app.get('*', (req, res) => {
    if (path.extname(req.path)) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}

const handleError: ErrorRequestHandler = (_error, _req, res, _next) => {
  console.error('[backend] Request failed');
  res.status(500).json({ error: 'Internal server error' });
};
app.use(handleError);

// Start server when run directly
if (process.env.NODE_ENV !== 'test') {
  console.log(`[backend] Database: ${databaseKind}`);
  const bootstrap = await bootstrapAdmin();
  if (bootstrap !== 'disabled') console.log(`[backend] Admin bootstrap: ${bootstrap}`);
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    const address = server.address();
    console.log(`[backend] TinyDo running on http://localhost:${typeof address === 'object' && address ? address.port : PORT}`);
  });
}
