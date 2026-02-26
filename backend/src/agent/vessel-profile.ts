/**
 * Mari8X Vessel Profile
 *
 * Aggregates all available intelligence for a single vessel (by IMO):
 *   - Latest AIS position
 *   - 24-hour position track (at most 100 points, thinned)
 *   - Nearest port with its name and distance
 *   - Pre-arrival ETA to that port (if heading toward it)
 *   - Congestion level at the destination port
 *   - Open document checklists linked to this IMO
 *   - DA forecast for the destination port
 *
 * All data is assembled in a single async call for the REST layer.
 */

import { prisma } from '../lib/prisma.js';
import { getPortCongestion } from '../congestion/engine.js';
import { forecastDA }        from './da-forecast.js';
import { listOpenChecklists } from './documents.js';

// ── Haversine (copied locally to avoid circular dep) ─────────────────────────

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

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y   = Math.sin(Δλ) * Math.cos(φ2);
  const x   = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackPoint {
  ts:        string;
  lat:       number;
  lng:       number;
  speedKt:   number;
  heading:   number | null;
}

export interface VesselProfile {
  imo:       string;
  name:      string;
  lastSeen:  string;
  position: {
    lat:       number;
    lng:       number;
    speedKt:   number;
    heading:   number | null;
    navStatus: number | null;
  };
  track24h:       TrackPoint[];
  nearestPort: {
    unlocode:   string;
    name:       string;
    distanceNm: number;
    bearing:    number;
    etaHours:   number | null;
    congestion: any | null;
  } | null;
  daForecast: any | null;
  openChecklists: number;
  checklistSummary: { voyageId: string; readyPct: number; overdue: number }[];
  generatedAt: string;
}

// ── Core ─────────────────────────────────────────────────────────────────────

export async function getVesselProfile(imo: string): Promise<VesselProfile | null> {
  // Find vessel
  const vessel = await prisma.vessel.findFirst({ where: { imo } });
  if (!vessel) return null;

  // All positions last 24h
  const since = new Date(Date.now() - 24 * 3600_000);
  const positions = await prisma.vesselPosition.findMany({
    where:   { vesselId: vessel.id, timestamp: { gte: since } },
    orderBy: { timestamp: 'desc' },
    take:    500,
  });

  if (positions.length === 0) return null;

  const latest = positions[0];

  // Build thinned 24h track (max 100 points)
  const step  = Math.max(1, Math.floor(positions.length / 100));
  const track: TrackPoint[] = positions
    .filter((_, i) => i % step === 0)
    .reverse()
    .map(p => ({
      ts:      p.timestamp.toISOString(),
      lat:     p.latitude,
      lng:     p.longitude,
      speedKt: Math.round((p.speed ?? 0) * 10) / 10,
      heading: p.heading ?? null,
    }));

  // Find nearest port
  const ports = await prisma.port.findMany({
    where: { lat: { not: null }, lng: { not: null } },
    take:  300,
  });

  let nearestPort: VesselProfile['nearestPort'] = null;
  let minDist = Infinity;

  for (const port of ports) {
    const dist = haversineNm(latest.latitude, latest.longitude, port.lat!, port.lng!);
    if (dist < minDist) {
      minDist = dist;
      const bearing = bearingDeg(latest.latitude, latest.longitude, port.lat!, port.lng!);
      const speed   = latest.speed ?? 0;
      const etaHours = speed >= 2 ? Math.round((dist / speed) * 10) / 10 : null;
      nearestPort = {
        unlocode:   port.unlocode,
        name:       port.name,
        distanceNm: Math.round(dist * 10) / 10,
        bearing:    Math.round(bearing),
        etaHours,
        congestion: null, // filled below
      };
    }
  }

  // Fetch congestion at nearest port
  let daForecast = null;
  if (nearestPort) {
    try {
      nearestPort.congestion = await getPortCongestion(nearestPort.unlocode);
    } catch { /* non-fatal */ }

    try {
      daForecast = forecastDA(nearestPort.unlocode, { grt: 50000, loaMetres: 250, teuCapacity: 4000 });
    } catch { /* non-fatal */ }
  }

  // Open checklists for this IMO
  const allOpen    = listOpenChecklists();
  const myLists    = allOpen.filter(c => c.imo === imo);
  const checkSummary = myLists.map(c => ({
    voyageId: c.voyageId,
    readyPct: c.summary.readyPct,
    overdue:  c.summary.overdue,
  }));

  return {
    imo,
    name:      vessel.name,
    lastSeen:  latest.timestamp.toISOString(),
    position: {
      lat:       latest.latitude,
      lng:       latest.longitude,
      speedKt:   Math.round((latest.speed ?? 0) * 10) / 10,
      heading:   latest.heading ?? null,
      navStatus: latest.navigationStatus ?? null,
    },
    track24h:         track,
    nearestPort,
    daForecast,
    openChecklists:   myLists.length,
    checklistSummary: checkSummary,
    generatedAt:      new Date().toISOString(),
  };
}
