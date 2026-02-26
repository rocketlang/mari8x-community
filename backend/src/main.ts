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
import { getVesselProfile } from './agent/vessel-profile.js';
import { getAlerts, acknowledgeAlert, evaluateAlerts, ensureDefaultRules } from './agent/alerts.js';

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

// ── Vessel Profile ────────────────────────────────────────────────────────────

/**
 * GET /api/agent/vessel/:imo
 * Full vessel intelligence: position, 24h track, nearest port + ETA,
 * congestion at destination, DA forecast, open doc checklists.
 */
app.get('/api/agent/vessel/:imo', async (req, res) => {
  try {
    const profile = await getVesselProfile((req.params as any).imo);
    if (!profile) return res.status(404).json({ error: `Vessel IMO "${(req.params as any).imo}" not found` });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Voyage Schedule ───────────────────────────────────────────────────────────

/**
 * GET /api/agent/schedule/:portCode
 *   ?window=72   — ETA window hours (default 72)
 *
 * Returns ETA-ordered arrival timeline for a port, combining:
 *   pre-arrival vessel list (ETA, confidence, speed, distance)
 *   doc checklist readiness for any voyage linked to that IMO + port
 *   congestion forecast at expected arrival time
 *   indicative DA cost
 *
 * Each row in `arrivals` is a ready-to-render schedule card.
 */
app.get('/api/agent/schedule/:portCode', async (req, res) => {
  try {
    const { portCode } = req.params as any;
    const window = parseInt((req.query as any).window ?? '72', 10);

    const [preArrival, congestion] = await Promise.all([
      getPreArrivalVessels(portCode, window),
      getPortCongestion(portCode),
    ]);

    if (!preArrival) {
      return res.status(404).json({ error: `Port "${portCode}" not found` });
    }

    const allOpen   = listOpenChecklists();
    const portUpper = portCode.toUpperCase();
    const daBase    = forecastDA(portCode, { grt: 50000, loaMetres: 250, teuCapacity: 4000 });

    // Build a schedule card per pre-arrival vessel
    const arrivals = preArrival.vessels.map(v => {
      const etaIso = v.etaAt;
      // Find any open checklist for this vessel + port
      const checklist = allOpen.find(c => c.imo === v.imo && c.portUnlocode === portUpper) ?? null;

      return {
        imo:         v.imo,
        vesselName:  v.name,
        etaHours:    v.etaHours,
        etaAt:       etaIso,
        distanceNm:  v.distanceNm,
        speedKt:     v.speedKt,
        confidence:  v.confidence,
        docs: checklist ? {
          voyageId:  checklist.voyageId,
          readyPct:  checklist.summary.readyPct,
          overdue:   checklist.summary.overdue,
          pending:   checklist.summary.pending,
        } : null,
        congestionAtArrival: congestion ? {
          level:              congestion.level,
          score:              congestion.congestionScore,
          estimatedWaitHours: congestion.estimatedWaitHours,
        } : null,
        daEstimateUsd: daBase.costs.totalUsd,
      };
    });

    res.json({
      port:       preArrival.port,
      windowHours: window,
      generatedAt: new Date().toISOString(),
      currentCongestion: congestion ? {
        level:  congestion.level,
        score:  congestion.congestionScore,
        vessels: congestion.anchorageVessels + congestion.approachVessels,
      } : null,
      arrivalCount: arrivals.length,
      arrivals,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Port Dashboard ────────────────────────────────────────────────────────────

/**
 * GET /api/agent/dashboard/:portCode
 *   ?window=48          — pre-arrival ETA window (hours, default 48)
 *   &grt=50000          — vessel GRT for DA forecast (default 50000)
 *   &loa=250            — vessel LOA metres for DA forecast (default 250)
 *   &teu=4000           — vessel TEU capacity for DA forecast (default 4000)
 *
 * Aggregates:
 *   - Port congestion snapshot
 *   - Pre-arrival vessel list
 *   - Open document checklists for this port
 *   - DA forecast for a representative vessel call
 */
app.get('/api/agent/dashboard/:portCode', async (req, res) => {
  try {
    const { portCode } = req.params as any;
    const q = req.query as any;
    const window = parseInt(q.window ?? '48', 10);

    // Run congestion + pre-arrival in parallel
    const [congestion, preArrival] = await Promise.all([
      getPortCongestion(portCode),
      getPreArrivalVessels(portCode, window),
    ]);

    if (!congestion && !preArrival) {
      return res.status(404).json({ error: `Port "${portCode}" not found or has no coordinates` });
    }

    // Document checklists open for this port
    const allOpen     = listOpenChecklists();
    const portUpper   = portCode.toUpperCase();
    const portDocs    = allOpen.filter(c => c.portUnlocode === portUpper);

    // DA forecast for a representative vessel (defaults or query params)
    const vesselSpec = {
      grt:         parseInt(q.grt ?? '50000', 10),
      loaMetres:   parseInt(q.loa ?? '250', 10),
      teuCapacity: parseInt(q.teu ?? '4000', 10),
    };
    const daForecast = forecastDA(portCode, vesselSpec);

    res.json({
      port:         congestion?.port ?? preArrival?.port ?? { unlocode: portUpper },
      generatedAt:  new Date().toISOString(),
      congestion,
      preArrival,
      documents: {
        openVoyages:   portDocs.length,
        totalPending:  portDocs.reduce((s, c) => s + c.summary.pending, 0),
        totalOverdue:  portDocs.reduce((s, c) => s + c.summary.overdue, 0),
        checklists:    portDocs,
      },
      daForecast,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Arrival Alert REST API ────────────────────────────────────────────────────

/**
 * GET /api/agent/alerts/:portCode
 *   ?ack=true   — include acknowledged alerts (default false)
 * Returns active alert queue for the port.
 */
app.get('/api/agent/alerts/:portCode', (req, res) => {
  try {
    const includeAck = (req.query as any).ack === 'true';
    const alerts = getAlerts(req.params.portCode, includeAck);
    res.json({ portCode: req.params.portCode.toUpperCase(), count: alerts.length, alerts });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/agent/alerts/:portCode/evaluate
 * Trigger alert evaluation and return newly fired alerts.
 */
app.post('/api/agent/alerts/:portCode/evaluate', async (req, res) => {
  try {
    const fired = await evaluateAlerts(req.params.portCode);
    res.json({ portCode: req.params.portCode.toUpperCase(), newAlerts: fired.length, alerts: fired });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/agent/alerts/:portCode/:alertId/ack
 * Acknowledge a specific alert.
 */
app.post('/api/agent/alerts/:portCode/:alertId/ack', (req, res) => {
  try {
    const ok = acknowledgeAlert(req.params.portCode, req.params.alertId);
    if (!ok) return res.status(404).json({ error: 'Alert not found' });
    res.json({ ok: true, alertId: req.params.alertId });
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
ensureDefaultRules();
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
