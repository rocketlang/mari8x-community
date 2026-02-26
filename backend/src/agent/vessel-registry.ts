/**
 * Mari8X Vessel Registry
 *
 * Persistent store of vessel static particulars (IMO, MMSI, DWT, flag,
 * class, type, call sign, owner). Provides a lookup layer so port calls
 * and ETA records can reference authoritative vessel data without
 * re-entering the same info every time.
 *
 * Storage: /root/.ankr/state/mari8x-vessels/registry.json
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import * as fs   from 'fs';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────────

export type VesselType =
  | 'BULKER'
  | 'TANKER'
  | 'CONTAINER'
  | 'RO_RO'
  | 'GAS_CARRIER'
  | 'GENERAL_CARGO'
  | 'PASSENGER'
  | 'TUG'
  | 'OTHER';

export interface VesselParticulars {
  imo:           string;          // IMO number (7 digits)
  name:          string;
  mmsi:          string | null;   // Maritime Mobile Service Identity
  callSign:      string | null;
  flag:          string | null;   // 2-letter ISO country code
  type:          VesselType;
  dwt:           number | null;   // Deadweight tonnage
  gt:            number | null;   // Gross tonnage
  builtYear:     number | null;
  classSociety:  string | null;   // Lloyd's, DNV, BV, etc.
  owner:         string | null;
  operator:      string | null;
  registeredAt:  string;
  updatedAt:     string;
}

export interface RegisterVesselInput {
  imo:          string;
  name:         string;
  mmsi?:        string | null;
  callSign?:    string | null;
  flag?:        string | null;
  type?:        VesselType;
  dwt?:         number | null;
  gt?:          number | null;
  builtYear?:   number | null;
  classSociety?: string | null;
  owner?:       string | null;
  operator?:    string | null;
}

interface VesselRegistry {
  vessels: Record<string, VesselParticulars>;  // keyed by IMO
}

// ── State ─────────────────────────────────────────────────────────────────────

const REGISTRY_DIR  = '/root/.ankr/state/mari8x-vessels';
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');

function ensureDir() {
  if (!fs.existsSync(REGISTRY_DIR)) fs.mkdirSync(REGISTRY_DIR, { recursive: true });
}

function loadRegistry(): VesselRegistry {
  ensureDir();
  if (!fs.existsSync(REGISTRY_FILE)) return { vessels: {} };
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')); }
  catch { return { vessels: {} }; }
}

function saveRegistry(reg: VesselRegistry) {
  ensureDir();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2));
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Register or update a vessel. If the IMO already exists, merges new fields.
 */
export function registerVessel(input: RegisterVesselInput): VesselParticulars {
  const imo = input.imo.trim().replace(/^IMO/i, '');
  const reg = loadRegistry();
  const now = new Date().toISOString();

  const existing = reg.vessels[imo];
  reg.vessels[imo] = {
    imo,
    name:         input.name,
    mmsi:         input.mmsi         ?? existing?.mmsi         ?? null,
    callSign:     input.callSign      ?? existing?.callSign      ?? null,
    flag:         input.flag          ?? existing?.flag          ?? null,
    type:         input.type          ?? existing?.type          ?? 'OTHER',
    dwt:          input.dwt           ?? existing?.dwt           ?? null,
    gt:           input.gt            ?? existing?.gt            ?? null,
    builtYear:    input.builtYear     ?? existing?.builtYear     ?? null,
    classSociety: input.classSociety  ?? existing?.classSociety  ?? null,
    owner:        input.owner         ?? existing?.owner         ?? null,
    operator:     input.operator      ?? existing?.operator      ?? null,
    registeredAt: existing?.registeredAt ?? now,
    updatedAt:    now,
  };

  saveRegistry(reg);
  return reg.vessels[imo];
}

/**
 * Look up a vessel by IMO number.
 */
export function getVessel(imo: string): VesselParticulars | null {
  const clean = imo.trim().replace(/^IMO/i, '');
  return loadRegistry().vessels[clean] ?? null;
}

/**
 * Search vessels by name (case-insensitive partial match) or MMSI.
 */
export function searchVessels(query: string): VesselParticulars[] {
  const q   = query.toLowerCase().trim();
  const reg = loadRegistry();
  return Object.values(reg.vessels).filter(v =>
    v.name.toLowerCase().includes(q) ||
    v.imo.includes(q) ||
    (v.mmsi && v.mmsi.includes(q)) ||
    (v.callSign && v.callSign.toLowerCase().includes(q))
  );
}

/**
 * List all vessels, optionally filtered by type or flag.
 */
export function listVessels(filter?: { type?: VesselType; flag?: string }): VesselParticulars[] {
  let list = Object.values(loadRegistry().vessels);
  if (filter?.type) list = list.filter(v => v.type === filter.type);
  if (filter?.flag) list = list.filter(v => v.flag?.toLowerCase() === filter.flag!.toLowerCase());
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Update specific fields of an existing vessel record.
 */
export function updateVessel(
  imo: string,
  updates: Partial<Omit<VesselParticulars, 'imo' | 'registeredAt'>>
): VesselParticulars {
  const clean = imo.trim().replace(/^IMO/i, '');
  const reg   = loadRegistry();
  const existing = reg.vessels[clean];
  if (!existing) throw new Error(`Vessel IMO ${imo} not found in registry`);
  reg.vessels[clean] = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  saveRegistry(reg);
  return reg.vessels[clean];
}

/**
 * Auto-populate registry from existing port call records.
 * Reads port call state and registers any vessel with an IMO not yet in registry.
 */
export function bulkImportFromPortCalls(): { imported: number; skipped: number } {
  const PORT_CALLS_FILE = '/root/.ankr/state/mari8x-port-calls/records.json';
  if (!fs.existsSync(PORT_CALLS_FILE)) return { imported: 0, skipped: 0 };

  let imported = 0, skipped = 0;
  try {
    const records = JSON.parse(fs.readFileSync(PORT_CALLS_FILE, 'utf-8')) as Record<string, any>;
    for (const rec of Object.values(records)) {
      if (!rec.vesselIMO) { skipped++; continue; }
      const existing = getVessel(rec.vesselIMO);
      if (existing) { skipped++; continue; }
      registerVessel({
        imo:  rec.vesselIMO,
        name: rec.vesselName,
        type: 'OTHER',
      });
      imported++;
    }
  } catch { /* non-fatal */ }

  return { imported, skipped };
}

/**
 * Registry summary stats.
 */
export function getRegistryStats() {
  const vessels = Object.values(loadRegistry().vessels);
  const byType  = vessels.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return {
    total:     vessels.length,
    withDWT:   vessels.filter(v => v.dwt != null).length,
    withMMSI:  vessels.filter(v => v.mmsi != null).length,
    byType,
  };
}
