/**
 * Mari8X Community Edition - Backend Server
 */

import express from 'express';
import { createYoga } from 'graphql-yoga';
import cors from 'cors';
import { schema } from './schema/index.js';
import { prisma } from './lib/prisma.js';
import { getPortCongestion, getTopCongestedPorts, getAllPortsCongestion } from './congestion/engine.js';

const app = express();
const PORT = process.env.PORT || 4001;

// CORS
app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    edition: 'community',
  });
});

// ── Congestion REST API ───────────────────────────────────────────────────────

/** GET /api/congestion/top10 — most congested ports right now */
app.get('/api/congestion/top10', async (_req, res) => {
  try {
    const ports = await getTopCongestedPorts(10);
    res.json({ ports, count: ports.length, generatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/congestion/:portCode — congestion detail for one port (UNLOCODE) */
app.get('/api/congestion/:portCode', async (req, res) => {
  try {
    const data = await getPortCongestion(req.params.portCode);
    if (!data) {
      return res.status(404).json({ error: `Port "${req.params.portCode}" not found or has no coordinates` });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/congestion — all ports summary (sorted by score desc) */
app.get('/api/congestion', async (_req, res) => {
  try {
    const ports = await getAllPortsCongestion();
    res.json({
      ports,
      total:       ports.length,
      high:        ports.filter(p => p.level === 'high' || p.level === 'critical').length,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── GraphQL endpoint ──────────────────────────────────────────────────────────

// GraphQL endpoint
const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage: true,
});

app.use('/graphql', yoga);

// ── Periodic congestion alert sweep (every 15 min) ──────────────────────────
setInterval(async () => {
  try {
    await getTopCongestedPorts(20); // warms cache + fires any high/critical alerts
  } catch { /* non-fatal */ }
}, 15 * 60_000);

// Start server
app.listen(PORT, () => {
  console.log(`🚢 Mari8X Community Edition`);
  console.log(`📡 GraphQL API: http://localhost:${PORT}/graphql`);
  console.log(`🌊 Congestion:  http://localhost:${PORT}/api/congestion`);
  console.log(`❤️  Health:      http://localhost:${PORT}/health`);
  // Warm congestion cache on startup
  setTimeout(() => getTopCongestedPorts(20).catch(() => {}), 3000);
});
