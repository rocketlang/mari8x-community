/**
 * Mari8X — Crew Welfare Module (AmosConnect Phase)
 *
 * ITF/MLC 2006 compliant crew management:
 *   - Hours of rest tracking (STCW / MLC Regulation 2.3)
 *   - Crew list management (rank, contract dates, flag state certs)
 *   - Document expiry alerts (CoC, STCW certs, passport, vaccination)
 *   - Crew change planning (sign-on / sign-off)
 *
 * MLC 2006 rest requirements:
 *   - Minimum 10 hours rest in any 24-hour period
 *   - Minimum 77 hours rest in any 7-day period
 *   - Rest may be split into at most 2 periods, one ≥ 6 hours
 *   - Maximum 14 hours work in any 24h, 72 hours in any 7 days
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export type CrewRank =
  | 'MASTER' | 'CHIEF_OFFICER' | 'SECOND_OFFICER' | 'THIRD_OFFICER'
  | 'CHIEF_ENGINEER' | 'SECOND_ENGINEER' | 'THIRD_ENGINEER' | 'FOURTH_ENGINEER'
  | 'BOSUN' | 'ABLE_SEAMAN' | 'ORDINARY_SEAMAN' | 'OILER' | 'WIPER'
  | 'COOK' | 'CHIEF_STEWARD' | 'ELECTRICIAN' | 'FITTER' | 'CADET';

export interface CrewDocument {
  type: string;           // PASSPORT | COC | STCW_BASIC | BST | MEDICAL | YELLOW_FEVER | etc.
  number: string;
  issuingCountry: string;
  issueDate: string;      // YYYY-MM-DD
  expiryDate: string;     // YYYY-MM-DD
  issuingAuthority?: string;
}

export interface CrewMember {
  id:              string;
  vesselId:        string;
  seafarerId:      string;     // National ID or seafarer book number
  firstName:       string;
  lastName:        string;
  nationality:     string;
  rank:            CrewRank;
  signOnDate:      string;     // ISO date
  signOffDate?:    string;     // ISO date — null if still onboard
  contractMonths:  number;     // contract duration
  birthDate:       string;
  flagStateEndorsement: string; // Flag state of vessel
  documents:       CrewDocument[];
  emergencyContact: { name: string; phone: string; relation: string };
  notes?:          string;
  createdAt:       string;
  updatedAt:       string;
}

export interface RestPeriod {
  id:           string;
  crewMemberId: string;
  date:         string;   // YYYY-MM-DD
  restStartUtc: string;   // ISO datetime
  restEndUtc:   string;   // ISO datetime
  hoursRest:    number;
  notes?:       string;
}

export interface MLCComplianceResult {
  crewMemberId: string;
  name:         string;
  rank:         CrewRank;
  period:       string;  // '24h' | '7d'
  totalRestHours: number;
  requiredRestHours: number;  // 10 for 24h, 77 for 7d
  totalWorkHours: number;
  maxWorkHours: number;       // 14 for 24h, 72 for 7d
  compliant: boolean;
  violations: string[];
}

export interface DocumentAlert {
  crewMemberId: string;
  name:         string;
  rank:         CrewRank;
  document:     CrewDocument;
  daysUntilExpiry: number;
  severity:     'CRITICAL' | 'WARNING' | 'INFO';  // <30d, <90d, <180d
}

// ── File-backed store ─────────────────────────────────────────────────────────

const STORE_DIR = '/root/.ankr/state/crew-welfare';

function crewFile(vesselId: string) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  return path.join(STORE_DIR, `${vesselId.replace(/[^a-zA-Z0-9-]/g, '_')}-crew.json`);
}

function restFile(vesselId: string) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  return path.join(STORE_DIR, `${vesselId.replace(/[^a-zA-Z0-9-]/g, '_')}-rest.jsonl`);
}

function loadCrew(vesselId: string): Record<string, CrewMember> {
  const f = crewFile(vesselId);
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return {}; }
}

function saveCrew(vesselId: string, crew: Record<string, CrewMember>) {
  fs.writeFileSync(crewFile(vesselId), JSON.stringify(crew, null, 2));
}

function loadRestPeriods(vesselId: string): RestPeriod[] {
  const f = restFile(vesselId);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf-8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean) as RestPeriod[];
}

function appendRestPeriod(vesselId: string, period: RestPeriod) {
  fs.appendFileSync(restFile(vesselId), JSON.stringify(period) + '\n');
}

// ── Crew Management ───────────────────────────────────────────────────────────

export function listCrew(vesselId: string, onboardOnly = true): CrewMember[] {
  const crew = Object.values(loadCrew(vesselId));
  if (onboardOnly) return crew.filter(c => !c.signOffDate);
  return crew.sort((a, b) => a.lastName.localeCompare(b.lastName));
}

export function addCrewMember(vesselId: string, input: Omit<CrewMember, 'id' | 'createdAt' | 'updatedAt' | 'vesselId'>): CrewMember {
  const crew = loadCrew(vesselId);
  const now = new Date().toISOString();
  const member: CrewMember = {
    id: randomUUID(),
    vesselId,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  crew[member.id] = member;
  saveCrew(vesselId, crew);
  return member;
}

export function signOffCrew(vesselId: string, crewMemberId: string, signOffDate: string): CrewMember {
  const crew = loadCrew(vesselId);
  const member = crew[crewMemberId];
  if (!member) throw new Error(`Crew member ${crewMemberId} not found on vessel ${vesselId}`);
  member.signOffDate = signOffDate;
  member.updatedAt = new Date().toISOString();
  saveCrew(vesselId, crew);
  return member;
}

export function updateCrewDocuments(vesselId: string, crewMemberId: string, documents: CrewDocument[]): CrewMember {
  const crew = loadCrew(vesselId);
  const member = crew[crewMemberId];
  if (!member) throw new Error(`Crew member ${crewMemberId} not found`);
  member.documents = documents;
  member.updatedAt = new Date().toISOString();
  saveCrew(vesselId, crew);
  return member;
}

// ── Hours of Rest Tracking ────────────────────────────────────────────────────

export function recordRestPeriod(vesselId: string, input: Omit<RestPeriod, 'id' | 'hoursRest'>): RestPeriod {
  const start = new Date(input.restStartUtc).getTime();
  const end   = new Date(input.restEndUtc).getTime();
  if (end <= start) throw new Error('Rest end must be after rest start');

  const hoursRest = (end - start) / (1000 * 3600);
  const period: RestPeriod = { ...input, id: randomUUID(), hoursRest: Math.round(hoursRest * 100) / 100 };
  appendRestPeriod(vesselId, period);
  return period;
}

export function getRestPeriods(vesselId: string, crewMemberId: string, fromDate: string, toDate: string): RestPeriod[] {
  return loadRestPeriods(vesselId).filter(
    r => r.crewMemberId === crewMemberId &&
         r.date >= fromDate &&
         r.date <= toDate
  );
}

// ── MLC Compliance Check ──────────────────────────────────────────────────────

/**
 * Check MLC 2006 Regulation 2.3 compliance for all crew on a vessel for a given day.
 * Checks both 24h and 7-day rolling windows.
 */
export function checkMLCCompliance(vesselId: string, referenceDate: string): MLCComplianceResult[] {
  const allCrew = listCrew(vesselId, true);
  const allRest = loadRestPeriods(vesselId);
  const results: MLCComplianceResult[] = [];

  const refDay = new Date(referenceDate);

  for (const crew of allCrew) {
    // ── 24-hour check ──
    const day24Start = new Date(refDay);
    day24Start.setUTCHours(0, 0, 0, 0);
    const day24End = new Date(refDay);
    day24End.setUTCHours(23, 59, 59, 999);

    const restIn24 = allRest.filter(r =>
      r.crewMemberId === crew.id &&
      new Date(r.restStartUtc) >= day24Start &&
      new Date(r.restEndUtc) <= day24End
    );
    const totalRest24 = restIn24.reduce((s, r) => s + r.hoursRest, 0);
    const totalWork24 = Math.max(0, 24 - totalRest24);

    const violations24: string[] = [];
    if (totalRest24 < 10) violations24.push(`Insufficient rest: ${totalRest24.toFixed(1)}h < 10h required (24h window)`);
    if (totalWork24 > 14) violations24.push(`Excessive work: ${totalWork24.toFixed(1)}h > 14h max (24h window)`);
    // Check split rest — at most 2 periods, one must be ≥ 6h
    if (restIn24.length > 2) violations24.push(`Rest split into ${restIn24.length} periods > max 2 allowed`);
    if (restIn24.length > 1 && !restIn24.some(r => r.hoursRest >= 6)) {
      violations24.push('None of the rest periods is ≥ 6 hours (required when rest is split)');
    }

    results.push({
      crewMemberId: crew.id,
      name: `${crew.firstName} ${crew.lastName}`,
      rank: crew.rank,
      period: '24h',
      totalRestHours: Math.round(totalRest24 * 10) / 10,
      requiredRestHours: 10,
      totalWorkHours: Math.round(totalWork24 * 10) / 10,
      maxWorkHours: 14,
      compliant: violations24.length === 0,
      violations: violations24,
    });

    // ── 7-day check ──
    const day7Start = new Date(refDay);
    day7Start.setDate(day7Start.getDate() - 6);
    day7Start.setUTCHours(0, 0, 0, 0);

    const restIn7d = allRest.filter(r =>
      r.crewMemberId === crew.id &&
      new Date(r.restStartUtc) >= day7Start &&
      new Date(r.restEndUtc) <= day24End
    );
    const totalRest7d = restIn7d.reduce((s, r) => s + r.hoursRest, 0);
    const totalWork7d = Math.max(0, 168 - totalRest7d);

    const violations7d: string[] = [];
    if (totalRest7d < 77) violations7d.push(`Insufficient rest: ${totalRest7d.toFixed(1)}h < 77h required (7-day window)`);
    if (totalWork7d > 72) violations7d.push(`Excessive work: ${totalWork7d.toFixed(1)}h > 72h max (7-day window)`);

    results.push({
      crewMemberId: crew.id,
      name: `${crew.firstName} ${crew.lastName}`,
      rank: crew.rank,
      period: '7d',
      totalRestHours: Math.round(totalRest7d * 10) / 10,
      requiredRestHours: 77,
      totalWorkHours: Math.round(totalWork7d * 10) / 10,
      maxWorkHours: 72,
      compliant: violations7d.length === 0,
      violations: violations7d,
    });
  }

  return results;
}

// ── Document Expiry Alerts ────────────────────────────────────────────────────

/**
 * Check all crew documents and return alerts for those expiring soon.
 * Severity: CRITICAL < 30 days, WARNING < 90 days, INFO < 180 days.
 */
export function getDocumentAlerts(vesselId: string): DocumentAlert[] {
  const crew = listCrew(vesselId, true);
  const alerts: DocumentAlert[] = [];
  const now = Date.now();

  for (const member of crew) {
    for (const doc of member.documents) {
      const expiry = new Date(doc.expiryDate).getTime();
      const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 180) {
        alerts.push({
          crewMemberId: member.id,
          name: `${member.firstName} ${member.lastName}`,
          rank: member.rank,
          document: doc,
          daysUntilExpiry,
          severity: daysUntilExpiry < 30 ? 'CRITICAL' : daysUntilExpiry < 90 ? 'WARNING' : 'INFO',
        });
      }
    }
  }

  return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Summary: crew on board, nationalities, contract endings within 30 days.
 */
export function getCrewSummary(vesselId: string) {
  const onboard = listCrew(vesselId, true);
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const nationalities: Record<string, number> = {};
  for (const c of onboard) {
    nationalities[c.nationality] = (nationalities[c.nationality] ?? 0) + 1;
  }

  const contractsEndingSoon = onboard.filter(c => {
    const signOff = new Date(c.signOnDate);
    signOff.setMonth(signOff.getMonth() + c.contractMonths);
    return signOff.toISOString().slice(0, 10) <= in30Days;
  });

  return {
    vesselId,
    totalOnboard: onboard.length,
    nationalities,
    contractsEndingWithin30Days: contractsEndingSoon.map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      rank: c.rank,
      expectedSignOff: (() => {
        const d = new Date(c.signOnDate);
        d.setMonth(d.getMonth() + c.contractMonths);
        return d.toISOString().slice(0, 10);
      })(),
    })),
    criticalDocumentAlerts: getDocumentAlerts(vesselId).filter(a => a.severity === 'CRITICAL').length,
  };
}
