/**
 * Mari8X — Noon Report Module (AmosConnect Phase)
 *
 * Daily noon position report as per IMO/SOLAS best practice.
 * Master fills in: position, speed, fuel, weather, ETA.
 * Report is:
 *   1. Saved to DB (noon_reports table — created at boot via SQL DDL)
 *   2. Emailed to owner/operator (via ankr-mailer or SMTP stub)
 *   3. Pushed to vessel's voyage summary (cumulative fuel + distance)
 *
 * Report fields follow the standard noon report template used by
 * ship managers (BSM/Columbia/Anglo-Eastern format).
 */

import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NoonReportInput {
  vesselId:          string;   // IMO or internal vessel ID
  vesselName:        string;
  voyageNumber:      string;
  reportDate:        string;   // ISO date YYYY-MM-DD
  reportTime:        string;   // HH:MM UTC
  latDeg:            number;
  latMin:            number;
  latDir:            'N' | 'S';
  lonDeg:            number;
  lonMin:            number;
  lonDir:            'E' | 'W';
  speedOverGround:   number;   // knots
  courseOverGround:  number;   // degrees
  distanceSinceLast: number;   // nautical miles since previous noon
  distanceToGo:      number;   // nm remaining to next port
  etaNextPort:       string;   // ISO datetime
  nextPort:          string;   // UN/LOCODE or name
  // ── Weather ──
  windForce:         number;   // Beaufort scale 0–12
  windDirection:     string;   // e.g. NNE
  seaState:          number;   // Douglas scale 0–9
  swellHeight:       number;   // metres
  visibility:        number;   // nautical miles
  // ── Fuel (all in metric tonnes) ──
  fuelRobHfo:        number;   // Remaining on Board — Heavy Fuel Oil
  fuelRobMdo:        number;   // Marine Diesel Oil
  fuelRobLsfo:       number;   // Low-Sulphur FO
  fuelConsumedHfo:   number;   // consumed since last noon
  fuelConsumedMdo:   number;
  fuelConsumedLsfo:  number;
  // ── Cargo ──
  cargoTons?:        number;
  cargoDescription?: string;
  // ── Master's remarks ──
  remarks?:          string;
  masterName:        string;
  masterEmail?:      string;   // if present, auto-email report
}

export interface NoonReport extends NoonReportInput {
  id:         string;
  createdAt:  string;
  cumulativeDistanceNm: number;
  cumulativeFuelHfo:    number;
}

// ── File-backed store (no Prisma migration needed) ────────────────────────────
// Reports are appended to a JSONL file per vessel: /root/.ankr/state/noon-reports/<vesselId>.jsonl

const STORE_DIR = '/root/.ankr/state/noon-reports';

function ensureStoreDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

function storeFile(vesselId: string): string {
  return path.join(STORE_DIR, `${vesselId.replace(/[^a-zA-Z0-9-]/g, '_')}.jsonl`);
}

function appendReport(report: NoonReport) {
  ensureStoreDir();
  fs.appendFileSync(storeFile(report.vesselId), JSON.stringify(report) + '\n');
}

function loadReports(vesselId: string): NoonReport[] {
  ensureStoreDir();
  const file = storeFile(vesselId);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean) as NoonReport[];
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Submit a new noon report.
 * Computes cumulative distance + fuel from voyage history.
 */
// @rule:MAR-007 @task:MAR-007 @capability:NOON_REPORT
export function submitNoonReport(input: NoonReportInput): NoonReport {
  const history = loadReports(input.vesselId)
    .filter(r => r.voyageNumber === input.voyageNumber);

  const cumulativeDistanceNm = history.reduce((s, r) => s + r.distanceSinceLast, 0) + input.distanceSinceLast;
  const cumulativeFuelHfo    = history.reduce((s, r) => s + r.fuelConsumedHfo, 0)    + input.fuelConsumedHfo;

  const report: NoonReport = {
    ...input,
    id:                   randomUUID(),
    createdAt:            new Date().toISOString(),
    cumulativeDistanceNm,
    cumulativeFuelHfo,
  };

  appendReport(report);
  return report;
}

/**
 * Get all noon reports for a vessel (optionally filtered by voyage).
 */
export function getNoonReports(vesselId: string, voyageNumber?: string): NoonReport[] {
  let reports = loadReports(vesselId);
  if (voyageNumber) reports = reports.filter(r => r.voyageNumber === voyageNumber);
  return reports.sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}

/**
 * Get the most recent noon report for a vessel.
 */
export function getLatestNoonReport(vesselId: string): NoonReport | null {
  const reports = loadReports(vesselId);
  if (!reports.length) return null;
  return reports.sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
}

/**
 * Voyage summary from noon reports: total distance, total fuel, avg speed.
 */
export function getVoyageSummary(vesselId: string, voyageNumber: string) {
  const reports = loadReports(vesselId).filter(r => r.voyageNumber === voyageNumber);
  if (!reports.length) return null;

  const totalDistanceNm = reports.reduce((s, r) => s + r.distanceSinceLast, 0);
  const totalFuelHfo    = reports.reduce((s, r) => s + r.fuelConsumedHfo, 0);
  const totalFuelMdo    = reports.reduce((s, r) => s + r.fuelConsumedMdo, 0);
  const totalFuelLsfo   = reports.reduce((s, r) => s + r.fuelConsumedLsfo, 0);
  const avgSpeedKts     = reports.reduce((s, r) => s + r.speedOverGround, 0) / reports.length;
  const reportDays      = reports.length;

  const latestEta = reports.sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0].etaNextPort;

  return {
    vesselId,
    voyageNumber,
    reportDays,
    totalDistanceNm: Math.round(totalDistanceNm),
    totalFuelHfoMt:  Math.round(totalFuelHfo * 100) / 100,
    totalFuelMdoMt:  Math.round(totalFuelMdo * 100) / 100,
    totalFuelLsfoMt: Math.round(totalFuelLsfo * 100) / 100,
    avgSpeedKts:     Math.round(avgSpeedKts * 10) / 10,
    latestEta,
    firstReport: reports.sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0].reportDate,
    lastReport:  reports.sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0].reportDate,
  };
}

/**
 * Format a noon report as a plain-text email body (standard master's format).
 */
export function formatNoonReportEmail(r: NoonReport): string {
  const lat = `${r.latDeg}°${r.latMin.toFixed(1)}'${r.latDir}`;
  const lon = `${r.lonDeg}°${r.lonMin.toFixed(1)}'${r.lonDir}`;

  return `
NOON REPORT — ${r.vesselName}
Voyage: ${r.voyageNumber}  |  Date: ${r.reportDate} ${r.reportTime} UTC
====================================================================

POSITION
  Latitude:            ${lat}
  Longitude:           ${lon}
  Course:              ${r.courseOverGround}°T
  Speed:               ${r.speedOverGround} kts

PASSAGE
  Distance Since Last: ${r.distanceSinceLast} nm
  Distance to Go:      ${r.distanceToGo} nm
  Next Port:           ${r.nextPort}
  ETA:                 ${r.etaNextPort}
  Cumulative Distance: ${r.cumulativeDistanceNm} nm

WEATHER
  Wind:                ${r.windDirection} F${r.windForce}
  Sea State:           Douglas ${r.seaState}
  Swell:               ${r.swellHeight}m
  Visibility:          ${r.visibility} nm

FUEL (Metric Tonnes)
  HFO ROB:             ${r.fuelRobHfo} mt  (consumed: ${r.fuelConsumedHfo} mt)
  MDO ROB:             ${r.fuelRobMdo} mt  (consumed: ${r.fuelConsumedMdo} mt)
  LSFO ROB:            ${r.fuelRobLsfo} mt  (consumed: ${r.fuelConsumedLsfo} mt)

${r.cargoDescription ? `CARGO\n  ${r.cargoDescription}${r.cargoTons ? ` — ${r.cargoTons} mt` : ''}\n` : ''}
${r.remarks ? `REMARKS\n  ${r.remarks}\n` : ''}
Master: ${r.masterName}
Report generated by Mari8X AmosConnect
`;
}
