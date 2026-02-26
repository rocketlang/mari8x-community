/**
 * Mari8X Community Edition - Backend Server
 */

import express from 'express';
import { createYoga } from 'graphql-yoga';
import cors from 'cors';
import { schema } from './schema/index.js';
import { prisma } from './lib/prisma.js';
import { getPortCongestion, getTopCongestedPorts, getAllPortsCongestion } from './congestion/engine.js';
import { getPreArrivalVessels } from './agent/pre-arrival.js';
import { getChecklist, updateDocStatus, listOpenChecklists } from './agent/documents.js';
import { forecastDA } from './agent/da-forecast.js';

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

// ── Agent Wedge REST API ──────────────────────────────────────────────────────

/**
 * GET /api/agent/pre-arrival/:portCode?window=48
 * Vessels likely to arrive within `window` hours (default 48).
 */
app.get('/api/agent/pre-arrival/:portCode', async (req, res) => {
  try {
    const window = parseInt((req.query as any).window ?? '48', 10);
    const data   = await getPreArrivalVessels(req.params.portCode, window);
    if (!data) return res.status(404).json({ error: `Port "${req.params.portCode}" not found` });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/agent/documents/:voyageId?imo=&vessel=&port=&eta=
 * Fetch or initialise document checklist for a voyage.
 */
app.get('/api/agent/documents/:voyageId', (req, res) => {
  try {
    const q = req.query as any;
    const checklist = getChecklist(
      req.params.voyageId,
      q.imo    ?? 'UNKNOWN',
      q.vessel ?? 'Unknown Vessel',
      q.port   ?? 'UNKNOWN',
      q.eta    ?? null,
    );
    res.json(checklist);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * PATCH /api/agent/documents/:voyageId/:docId
 * Body: { status: 'submitted'|'verified'|'rejected', notes?: string }
 */
app.patch('/api/agent/documents/:voyageId/:docId', express.json(), (req, res) => {
  try {
    const { status, notes } = req.body as any;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const result = updateDocStatus(req.params.voyageId, req.params.docId, status, notes);
    if (!result) return res.status(404).json({ error: 'voyage or document not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/agent/documents — list all open (incomplete) checklists
 */
app.get('/api/agent/documents', (_req, res) => {
  try {
    res.json({ checklists: listOpenChecklists() });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/agent/da-forecast
 * Body: { port: "SGSIN", vessel: { grt, loaMetres, teuCapacity?, cargoTonnes? } }
 */
app.post('/api/agent/da-forecast', express.json(), (req, res) => {
  try {
    const { port, vessel } = req.body as any;
    if (!port || !vessel?.grt || !vessel?.loaMetres) {
      return res.status(400).json({ error: 'port, vessel.grt, and vessel.loaMetres are required' });
    }
    res.json(forecastDA(port, vessel));
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
