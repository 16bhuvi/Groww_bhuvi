import { beforeAll, describe, expect, it } from 'vitest';
import { executeQuery, executeRun, getDatabase } from '../server/db/database.js';
import { defaultMarketProvider } from '../server/providers/marketDataProvider.js';

describe('Data Integrity & Reliability Tests', () => {
  beforeAll(async () => {
    await getDatabase();
  });

  it('1. Enforces database-level uniqueness on (watchlist_id, stock_id)', async () => {
    const watchlistId = 'wl_test_unique';
    const stockId = 'stock_tatamotors';
    const now = new Date().toISOString();

    // Create a temporary test watchlist
    await executeRun(
      `INSERT OR IGNORE INTO watchlists (id, user_id, name, is_default, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [watchlistId, 'user_demo_1', 'Test Uniqueness WL', now, now]
    );

    // First insert succeeds
    await executeRun(
      `INSERT OR IGNORE INTO watchlist_stocks (watchlist_id, stock_id, display_order, added_at)
       VALUES (?, ?, 0, ?)`,
      [watchlistId, stockId, now]
    );

    // Second insert with exact same pair MUST throw database primary key constraint error
    let duplicateFailed = false;
    try {
      await executeRun(
        `INSERT INTO watchlist_stocks (watchlist_id, stock_id, display_order, added_at)
         VALUES (?, ?, 1, ?)`,
        [watchlistId, stockId, now]
      );
    } catch (err: any) {
      duplicateFailed = true;
      expect(err.message.toLowerCase()).toContain('unique');
    }

    expect(duplicateFailed).toBe(true);
  });

  it('2. Rejects out-of-order market snapshot from overwriting newer state', async () => {
    const symbol = 'TATAMOTORS';

    // Step A: Apply a snapshot at 10:02:00
    const snapshotA = {
      symbol,
      timestamp: '2026-09-04T10:02:00.000Z',
      price: 710.0,
    };
    const resA = await defaultMarketProvider.applyNewSnapshot(snapshotA);
    expect(resA.success).toBe(true);

    // Verify current state is Snapshot A (10:02:00)
    const current = await defaultMarketProvider.getSnapshot(symbol);
    expect(current?.timestamp).toBe('2026-09-04T10:02:00.000Z');
    expect(current?.price).toBe(710.0);

    // Step B: Now attempt to apply older Snapshot B at 10:01:00
    const snapshotB = {
      symbol,
      timestamp: '2026-09-04T10:01:00.000Z',
      price: 715.0,
    };
    const resB = await defaultMarketProvider.applyNewSnapshot(snapshotB);

    // Must be rejected with OUT_OF_ORDER reason!
    expect(resB.success).toBe(false);
    expect(resB.reason).toContain('OUT_OF_ORDER');

    // Verify state was NOT overwritten! Price must remain 710.0
    const stateAfterReject = await defaultMarketProvider.getSnapshot(symbol);
    expect(stateAfterReject?.timestamp).toBe('2026-09-04T10:02:00.000Z');
    expect(stateAfterReject?.price).toBe(710.0);
  });

  it('3. Flags data conflict when multi-provider prices exceed tolerance (>1.5%)', async () => {
    const symbol = 'INFY';

    const current = await defaultMarketProvider.getSnapshot(symbol);
    const basePrice = current?.price || 1900.0;
    const divergentPrice = Number((basePrice * 1.05).toFixed(2)); // 5% price gap

    // Incoming snapshot from alternate provider with a 5% price gap
    const conflictingSnapshot = {
      symbol,
      timestamp: new Date(Date.now() + 30000).toISOString(),
      price: divergentPrice,
      provider: current?.provider === 'SECONDARY_FEED' ? 'NSE_FEED_B' : 'SECONDARY_FEED',
    };

    const res = await defaultMarketProvider.applyNewSnapshot(conflictingSnapshot);
    expect(res.success).toBe(true);

    // Verify data_conflict flag is set to true
    const updated = await defaultMarketProvider.getSnapshot(symbol);
    expect(updated?.data_conflict).toBe(true);

    // Verify audit log entry was created
    const logs = await executeQuery<any>(
      `SELECT * FROM system_audit_logs WHERE event_type = 'PROVIDER_DATA_CONFLICT_DETECTED' ORDER BY timestamp DESC LIMIT 1`
    );
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].details).toContain('Conflict detected for INFY');
  });
});
