/**
 * Mari8X Port Congestion Engine
 *
 * Classifies vessels near a port as anchorage / approach / transit,
 * computes a congestion score and estimated wait time + detention cost.
 *
 * Scores:
 *   anchorage vessel (≤8nm, speed ≤2kt or AIS navStatus AT_ANCHOR/MOORED): ×15
 *   approach vessel  (≤20nm, speed ≤5kt):                                   ×5
 *   transit vessel   (within 25nm, speed >5kt):                             ×1 (not in score)
 *
 * Level:  low 0–9 | moderate 10–24 | high 25–49 | critical 50+
 */

import { prisma } from '../lib/prisma.js';
import * as fs   from 'fs';
import * as path from 'path';

// ── Haversine ────────────────────────────────────────────────────────────────

/** Returns distance in nautical miles between two lat/lng points. */
function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 3440.065; // Earth radius in NM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// AIS Navigation Status codes for stopped vessels
const STOPPED_NAV_STATUS = new Set([1, 5, 6]); // 1=AT_ANCHOR 5=MOORED 6=AGROUND

// ── Types ────────────────────────────────────────────────────────────────────

export interface VesselSighting {
  imo:       string;
  name:      string;
  distanceNm: number;
  speedKt:   number;
  heading:   number | null;
  navStatus: number | null;
  zone:      'anchorage' | 'approach' | 'transit';
}

export interface CongestionData {
  port: {
    unlocode: string;
    name:     string;
    country:  string;
    lat:      number;
    lng:      number;
  };
  anchorageVessels:   number;
  approachVessels:    number;
  transitVessels:     number;
  congestionScore:    number;
  level:              'low' | 'moderate' | 'high' | 'critical';
  estimatedWaitHours: number;
  detentionCostUsd:   number;
  vessels:            VesselSighting[];
  dataWindowHours:    number;
  updatedAt:          string;
}

// ── Cache (1-minute TTL) ──────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { data: CongestionData; ts: number }>();

// ── Alert log ────────────────────────────────────────────────────────────────

const ALERT_LOG = '/root/.ankr/logs/congestion-alerts.jsonl';
const ALERT_CFG = '/root/.ankr/config/congestion-alerts.json';

function logAlert(port: string, level: string, score: number): void {
  try {
    const entry = JSON.stringify({ ts: new Date().toISOString(), port, level, score });
    const dir = path.dirname(ALERT_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(ALERT_LOG, entry + '\n', 'utf-8');
  } catch { /* non-fatal */ }
}

function fireWebhook(data: CongestionData): void {
  try {
    if (!fs.existsSync(ALERT_CFG)) return;
    const cfg = JSON.parse(fs.readFileSync(ALERT_CFG, 'utf-8'));
    if (!cfg.telegram?.enabled || !cfg.telegram?.webhookUrl) return;

    const text = [
      `🚢 *Port Congestion Alert*`,
      `Port: *${data.port.name}* (${data.port.unlocode})`,
      `Level: *${data.level.toUpperCase()}* — Score ${data.congestionScore}`,
      `Vessels at anchor: ${data.anchorageVessels} | Approaching: ${data.approachVessels}`,
      `Est. wait: ${data.estimatedWaitHours}h | Detention exposure: $${data.detentionCostUsd.toLocaleString()}`,
    ].join('\n');

    fetch(cfg.telegram.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => { /* non-fatal */ });
  } catch { /* non-fatal */ }
}

// ── Core computation ──────────────────────────────────────────────────────────

export async function getPortCongestion(unlocode: string): Promise<CongestionData | null> {
  const upper = unlocode.toUpperCase();

  const cached = cache.get(upper);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const port = await prisma.port.findUnique({ where: { unlocode: upper } });
  if (!port || port.lat == null || port.lng == null) return null;

  // Fetch positions from the last 6 hours
  const since = new Date(Date.now() - 6 * 3600_000);
  const rawPositions = await prisma.vesselPosition.findMany({
    where:   { timestamp: { gte: since } },
    orderBy: { timestamp: 'desc' },
    include: { vessel: { select: { imo: true, name: true } } },
    take:    5000,
  });

  // Deduplicate — keep only the most recent position per vessel
  const seen = new Set<string>();
  const positions = rawPositions.filter(p => {
    if (seen.has(p.vesselId)) return false;
    seen.add(p.vesselId);
    return true;
  });

  // Classify each vessel
  let anchorage = 0, approach = 0, transit = 0;
  const sightings: VesselSighting[] = [];

  for (const p of positions) {
    const dist  = haversineNm(port.lat!, port.lng!, p.latitude, p.longitude);
    if (dist > 25) continue;

    const speed     = p.speed ?? 0;
    const navStatus = p.navigationStatus ?? -1;
    let zone: VesselSighting['zone'];

    if (dist <= 8 && (speed <= 2 || STOPPED_NAV_STATUS.has(navStatus))) {
      zone = 'anchorage';
      anchorage++;
    } else if (dist <= 20 && speed <= 5) {
      zone = 'approach';
      approach++;
    } else {
      zone = 'transit';
      transit++;
    }

    sightings.push({
      imo:       p.vessel.imo,
      name:      p.vessel.name,
      distanceNm: Math.round(dist * 10) / 10,
      speedKt:   Math.round(speed * 10) / 10,
      heading:   p.heading ?? null,
      navStatus: p.navigationStatus ?? null,
      zone,
    });
  }

  sightings.sort((a, b) => a.distanceNm - b.distanceNm);

  const score = anchorage * 15 + approach * 5;
  const level: CongestionData['level'] =
    score >= 50 ? 'critical' :
    score >= 25 ? 'high'     :
    score >= 10 ? 'moderate' : 'low';

  // Rough estimates: 6h/vessel at anchor, 2h/vessel approaching, $12,000/day = $500/hr
  const waitHours    = anchorage * 6 + approach * 2;
  const detentionUsd = Math.round(waitHours * 500);

  const data: CongestionData = {
    port:               { unlocode: port.unlocode, name: port.name, country: port.country, lat: port.lat!, lng: port.lng! },
    anchorageVessels:   anchorage,
    approachVessels:    approach,
    transitVessels:     transit,
    congestionScore:    score,
    level,
    estimatedWaitHours: waitHours,
    detentionCostUsd:   detentionUsd,
    vessels:            sightings.slice(0, 25),
    dataWindowHours:    6,
    updatedAt:          new Date().toISOString(),
  };

  cache.set(upper, { data, ts: Date.now() });

  // Alert if high/critical
  if (level === 'high' || level === 'critical') {
    logAlert(port.unlocode, level, score);
    fireWebhook(data);
  }

  return data;
}

/** Return the N most congested ports (score > 0). */
export async function getTopCongestedPorts(limit = 10): Promise<CongestionData[]> {
  const ports = await prisma.port.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    take: 200,
  });

  const results: CongestionData[] = [];
  for (const port of ports) {
    const data = await getPortCongestion(port.unlocode);
    if (data && data.congestionScore > 0) results.push(data);
  }

  return results
    .sort((a, b) => b.congestionScore - a.congestionScore)
    .slice(0, limit);
}

/** Return summary for all ports with lat/lng. Scores 0 included. */
export async function getAllPortsCongestion(): Promise<CongestionData[]> {
  const ports = await prisma.port.findMany({
    where: { lat: { not: null }, lng: { not: null } },
  });
  const results = await Promise.all(ports.map(p => getPortCongestion(p.unlocode)));
  return (results.filter(Boolean) as CongestionData[])
    .sort((a, b) => b.congestionScore - a.congestionScore);
}
