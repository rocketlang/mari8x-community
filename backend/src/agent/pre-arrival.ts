/**
 * Mari8X Pre-Arrival Intelligence
 *
 * Identifies vessels likely to arrive at a given port within a configurable
 * time window (default: 48 h) using their most-recent AIS position + heading.
 *
 * Algorithm:
 *   1. Load the latest position of every vessel within 200 nm of the port.
 *   2. Compute bearing from vessel to port and compare with reported heading.
 *      A vessel is "inbound" if |bearingDiff| ≤ 45° and speed ≥ 3 kt.
 *   3. Estimate ETA = distance (nm) / speed (kt) → hours.
 *   4. Return vessels with ETA ≤ windowHours, sorted by ETA asc.
 */

import { prisma } from '../lib/prisma.js';

// ── Haversine ────────────────────────────────────────────────────────────────

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing in degrees (0–360) from point A to point B */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y   = Math.sin(Δλ) * Math.cos(φ2);
  const x   = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function headingDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PreArrivalVessel {
  imo:          string;
  name:         string;
  distanceNm:   number;
  speedKt:      number;
  heading:      number | null;
  bearingToPort: number;
  etaHours:     number;
  etaAt:        string;     // ISO timestamp
  confidence:   'high' | 'medium' | 'low';
  lastSeen:     string;     // ISO timestamp of AIS fix
}

export interface PreArrivalReport {
  port: {
    unlocode: string;
    name:     string;
    lat:      number;
    lng:      number;
  };
  windowHours:    number;
  inboundVessels: number;
  vessels:        PreArrivalVessel[];
  generatedAt:    string;
}

// ── Core ─────────────────────────────────────────────────────────────────────

const SEARCH_RADIUS_NM  = 200;  // scan up to 200 nm
const MIN_SPEED_KT      = 3;    // ignore anchored/drifting vessels
const MAX_HEADING_DIFF  = 45;   // ±45° tolerance for "inbound" classification

export async function getPreArrivalVessels(
  unlocode:    string,
  windowHours = 48,
): Promise<PreArrivalReport | null> {
  const upper = unlocode.toUpperCase();
  const port  = await prisma.port.findUnique({ where: { unlocode: upper } });
  if (!port || port.lat == null || port.lng == null) return null;

  // Last 12 h of AIS data
  const since = new Date(Date.now() - 12 * 3600_000);
  const rawPositions = await prisma.vesselPosition.findMany({
    where:   { timestamp: { gte: since } },
    orderBy: { timestamp: 'desc' },
    include: { vessel: { select: { imo: true, name: true } } },
    take:    8000,
  });

  // Deduplicate — most recent position per vessel
  const seen      = new Set<string>();
  const positions = rawPositions.filter(p => {
    if (seen.has(p.vesselId)) return false;
    seen.add(p.vesselId);
    return true;
  });

  const vessels: PreArrivalVessel[] = [];

  for (const p of positions) {
    const dist = haversineNm(port.lat!, port.lng!, p.latitude, p.longitude);
    if (dist > SEARCH_RADIUS_NM) continue;

    const speed   = p.speed ?? 0;
    if (speed < MIN_SPEED_KT) continue;

    const bearing = bearingDeg(p.latitude, p.longitude, port.lat!, port.lng!);
    const hdg     = p.heading ?? null;

    // Only include if heading roughly toward port
    let inbound = true;
    if (hdg != null) {
      inbound = headingDiff(hdg, bearing) <= MAX_HEADING_DIFF;
    }
    if (!inbound) continue;

    const etaHours = dist / speed;
    if (etaHours > windowHours) continue;

    const etaAt = new Date(Date.now() + etaHours * 3600_000).toISOString();

    // Confidence: high if heading within 15°, medium within 30°, low otherwise
    let confidence: PreArrivalVessel['confidence'] = 'low';
    if (hdg != null) {
      const diff = headingDiff(hdg, bearing);
      confidence = diff <= 15 ? 'high' : diff <= 30 ? 'medium' : 'low';
    } else {
      confidence = 'medium'; // no heading reported
    }

    vessels.push({
      imo:           p.vessel.imo,
      name:          p.vessel.name,
      distanceNm:    Math.round(dist * 10) / 10,
      speedKt:       Math.round(speed * 10) / 10,
      heading:       hdg,
      bearingToPort: Math.round(bearing),
      etaHours:      Math.round(etaHours * 10) / 10,
      etaAt,
      confidence,
      lastSeen:      p.timestamp.toISOString(),
    });
  }

  vessels.sort((a, b) => a.etaHours - b.etaHours);

  return {
    port:           { unlocode: port.unlocode, name: port.name, lat: port.lat!, lng: port.lng! },
    windowHours,
    inboundVessels: vessels.length,
    vessels,
    generatedAt:    new Date().toISOString(),
  };
}
