import cors from 'cors';
import express, { Request, Response } from 'express';
import { getDatabase } from '../server/db/database.js';
import { apiRouter } from '../server/routes/api.js';

let appInstance: express.Express | null = null;

export async function getApp(): Promise<express.Express> {
  if (!appInstance) {
    const app = express();

    // Ensure SQLite database is initialized
    await getDatabase();

    app.use(cors());
    app.use(express.json());

    // Mount API router at both '/api' and root to support all Vercel rewrite patterns
    app.use('/api', apiRouter);
    app.use(apiRouter);

    appInstance = app;
  }
  return appInstance;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();

  // If Vercel rewrites stripped the path, restore from originalUrl
  if (req.url === '/' && req.originalUrl && req.originalUrl !== '/') {
    req.url = req.originalUrl;
  }

  return app(req, res);
}
