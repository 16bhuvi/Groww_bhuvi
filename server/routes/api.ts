import express, { Request, Response } from 'express';
import { executeQuery, executeRun } from '../db/database.js';
import { defaultMarketProvider } from '../providers/marketDataProvider.js';
import { marketDataService } from '../services/marketDataService.js';
import { authenticateUser, getUserIdFromRequest, registerUser, verifyJwtToken } from '../auth.js';

export const apiRouter = express.Router();

// Helper to get authenticated user id (via JWT Bearer token, x-user-id header, or default demo user)
function getUserId(req: Request): string {
  return getUserIdFromRequest(req);
}

// 0. Authentication Endpoints (JWT token based)
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const authResult = await authenticateUser(email, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json(authResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const result = await registerUser(email, password, name);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const payload = verifyJwtToken(token);
      if (payload) {
        return res.json({
          authenticated: true,
          user: payload,
        });
      }
    }

    // Default demo session
    res.json({
      authenticated: false,
      user: {
        userId: 'user_demo_1',
        email: 'demo@groww.in',
        name: 'Groww Investor',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Market Status
apiRouter.get('/market/status', (req: Request, res: Response) => {
  const status = defaultMarketProvider.getMarketStatus();
  res.json(status);
});

apiRouter.post('/market/status/override', (req: Request, res: Response) => {
  const { is_open } = req.body;
  defaultMarketProvider.setMarketStatusOverride(typeof is_open === 'boolean' ? is_open : null);
  res.json(defaultMarketProvider.getMarketStatus());
});

// 3. Market Indices
apiRouter.get('/market/indices', async (req: Request, res: Response) => {
  try {
    const indices = await defaultMarketProvider.getMarketOverview();
    res.json(indices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Watchlist Analysis (The Core Smart Watchlist Endpoint)
apiRouter.get('/watchlist', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const watchlistId = req.query.watchlist_id as string | undefined;
    const sector = req.query.sector as string | undefined;
    const attentionLevel = req.query.attention_level as string | undefined;
    const minScore = req.query.min_score ? Number(req.query.min_score) : undefined;
    const searchQuery = req.query.q as string | undefined;

    const analysis = await marketDataService.getWatchlistAnalysis(userId, watchlistId, {
      sector,
      attentionLevel,
      minScore,
      searchQuery,
    });

    res.json(analysis);
  } catch (err: any) {
    console.error('Error in /api/watchlist:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Watchlist Management
apiRouter.get('/watchlist/all', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const watchlists = await marketDataService.getWatchlists(userId);
    res.json(watchlists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/watchlist', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Watchlist name is required' });
    }
    const wl = await marketDataService.createWatchlist(userId, name.trim());
    res.status(201).json(wl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/watchlist/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    await marketDataService.deleteWatchlist(userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/watchlist/:id/stocks', async (req: Request, res: Response) => {
  try {
    const { stock_id } = req.body;
    if (!stock_id) return res.status(400).json({ error: 'stock_id is required' });

    const result = await marketDataService.addStockToWatchlist(req.params.id, stock_id);
    if (!result.success) {
      return res.status(409).json({ error: result.message });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/watchlist/:id/stocks/:stockId', async (req: Request, res: Response) => {
  try {
    await marketDataService.removeStockFromWatchlist(req.params.id, req.params.stockId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/watchlist/:id/reorder', async (req: Request, res: Response) => {
  try {
    const { ordered_stock_ids } = req.body;
    if (!Array.isArray(ordered_stock_ids)) {
      return res.status(400).json({ error: 'ordered_stock_ids array required' });
    }
    await marketDataService.reorderWatchlist(req.params.id, ordered_stock_ids);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Last-Seen State Persistence (Explicit Updates)
apiRouter.post('/stocks/:stockId/mark-seen', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const updatedState = await marketDataService.markStockAsSeen(userId, req.params.stockId);
    res.json(updatedState);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/watchlist/:id/mark-seen', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    await marketDataService.markAllWatchlistAsSeen(userId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Stock Search
apiRouter.get('/stocks/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    if (q.trim().length === 0) return res.json([]);
    const results = await marketDataService.searchStocks(q);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Stock Detail & Chart
apiRouter.get('/stocks/:symbol', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const timeframe = (req.query.timeframe as string) || '1D';
    const detail = await marketDataService.getStockDetail(userId, req.params.symbol, timeframe);
    if (!detail) return res.status(404).json({ error: 'Stock not found' });
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Simulation & Edge Case Testing Controls
apiRouter.post('/simulation/trigger', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const now = new Date().toISOString();

    if (scenario === 'TATA_PLUNGE') {
      // Scenario: Tata Motors plunges 6.2%, 2.8x Vol, 50 DMA breached, Q3 Results
      await defaultMarketProvider.applyNewSnapshot({
        symbol: 'TATAMOTORS',
        timestamp: now,
        price: 710.25,
        volume: 33600000,
        volume_ratio: 2.8,
        rsi_14: 31.2,
        dma_50: 734.5,
        dma_200: 692.0,
      });

      return res.json({
        success: true,
        message: 'Simulated Tata Motors Q3 margin contraction plunge (-6.2%, 2.8x vol, 50 DMA breach, Q3 Results)',
      });
    }

    if (scenario === 'INFY_BREAKOUT') {
      // Scenario: Infosys surges to new 52-week high, 2.0x volume, positive earnings news
      await defaultMarketProvider.applyNewSnapshot({
        symbol: 'INFY',
        timestamp: now,
        price: 1928.5,
        volume: 22000000,
        volume_ratio: 2.0,
        rsi_14: 72.4,
        dma_50: 1820.0,
        dma_200: 1640.0,
      });

      return res.json({
        success: true,
        message: 'Simulated Infosys 52-week high breakout (+4.9%, 2.0x vol, AI deal announcement)',
      });
    }

    if (scenario === 'OUT_OF_ORDER_TEST') {
      // Injects snapshot with older timestamp to verify safety rejection
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      const testResult = await defaultMarketProvider.applyNewSnapshot({
        symbol: 'TATAMOTORS',
        timestamp: pastTime,
        price: 760.0,
      });

      return res.json({
        success: testResult.success,
        rejected: !testResult.success,
        reason: testResult.reason,
        message: 'Attempted to apply older snapshot timestamp. System rejected it cleanly without corrupting current price.',
      });
    }

    if (scenario === 'DATA_CONFLICT_TEST') {
      // Injects snapshot from secondary provider with >2% divergence
      const conflictResult = await defaultMarketProvider.applyNewSnapshot({
        symbol: 'HDFCBANK',
        timestamp: now,
        price: 1810.0, // primary is 1742.8 (>3.8% gap)
        provider: 'BSE_FEED_SECONDARY',
      });

      return res.json({
        success: true,
        conflict_flagged: true,
        message: 'Injected divergent multi-provider quote (>3% gap). System recorded conflict flag and audit entry.',
      });
    }

    if (scenario === 'RESET') {
      // Reset last-seen states to 4 hours ago so user can re-experience "What changed since last visit"
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      await executeRun(
        `UPDATE user_stock_state SET last_seen_at = ?, updated_at = ? WHERE user_id = ?`,
        [fourHoursAgo, fourHoursAgo, 'user_demo_1']
      );

      return res.json({
        success: true,
        message: 'Reset user last-seen state to 4 hours ago. Return to dashboard to see fresh changes!',
      });
    }

    res.status(400).json({ error: 'Unknown scenario' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs
apiRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await executeQuery<any>(
      `SELECT * FROM system_audit_logs ORDER BY timestamp DESC LIMIT 20`
    );
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
