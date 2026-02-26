/**
 * Mari8X Arrival Alert Engine
 *
 * Evaluates vessel arrival conditions against configurable rules and fires
 * notifications via webhook or Telegram.
 *
 * Alert types:
 *   ETA_IMMINENT   — vessel ETA < etaThresholdHours (default 6h)
 *   DG_INBOUND     — inbound vessel has dangerous goods in active checklist
 *   DOC_OVERDUE    — any doc in voyage checklist is overdue
 *   HIGH_CONGESTION — port congestion level ≥ 'high'
 *
 * Severity:
 *   INFO, WARNING, CRITICAL
 *
 * Persistence: JSONL per port at /root/.ankr/state/mari8x-alerts/<portCode>.jsonl
 * Config:       /root/.ankr/config/mari8x-alert-rules.json
 * Notify:       /root/.ankr/config/hitl-notify.json (shared with COMPASS Watchdog)
 *
 * © 2026 ANKR Labs — Proprietary
 */

import * as fs   from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getPreArrivalVessels }     from './pre-arrival.js';
import { listOpenChecklists }       from './documents.js';
import { getPortCongestion }        from '../congestion/engine.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertType     = 'ETA_IMMINENT' | 'DG_INBOUND' | 'DOC_OVERDUE' | 'HIGH_CONGESTION';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface ArrivalAlert {
  id:           string;
  ts:           string;
  portCode:     string;
  type:         AlertType;
  severity:     AlertSeverity;
  imo:          string;
  vesselName:   string;
  message:      string;
  acknowledged: boolean;
}

interface AlertRules {
  etaThresholdHours: number;      // fire ETA_IMMINENT when ETA < this
  congestionLevels:  string[];    // levels that trigger HIGH_CONGESTION alert
  disabledTypes:     AlertType[]; // alert types to suppress
}

interface NotifyCfg {
  email?:    { enabled: boolean; mailerUrl: string; to: string[] };
  telegram?: { enabled: boolean; webhookUrl: string };
  webhook?:  { enabled: boolean; url: string };     // Mari8X-specific webhook
}

// ── Config paths ──────────────────────────────────────────────────────────────

const ALERTS_DIR   = '/root/.ankr/state/mari8x-alerts';
const RULES_FILE   = '/root/.ankr/config/mari8x-alert-rules.json';
const NOTIFY_FILE  = '/root/.ankr/config/hitl-notify.json';
const DEDUP_WINDOW = 60 * 60_000; // 1-hour dedup window (per port+type+imo)

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(ALERTS_DIR)) fs.mkdirSync(ALERTS_DIR, { recursive: true });
}

function alertsFile(portCode: string): string {
  return path.join(ALERTS_DIR, `${portCode.toUpperCase()}.jsonl`);
}

function loadRules(): AlertRules {
  try {
    if (fs.existsSync(RULES_FILE)) return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
  } catch { /* use defaults */ }
  return {
    etaThresholdHours: 6,
    congestionLevels:  ['high', 'critical'],
    disabledTypes:     [],
  };
}

function loadNotify(): NotifyCfg {
  try {
    if (fs.existsSync(NOTIFY_FILE)) return JSON.parse(fs.readFileSync(NOTIFY_FILE, 'utf-8'));
  } catch { /* ignore */ }
  return {};
}

/** Append an alert to the port JSONL store */
function persistAlert(alert: ArrivalAlert): void {
  ensureDir();
  fs.appendFileSync(alertsFile(alert.portCode), JSON.stringify(alert) + '\n', 'utf-8');
}

/** Load all alerts for a port (last 500 lines) */
function loadAlerts(portCode: string): ArrivalAlert[] {
  const file = alertsFile(portCode.toUpperCase());
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  // Cap at last 500 entries
  const tail = lines.slice(-500);
  return tail.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as ArrivalAlert[];
}

/** Check recent alerts to avoid duplicate firing within DEDUP_WINDOW */
function isDuplicate(existing: ArrivalAlert[], type: AlertType, imo: string): boolean {
  const now = Date.now();
  return existing.some(a =>
    a.type === type &&
    a.imo  === imo  &&
    !a.acknowledged &&
    now - new Date(a.ts).getTime() < DEDUP_WINDOW
  );
}

// ── Notification delivery ─────────────────────────────────────────────────────

function deliverAlert(alert: ArrivalAlert): void {
  const cfg = loadNotify();

  // Telegram
  const tg = cfg.telegram;
  if (tg?.enabled && tg.webhookUrl) {
    const sevEmoji = alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '🟠' : '🔵';
    const text = [
      `${sevEmoji} *Mari8X Alert — ${alert.type}*`,
      `Port: *${alert.portCode}* | Vessel: *${alert.vesselName}* (${alert.imo})`,
      alert.message,
      `_${alert.ts}_`,
    ].join('\n');
    fetch(tg.webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, parse_mode: 'Markdown' }),
      signal:  AbortSignal.timeout(5000),
    }).catch(() => { /* non-fatal */ });
  }

  // Email (ankr-mailer)
  const em = cfg.email;
  if (em?.enabled && em.mailerUrl && em.to?.length) {
    const subject = `[Mari8X] ${alert.severity} — ${alert.type} — ${alert.portCode}`;
    const html = `<h2>${subject}</h2>
<p><strong>Vessel:</strong> ${alert.vesselName} (IMO: ${alert.imo})</p>
<p><strong>Port:</strong> ${alert.portCode}</p>
<p><strong>Message:</strong> ${alert.message}</p>
<p><strong>Time:</strong> ${alert.ts}</p>
<hr><p><em>Mari8X Community · ANKR Labs</em></p>`;
    fetch(`${em.mailerUrl}/api/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to: em.to, subject, html }),
      signal:  AbortSignal.timeout(5000),
    }).catch(() => { /* non-fatal */ });
  }

  // Custom webhook
  const wh = (cfg as any).webhook;
  if (wh?.enabled && wh.url) {
    fetch(wh.url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(alert),
      signal:  AbortSignal.timeout(5000),
    }).catch(() => { /* non-fatal */ });
  }
}

// ── Alert factory ─────────────────────────────────────────────────────────────

function makeAlert(
  portCode: string,
  type:     AlertType,
  severity: AlertSeverity,
  imo:      string,
  name:     string,
  message:  string,
): ArrivalAlert {
  return {
    id:           uuidv4(),
    ts:           new Date().toISOString(),
    portCode:     portCode.toUpperCase(),
    type, severity, imo,
    vesselName:   name,
    message,
    acknowledged: false,
  };
}

// ── Core evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate all alert rules for a port.
 * Returns the list of NEW alerts fired in this run.
 */
export async function evaluateAlerts(portCode: string): Promise<ArrivalAlert[]> {
  const rules    = loadRules();
  const existing = loadAlerts(portCode);
  const fired:   ArrivalAlert[] = [];

  const [preArrival, congestion] = await Promise.all([
    getPreArrivalVessels(portCode, 48),
    getPortCongestion(portCode),
  ]);

  const openDocs = listOpenChecklists();
  const portUpper = portCode.toUpperCase();

  // ── HIGH_CONGESTION alert ─────────────────────────────────────────────────

  if (
    !rules.disabledTypes.includes('HIGH_CONGESTION') &&
    congestion &&
    rules.congestionLevels.includes(congestion.level)
  ) {
    const imo  = `PORT_${portUpper}`;
    const name = congestion.port?.name ?? portUpper;
    if (!isDuplicate(existing, 'HIGH_CONGESTION', imo)) {
      const sev: AlertSeverity = congestion.level === 'critical' ? 'CRITICAL' : 'WARNING';
      const a = makeAlert(
        portCode, 'HIGH_CONGESTION', sev, imo, name,
        `${name} congestion level ${congestion.level.toUpperCase()} — score ${congestion.congestionScore}, ` +
        `${congestion.anchorageVessels + congestion.approachVessels} vessels, ` +
        `est. wait ${congestion.estimatedWaitHours}h`,
      );
      persistAlert(a);
      deliverAlert(a);
      fired.push(a);
    }
  }

  // ── Per-vessel alerts ─────────────────────────────────────────────────────

  for (const vessel of (preArrival?.vessels ?? [])) {

    // ETA_IMMINENT
    if (
      !rules.disabledTypes.includes('ETA_IMMINENT') &&
      vessel.etaHours <= rules.etaThresholdHours &&
      !isDuplicate(existing, 'ETA_IMMINENT', vessel.imo)
    ) {
      const sev: AlertSeverity = vessel.etaHours <= 2 ? 'CRITICAL' : 'WARNING';
      const a = makeAlert(
        portCode, 'ETA_IMMINENT', sev, vessel.imo, vessel.name,
        `${vessel.name} (${vessel.imo}) ETA ${vessel.etaHours.toFixed(1)}h — ` +
        `${vessel.distanceNm.toFixed(0)}nm at ${vessel.speedKt.toFixed(1)}kt — confidence: ${vessel.confidence}`,
      );
      persistAlert(a);
      deliverAlert(a);
      fired.push(a);
    }

    // DOC_OVERDUE — check matching open checklist
    if (!rules.disabledTypes.includes('DOC_OVERDUE')) {
      const checklist = openDocs.find((c: any) => c.imo === vessel.imo && c.portUnlocode === portUpper);
      if (
        checklist &&
        checklist.summary.overdue > 0 &&
        !isDuplicate(existing, 'DOC_OVERDUE', vessel.imo)
      ) {
        const a = makeAlert(
          portCode, 'DOC_OVERDUE', 'WARNING', vessel.imo, vessel.name,
          `${vessel.name} (${vessel.imo}) has ${checklist.summary.overdue} overdue document(s) ` +
          `— voyage ${checklist.voyageId}, ETA ${vessel.etaHours.toFixed(1)}h`,
        );
        persistAlert(a);
        deliverAlert(a);
        fired.push(a);
      }
    }

    // DG_INBOUND — vessel has DG docs in checklist (proxy: checklist has DG doc submitted)
    if (!rules.disabledTypes.includes('DG_INBOUND')) {
      const checklist = openDocs.find((c: any) => c.imo === vessel.imo && c.portUnlocode === portUpper);
      if (checklist) {
        const dgDoc = checklist.documents?.find((d: any) =>
          d.id === 'dangerous-goods' && d.status === 'submitted',
        );
        if (dgDoc && !isDuplicate(existing, 'DG_INBOUND', vessel.imo)) {
          const a = makeAlert(
            portCode, 'DG_INBOUND', 'WARNING', vessel.imo, vessel.name,
            `${vessel.name} (${vessel.imo}) has dangerous goods declared — DG doc submitted for voyage ${checklist.voyageId}`,
          );
          persistAlert(a);
          deliverAlert(a);
          fired.push(a);
        }
      }
    }
  }

  return fired;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return active (optionally all) alerts for a port */
export function getAlerts(portCode: string, includeAcknowledged = false): ArrivalAlert[] {
  const all = loadAlerts(portCode);
  return includeAcknowledged ? all.reverse() : all.filter(a => !a.acknowledged).reverse();
}

/** Acknowledge an alert by ID */
export function acknowledgeAlert(portCode: string, alertId: string): boolean {
  const file = alertsFile(portCode.toUpperCase());
  if (!fs.existsSync(file)) return false;

  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const a: ArrivalAlert = JSON.parse(l);
      if (a.id === alertId) { found = true; return JSON.stringify({ ...a, acknowledged: true }); }
      return l;
    } catch { return l; }
  });
  if (found) fs.writeFileSync(file, updated.join('\n') + '\n', 'utf-8');
  return found;
}

/** Seed default alert rules if not present */
export function ensureDefaultRules(): void {
  if (!fs.existsSync(RULES_FILE)) {
    fs.mkdirSync(path.dirname(RULES_FILE), { recursive: true });
    fs.writeFileSync(RULES_FILE, JSON.stringify({
      etaThresholdHours: 6,
      congestionLevels:  ['high', 'critical'],
      disabledTypes:     [],
    }, null, 2), 'utf-8');
  }
}
