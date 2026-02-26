/**
 * Mari8X Community Edition - Backend Server
 */

import express from 'express';
import { createYoga } from 'graphql-yoga';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { schema } from './schema/index.js';
import { prisma } from './lib/prisma.js';
import { getPortCongestion, getTopCongestedPorts, getAllPortsCongestion } from './congestion/engine.js';
import { getPreArrivalVessels } from './agent/pre-arrival.js';
import { getChecklist, updateDocStatus, listOpenChecklists } from './agent/documents.js';
import { forecastDA } from './agent/da-forecast.js';
import { getVesselProfile } from './agent/vessel-profile.js';
import { getAlerts, acknowledgeAlert, evaluateAlerts, ensureDefaultRules } from './agent/alerts.js';
import {
  registerAgent, loginAgent, getAgentByKey, getAgentProfile,
  updateAgentPorts, updateAgentTelegram, sendTelegramAlert, getAgentsForPort,
  listAgents,
} from './agent/onboarding.js';
import { buildOnboardingHtml } from './agent/onboarding-html.js';
import {
  createBL, issueBL, amendBL, surrenderBL, releaseBL,
  getBL, listBLs, getBLDashboard,
} from './agent/bl.js';
import { generateBLPdf } from './agent/bl-pdf.js';
import {
  upsertETA, getETA, listETAsByPort, listAllETAs, getETADashboard, markArrived,
  setEtaBroadcast,
} from './agent/eta.js';
import type { EtaRecord } from './agent/eta.js';

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

// ── Bill of Lading REST API ───────────────────────────────────────────────────

/**
 * GET /api/bl?status=&portOfDischarge=&voyageId=&limit=
 * List B/Ls with optional filters.
 */
app.get('/api/bl', (req, res) => {
  try {
    const q = req.query as any;
    const bls = listBLs({
      status:          q.status          ?? undefined,
      portOfDischarge: q.portOfDischarge ?? undefined,
      voyageId:        q.voyageId        ?? undefined,
      limit:           q.limit ? parseInt(q.limit, 10) : 50,
    });
    res.json({ count: bls.length, bls });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/bl/dashboard — status counts
 */
app.get('/api/bl/dashboard', (_req, res) => {
  try {
    res.json(getBLDashboard());
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/bl/:blNumber — single B/L full record
 */
app.get('/api/bl/:blNumber', (req, res) => {
  try {
    const bl = getBL(req.params.blNumber);
    if (!bl) return res.status(404).json({ error: `B/L "${req.params.blNumber}" not found` });
    res.json(bl);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/bl — create a draft B/L
 * Body: CreateBLInput fields
 */
app.post('/api/bl', express.json(), (req, res) => {
  try {
    const bl = createBL(req.body);
    res.status(201).json(bl);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * PATCH /api/bl/:blNumber/issue
 * Body: { issuedBy: string, placeOfIssue?: string }
 */
app.patch('/api/bl/:blNumber/issue', express.json(), (req, res) => {
  try {
    const { issuedBy, placeOfIssue } = req.body as any;
    if (!issuedBy) return res.status(400).json({ error: 'issuedBy is required' });
    const bl = issueBL(req.params.blNumber, issuedBy, placeOfIssue);
    if (!bl) return res.status(404).json({ error: `B/L "${req.params.blNumber}" not found` });
    res.json(bl);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * PATCH /api/bl/:blNumber/amend
 * Body: { field, newValue, reason, amendedBy }
 */
app.patch('/api/bl/:blNumber/amend', express.json(), (req, res) => {
  try {
    const { field, newValue, reason, amendedBy } = req.body as any;
    if (!field || !newValue || !reason || !amendedBy) {
      return res.status(400).json({ error: 'field, newValue, reason, amendedBy are required' });
    }
    const bl = amendBL(req.params.blNumber, { field, newValue, reason, amendedBy });
    if (!bl) return res.status(404).json({ error: `B/L "${req.params.blNumber}" not found` });
    res.json(bl);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * PATCH /api/bl/:blNumber/surrender
 * Body: { surrenderedBy: string }
 */
app.patch('/api/bl/:blNumber/surrender', express.json(), (req, res) => {
  try {
    const { surrenderedBy } = req.body as any;
    if (!surrenderedBy) return res.status(400).json({ error: 'surrenderedBy is required' });
    const bl = surrenderBL(req.params.blNumber, surrenderedBy);
    if (!bl) return res.status(404).json({ error: `B/L "${req.params.blNumber}" not found` });
    res.json(bl);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * PATCH /api/bl/:blNumber/release
 * Body: { releaseAuthorisedBy, telexRefNo?, releaseType? }
 */
app.patch('/api/bl/:blNumber/release', express.json(), (req, res) => {
  try {
    const { releaseAuthorisedBy, telexRefNo, releaseType } = req.body as any;
    if (!releaseAuthorisedBy) return res.status(400).json({ error: 'releaseAuthorisedBy is required' });
    const bl = releaseBL(req.params.blNumber, { releaseAuthorisedBy, telexRefNo, releaseType });
    if (!bl) return res.status(404).json({ error: `B/L "${req.params.blNumber}" not found` });
    res.json(bl);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/bl/:blNumber/pdf
 * Returns a PDF of the Bill of Lading (application/pdf).
 * Attach ?download=1 to force-download instead of inline display.
 */
app.get('/api/bl/:blNumber/pdf', async (req, res) => {
  try {
    const bl = getBL(req.params.blNumber);
    if (!bl) return res.status(404).json({ error: `B/L "${req.params.blNumber}" not found` });
    const pdfBuffer = await generateBLPdf(bl);
    const disposition = (req.query as any).download === '1'
      ? `attachment; filename="${bl.blNumber}.pdf"`
      : `inline; filename="${bl.blNumber}.pdf"`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.send(pdfBuffer);
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
 * Also fans out Telegram notifications to subscribed agents.
 */
app.post('/api/agent/alerts/:portCode/evaluate', async (req, res) => {
  try {
    const portCode = req.params.portCode;
    const fired = await evaluateAlerts(portCode);
    // Fan out to subscribed agents via Telegram
    if (fired.length > 0) {
      const subscribers = getAgentsForPort(portCode);
      for (const agent of subscribers) {
        for (const alert of fired) {
          await sendTelegramAlert(agent,
            `🚢 *Mari8X Alert — ${portCode.toUpperCase()}*\n*${alert.type}*: ${alert.message}\nSeverity: ${alert.severity ?? 'info'}`
          );
        }
      }
    }
    res.json({ portCode: portCode.toUpperCase(), newAlerts: fired.length, alerts: fired });
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

// ── Agent Onboarding & Auth ───────────────────────────────────────────────────

/** GET /onboard — self-contained onboarding wizard */
app.get('/onboard', (_req, res) => {
  res.type('text/html').send(buildOnboardingHtml());
});

/** POST /api/auth/register */
app.post('/api/auth/register', express.json(), (req, res) => {
  try {
    const { email, name, company, password } = req.body as any;
    if (!email || !name || !company || !password) {
      return res.status(400).json({ error: 'email, name, company, password are required' });
    }
    const result = registerAgent({ email, name, company, password });
    if (!result.ok) return res.status(409).json({ error: result.error });
    res.status(201).json(result.agent);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /api/auth/login */
app.post('/api/auth/login', express.json(), (req, res) => {
  try {
    const { email, password } = req.body as any;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const result = loginAgent(email, password);
    if (!result.ok) return res.status(401).json({ error: result.error });
    res.json({ apiKey: result.apiKey, agent: result.agent });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** GET /api/agents/me — profile for authenticated agent */
app.get('/api/agents/me', (req, res) => {
  try {
    const apiKey = req.headers['x-mari8x-agent-key'] as string;
    if (!apiKey) return res.status(401).json({ error: 'X-Mari8x-Agent-Key header required' });
    const agent = getAgentProfile(apiKey);
    if (!agent) return res.status(401).json({ error: 'Invalid API key' });
    res.json(agent);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** PUT /api/agents/me/ports — update subscribed UNLOCODE list */
app.put('/api/agents/me/ports', express.json(), (req, res) => {
  try {
    const apiKey = req.headers['x-mari8x-agent-key'] as string;
    if (!apiKey) return res.status(401).json({ error: 'X-Mari8x-Agent-Key header required' });
    const { ports } = req.body as any;
    if (!Array.isArray(ports)) return res.status(400).json({ error: 'ports must be an array' });
    const result = updateAgentPorts(apiKey, ports);
    if (!result.ok) return res.status(401).json({ error: result.error });
    res.json({ ok: true, ports: result.ports });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** PUT /api/agents/me/telegram — update Telegram config */
app.put('/api/agents/me/telegram', express.json(), (req, res) => {
  try {
    const apiKey = req.headers['x-mari8x-agent-key'] as string;
    if (!apiKey) return res.status(401).json({ error: 'X-Mari8x-Agent-Key header required' });
    const { botToken, chatId, enabled } = req.body as any;
    const result = updateAgentTelegram(apiKey, { botToken, chatId, enabled });
    if (!result.ok) return res.status(401).json({ error: result.error });
    res.json({ ok: true, telegram: result.telegram });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** POST /api/agents/me/telegram/test — send a test message */
app.post('/api/agents/me/telegram/test', async (req, res) => {
  try {
    const apiKey = req.headers['x-mari8x-agent-key'] as string;
    if (!apiKey) return res.status(401).json({ error: 'X-Mari8x-Agent-Key header required' });
    const agent = getAgentByKey(apiKey);
    if (!agent) return res.status(401).json({ error: 'Invalid API key' });
    const sent = await sendTelegramAlert(agent,
      `✅ *Mari8X Test Alert*\nYour Telegram notifications are configured correctly.\nAgent: ${agent.name} (${agent.company})`
    );
    if (!sent) {
      return res.status(400).json({ ok: false, error: 'Failed to send — check botToken, chatId, and that enabled=true' });
    }
    res.json({ ok: true, message: 'Test alert sent successfully' });
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
    await getTopCongestedPorts(20); // warms cache

    // Evaluate alerts for every port that has at least one subscribed agent
    const allAgents = listAgents();
    const watchedPorts = new Set<string>();
    for (const a of allAgents) {
      for (const p of a.ports) watchedPorts.add(p);
    }
    for (const portCode of watchedPorts) {
      try {
        const fired = await evaluateAlerts(portCode);
        if (fired.length === 0) continue;
        const subscribers = getAgentsForPort(portCode);
        for (const agent of subscribers) {
          for (const alert of fired) {
            await sendTelegramAlert(agent,
              `🚢 *Mari8X Alert — ${portCode}*\n*${alert.type}*: ${alert.message}\nSeverity: ${alert.severity ?? 'info'}`
            );
          }
        }
      } catch { /* skip individual port failures */ }
    }
  } catch { /* non-fatal */ }
}, 15 * 60_000);

// ── ETA REST API ──────────────────────────────────────────────────────────────

/**
 * POST /api/eta
 * Upsert an ETA record for a voyage.
 * Body: { voyageId, vesselName, vesselIMO?, portCode, portName?, eta, source?, remarks? }
 */
app.post('/api/eta', express.json(), (req, res) => {
  try {
    const { voyageId, vesselName, vesselIMO, portCode, portName, eta, source, remarks } = req.body as any;
    if (!voyageId || !vesselName || !portCode || !eta) {
      return res.status(400).json({ error: 'voyageId, vesselName, portCode and eta are required' });
    }
    const record = upsertETA({ voyageId, vesselName, vesselIMO, portCode, portName, eta, source, remarks });
    res.json(record);
  } catch (e) { res.status(400).json({ error: (e as Error).message }); }
});

/**
 * GET /api/eta/dashboard — summary counts by port
 */
app.get('/api/eta/dashboard', (_req, res) => {
  res.json(getETADashboard());
});

/**
 * GET /api/eta/all — all ETA records
 */
app.get('/api/eta/all', (_req, res) => {
  res.json(listAllETAs());
});

/**
 * GET /api/eta/port/:portCode — all vessels expected at a port
 */
app.get('/api/eta/port/:portCode', (req, res) => {
  const records = listETAsByPort(req.params.portCode);
  res.json({ portCode: req.params.portCode.toUpperCase(), count: records.length, records });
});

/**
 * GET /api/eta/:voyageId — single ETA record with history
 */
app.get('/api/eta/:voyageId', (req, res) => {
  const record = getETA(req.params.voyageId);
  if (!record) return res.status(404).json({ error: `Voyage "${req.params.voyageId}" not found` });
  res.json(record);
});

/**
 * PATCH /api/eta/:voyageId/arrived — mark voyage as arrived
 */
app.patch('/api/eta/:voyageId/arrived', express.json(), (req, res) => {
  const record = markArrived(req.params.voyageId, (req.body as any)?.remarks);
  if (!record) return res.status(404).json({ error: `Voyage "${req.params.voyageId}" not found` });
  res.json(record);
});

// Start server
const httpServer = app.listen(PORT, () => {
  console.log(`🚢 Mari8X Community Edition`);
  console.log(`📡 GraphQL API: http://localhost:${PORT}/graphql`);
  console.log(`🌊 Congestion:  http://localhost:${PORT}/api/congestion`);
  console.log(`📄 B/L Module:  http://localhost:${PORT}/api/bl`);
  console.log(`📑 B/L PDF:     http://localhost:${PORT}/api/bl/:blNumber/pdf`);
  console.log(`🧑‍✈️ Onboarding:  http://localhost:${PORT}/onboard`);
  console.log(`📍 ETA Tracker: http://localhost:${PORT}/api/eta`);
  console.log(`❤️  Health:      http://localhost:${PORT}/health`);
  // Warm congestion cache on startup
  setTimeout(() => getTopCongestedPorts(20).catch(() => {}), 3000);
});

// ── WebSocket: ETA push ───────────────────────────────────────────────────────
// ws://host:PORT/ws/eta   — subscribe to ETA_NEW | ETA_UPDATE | ETA_ARRIVED events
const wss = new WebSocketServer({ server: httpServer, path: '/ws/eta' });

// Wire ETA broadcast callback
setEtaBroadcast((event: string, record: EtaRecord) => {
  const msg = JSON.stringify({ event, record });
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) client.send(msg);
  }
});

wss.on('connection', (ws) => {
  // Send current ETA snapshot on connect
  ws.send(JSON.stringify({ event: 'ETA_SNAPSHOT', records: listAllETAs() }));
});
