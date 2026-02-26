/**
 * Port Call Management
 *
 * Tracks the full port call lifecycle for a vessel visit:
 *   NOA_RECEIVED → BERTHING_REQUESTED → BERTHED → CARGO_OPS → DEPARTURE_CLEARED → DEPARTED
 *
 * Key concepts:
 *   - Each port call is keyed by a unique portCallId (voyageId + portCode)
 *   - Stage transitions are timestamped and immutable (append-only log)
 *   - DA (Disbursement Account) estimates attached per call
 *   - Broadcast hook for WebSocket push (reuses /ws/eta channel)
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import * as fs   from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PortCallStage =
  | 'NOA_RECEIVED'
  | 'BERTHING_REQUESTED'
  | 'BERTHED'
  | 'CARGO_OPS'
  | 'DEPARTURE_CLEARED'
  | 'DEPARTED';

export interface PortCallEvent {
  stage:     PortCallStage;
  timestamp: string;
  notes:     string | null;
  updatedBy: string;
}

export interface DAEstimate {
  portDuesUsd:      number;
  pilotageUsd:      number;
  towageUsd:        number;
  agencyFeeUsd:     number;
  miscUsd:          number;
  totalUsd:         number;
  currency:         string;
  estimatedAt:      string;
}

export interface CartaEnrichment {
  briefDate:       string;       // date of the brief used
  portMentioned:   boolean;      // brief mentions this port code
  vesselMentioned: boolean;      // brief mentions this vessel name
  excerpt:         string | null; // relevant snippet (max 300 chars)
  fetchedAt:       string;
}

export interface PortCallRecord {
  portCallId:       string;         // voyageId_portCode
  voyageId:         string;
  vesselName:       string;
  vesselIMO:        string | null;
  portCode:         string;         // UNLOCODE
  portName:         string | null;
  eta:              string | null;
  ata:              string | null;  // actual time of arrival (set on BERTHED)
  atd:              string | null;  // actual time of departure (set on DEPARTED)
  currentStage:     PortCallStage;
  events:           PortCallEvent[];
  da:               DAEstimate | null;
  cartaEnrichment:  CartaEnrichment | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface PortCallInput {
  voyageId:    string;
  vesselName:  string;
  vesselIMO?:  string | null;
  portCode:    string;
  portName?:   string | null;
  eta?:        string | null;
  notes?:      string | null;
  updatedBy?:  string;
}

export interface PortCallDashboard {
  total:              number;
  byStage:            Record<PortCallStage, number>;
  activePorts:        string[];
  berthUtilizationPct: number;
  recentDepartures:   number;
}

// ── State ─────────────────────────────────────────────────────────────────────

const STATE_FILE = '/root/.ankr/state/mari8x-port-calls/records.json';

function ensureDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAll(): Record<string, PortCallRecord> {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); }
  catch { return {}; }
}

function saveAll(data: Record<string, PortCallRecord>) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

let _broadcastFn: ((event: string, record: PortCallRecord) => void) | null = null;

export function setPortCallBroadcast(fn: (event: string, record: PortCallRecord) => void) {
  _broadcastFn = fn;
}

function broadcast(event: string, record: PortCallRecord) {
  if (_broadcastFn) _broadcastFn(event, record);
}

// ── CARTA Enrichment ──────────────────────────────────────────────────────────

const CARTA_URL = process.env.CARTA_URL ?? 'http://localhost:4055';

async function enrichFromCarta(portCallId: string, vesselName: string, portCode: string): Promise<void> {
  try {
    const res = await fetch(`${CARTA_URL}/api/brief/latest`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return;
    const data = await res.json() as { file?: string; content?: string; error?: string };
    if (!data.content) return;

    const content     = data.content;
    const lc          = content.toLowerCase();
    const portLower   = portCode.toLowerCase();
    const vesselLower = vesselName.toLowerCase();

    const portMentioned   = lc.includes(portLower);
    const vesselMentioned = lc.includes(vesselLower);

    // Extract a short relevant excerpt
    let excerpt: string | null = null;
    const needle = portMentioned ? portLower : vesselMentioned ? vesselLower : null;
    if (needle) {
      const idx = lc.indexOf(needle);
      const start = Math.max(0, idx - 60);
      const end   = Math.min(content.length, idx + 240);
      excerpt = content.slice(start, end).replace(/\n+/g, ' ').trim();
    }

    const enrichment: CartaEnrichment = {
      briefDate:       data.file?.replace('carta-brief-', '').replace('.md', '') ?? 'unknown',
      portMentioned,
      vesselMentioned,
      excerpt,
      fetchedAt:       new Date().toISOString(),
    };

    // Update the saved record with CARTA context
    const store = loadAll();
    if (store[portCallId]) {
      store[portCallId].cartaEnrichment = enrichment;
      store[portCallId].updatedAt       = new Date().toISOString();
      saveAll(store);
    }
  } catch { /* non-fatal */ }
}

// ── Stage machine ─────────────────────────────────────────────────────────────

const STAGE_ORDER: PortCallStage[] = [
  'NOA_RECEIVED', 'BERTHING_REQUESTED', 'BERTHED',
  'CARGO_OPS', 'DEPARTURE_CLEARED', 'DEPARTED',
];

function nextStage(current: PortCallStage): PortCallStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Create or open a port call (stage = NOA_RECEIVED).
 */
export function openPortCall(input: PortCallInput): PortCallRecord {
  const data = loadAll();
  const portCallId = `${input.voyageId}_${input.portCode.toUpperCase()}`;
  const now = new Date().toISOString();

  if (data[portCallId]) {
    throw new Error(`Port call "${portCallId}" already exists. Use advancePortCall() to progress.`);
  }

  const record: PortCallRecord = {
    portCallId,
    voyageId:     input.voyageId,
    vesselName:   input.vesselName,
    vesselIMO:    input.vesselIMO ?? null,
    portCode:     input.portCode.toUpperCase(),
    portName:     input.portName ?? null,
    eta:          input.eta ?? null,
    ata:          null,
    atd:          null,
    currentStage: 'NOA_RECEIVED',
    events: [{
      stage:     'NOA_RECEIVED',
      timestamp: now,
      notes:     input.notes ?? null,
      updatedBy: input.updatedBy ?? 'system',
    }],
    da:               null,
    cartaEnrichment:  null,
    createdAt: now,
    updatedAt: now,
  };

  data[portCallId] = record;
  saveAll(data);
  broadcast('PORT_CALL_OPENED', record);

  // Enrich with CARTA maritime intelligence in background
  enrichFromCarta(portCallId, input.vesselName, input.portCode).catch(() => {});

  return record;
}

/**
 * Advance a port call to the next stage.
 */
export function advancePortCall(
  portCallId: string,
  options: { notes?: string | null; updatedBy?: string } = {}
): PortCallRecord {
  const data = loadAll();
  const record = data[portCallId];
  if (!record) throw new Error(`Port call "${portCallId}" not found`);
  if (record.currentStage === 'DEPARTED') {
    throw new Error(`Port call "${portCallId}" already DEPARTED — no further stages`);
  }

  const next = nextStage(record.currentStage);
  if (!next) throw new Error('No next stage available');

  const now = new Date().toISOString();

  record.events.push({
    stage:     next,
    timestamp: now,
    notes:     options.notes ?? null,
    updatedBy: options.updatedBy ?? 'system',
  });

  record.currentStage = next;
  record.updatedAt    = now;

  // Auto-set ATA when BERTHED, ATD when DEPARTED
  if (next === 'BERTHED' && !record.ata)     record.ata = now;
  if (next === 'DEPARTED' && !record.atd)    record.atd = now;

  data[portCallId] = record;
  saveAll(data);
  broadcast('PORT_CALL_ADVANCED', record);
  return record;
}

/**
 * Move to a specific stage (skip or re-set).
 */
export function setPortCallStage(
  portCallId: string,
  stage: PortCallStage,
  options: { notes?: string | null; updatedBy?: string } = {}
): PortCallRecord {
  const data   = loadAll();
  const record = data[portCallId];
  if (!record) throw new Error(`Port call "${portCallId}" not found`);

  const now = new Date().toISOString();
  record.events.push({
    stage,
    timestamp: now,
    notes:     options.notes ?? null,
    updatedBy: options.updatedBy ?? 'system',
  });
  record.currentStage = stage;
  record.updatedAt    = now;

  if (stage === 'BERTHED' && !record.ata)   record.ata = now;
  if (stage === 'DEPARTED' && !record.atd)  record.atd = now;

  data[portCallId] = record;
  saveAll(data);
  broadcast('PORT_CALL_STAGE_SET', record);
  return record;
}

/**
 * Attach or update a DA estimate.
 */
export function setDAEstimate(portCallId: string, da: Omit<DAEstimate, 'estimatedAt'>): PortCallRecord {
  const data   = loadAll();
  const record = data[portCallId];
  if (!record) throw new Error(`Port call "${portCallId}" not found`);

  const daFull: DAEstimate = {
    ...da,
    estimatedAt: new Date().toISOString(),
  };

  record.da        = daFull;
  record.updatedAt = new Date().toISOString();
  data[portCallId] = record;
  saveAll(data);
  return record;
}

/**
 * Get a single port call by ID.
 */
export function getPortCall(portCallId: string): PortCallRecord | null {
  return loadAll()[portCallId] ?? null;
}

/**
 * Find port calls for a given voyage (may be multiple ports).
 */
export function getPortCallsByVoyage(voyageId: string): PortCallRecord[] {
  return Object.values(loadAll()).filter(r => r.voyageId === voyageId);
}

/**
 * List port calls for a port, optionally filtering by active only.
 */
export function listPortCallsByPort(portCode: string, activeOnly = false): PortCallRecord[] {
  const upper = portCode.toUpperCase();
  const all   = Object.values(loadAll()).filter(r => r.portCode === upper);
  if (activeOnly) return all.filter(r => r.currentStage !== 'DEPARTED');
  return all;
}

/**
 * All port calls (active or all).
 */
export function listAllPortCalls(activeOnly = false): PortCallRecord[] {
  const all = Object.values(loadAll());
  if (activeOnly) return all.filter(r => r.currentStage !== 'DEPARTED');
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Dashboard summary.
 */
export function getPortCallDashboard(): PortCallDashboard {
  const all = Object.values(loadAll());
  const byStage: Record<PortCallStage, number> = {
    NOA_RECEIVED: 0, BERTHING_REQUESTED: 0, BERTHED: 0,
    CARGO_OPS: 0, DEPARTURE_CLEARED: 0, DEPARTED: 0,
  };
  const activePorts = new Set<string>();
  for (const r of all) {
    byStage[r.currentStage]++;
    if (r.currentStage !== 'DEPARTED') activePorts.add(r.portCode);
  }

  const active   = all.filter(r => r.currentStage !== 'DEPARTED').length;
  const berthed  = byStage['BERTHED'] + byStage['CARGO_OPS'] + byStage['DEPARTURE_CLEARED'];
  const recentDepartures = all.filter(r => {
    if (r.currentStage !== 'DEPARTED' || !r.atd) return false;
    return Date.now() - new Date(r.atd).getTime() < 24 * 3600_000;
  }).length;

  return {
    total:               all.length,
    byStage,
    activePorts:         [...activePorts],
    berthUtilizationPct: active > 0 ? Math.round((berthed / active) * 100) : 0,
    recentDepartures,
  };
}
