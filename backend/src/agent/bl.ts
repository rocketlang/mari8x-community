/**
 * Mari8X Bill of Lading (B/L) Agent
 *
 * Manages the full B/L lifecycle:
 *   DRAFT → ISSUED → (AMENDED*) → SURRENDERED → RELEASED
 *
 * Release types:
 *   ORIGINAL  — Physical B/L surrendered at destination port
 *   TELEX     — Digital telex-release; shipper sends authorisation email
 *   SEAWAY    — Express B/L; cargo released without original presentation
 *
 * Storage: /root/.ankr/state/mari8x-bl/
 *   <blNumber>.json   — individual B/L record
 *   index.json        — blNumber → { status, vesselName, voyageId } quick lookup
 *
 * © 2026 ANKR Labs — Proprietary
 */

import * as fs   from 'fs';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const BL_DIR    = '/root/.ankr/state/mari8x-bl';
const IDX_FILE  = path.join(BL_DIR, 'index.json');

fs.mkdirSync(BL_DIR, { recursive: true });

// ── Types ─────────────────────────────────────────────────────────────────────

export type BLStatus      = 'DRAFT' | 'ISSUED' | 'SURRENDERED' | 'RELEASED';
export type BLReleaseType = 'ORIGINAL' | 'TELEX' | 'SEAWAY';
export type FreightPayable = 'PREPAID' | 'COLLECT';

export interface BLContainer {
  containerNumber: string;
  isoType:         string;   // 20GP, 40HC etc.
  sealNumber?:     string;
  grossWeightKg?:  number;
}

export interface BLAmendment {
  amendmentNo: number;
  field:       string;
  oldValue:    string;
  newValue:    string;
  reason:      string;
  amendedBy:   string;
  amendedAt:   string;
}

export interface BillOfLading {
  blNumber:         string;
  status:           BLStatus;
  releaseType:      BLReleaseType;
  // Parties
  shipper:          string;
  consignee:        string;
  notifyParty?:     string;
  // Routing
  vesselName:       string;
  voyageNumber:     string;
  portOfLoading:    string;
  portOfDischarge:  string;
  placeOfReceipt?:  string;
  placeOfDelivery?: string;
  // Cargo
  commodity:        string;
  packages:         number;
  packageUnit:      string;   // CONTAINERS, PALLETS, BOXES, etc.
  grossWeightKg:    number;
  measurementCbm?:  number;
  containers:       BLContainer[];
  marksAndNumbers?: string;
  // Freight
  freightPayable:   FreightPayable;
  freightAmount?:   number;
  currency:         string;
  // Issuance
  placeOfIssue?:    string;
  issuedAt?:        string;
  issuedBy?:        string;
  // Links
  voyageId?:        string;
  organizationId?:  string;
  // Lifecycle
  surrenderedAt?:   string;
  releasedAt?:      string;
  releaseAuthorisedBy?: string;
  telexRefNo?:      string;
  // Amendments
  amendments:       BLAmendment[];
  // Audit
  createdAt:        string;
  updatedAt:        string;
}

export interface BLIndex {
  [blNumber: string]: {
    status:      BLStatus;
    vesselName:  string;
    portOfLoading:   string;
    portOfDischarge: string;
    voyageId?:   string;
    createdAt:   string;
  };
}

export interface BLSummary {
  blNumber:        string;
  status:          BLStatus;
  releaseType:     BLReleaseType;
  shipper:         string;
  consignee:       string;
  vesselName:      string;
  voyageNumber:    string;
  portOfLoading:   string;
  portOfDischarge: string;
  containers:      number;
  grossWeightKg:   number;
  freightPayable:  FreightPayable;
  amendmentCount:  number;
  issuedAt?:       string;
  createdAt:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadIndex(): BLIndex {
  try {
    return existsSync(IDX_FILE)
      ? JSON.parse(fs.readFileSync(IDX_FILE, 'utf8'))
      : {};
  } catch { return {}; }
}

function existsSync(f: string): boolean {
  try { fs.accessSync(f); return true; } catch { return false; }
}

function saveIndex(idx: BLIndex): void {
  fs.writeFileSync(IDX_FILE, JSON.stringify(idx, null, 2));
}

function blFile(blNumber: string): string {
  return path.join(BL_DIR, `${blNumber.replace(/\//g, '-')}.json`);
}

function loadBL(blNumber: string): BillOfLading | null {
  const f = blFile(blNumber);
  try {
    return existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as BillOfLading : null;
  } catch { return null; }
}

function saveBL(bl: BillOfLading): void {
  bl.updatedAt = new Date().toISOString();
  fs.writeFileSync(blFile(bl.blNumber), JSON.stringify(bl, null, 2));
  // Update index
  const idx = loadIndex();
  idx[bl.blNumber] = {
    status:      bl.status,
    vesselName:  bl.vesselName,
    portOfLoading:   bl.portOfLoading,
    portOfDischarge: bl.portOfDischarge,
    voyageId:    bl.voyageId,
    createdAt:   bl.createdAt,
  };
  saveIndex(idx);
}

/** Generate a B/L number: ANKR<YYYYMMDD><4-digit seq> */
function generateBLNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const idx   = loadIndex();
  const todayEntries = Object.keys(idx).filter(n => n.includes(today));
  const seq   = String(todayEntries.length + 1).padStart(4, '0');
  return `ANKR${today}${seq}`;
}

function toSummary(bl: BillOfLading): BLSummary {
  return {
    blNumber:        bl.blNumber,
    status:          bl.status,
    releaseType:     bl.releaseType,
    shipper:         bl.shipper,
    consignee:       bl.consignee,
    vesselName:      bl.vesselName,
    voyageNumber:    bl.voyageNumber,
    portOfLoading:   bl.portOfLoading,
    portOfDischarge: bl.portOfDischarge,
    containers:      bl.containers.length,
    grossWeightKg:   bl.grossWeightKg,
    freightPayable:  bl.freightPayable,
    amendmentCount:  bl.amendments.length,
    issuedAt:        bl.issuedAt,
    createdAt:       bl.createdAt,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CreateBLInput {
  releaseType:      BLReleaseType;
  shipper:          string;
  consignee:        string;
  notifyParty?:     string;
  vesselName:       string;
  voyageNumber:     string;
  portOfLoading:    string;
  portOfDischarge:  string;
  placeOfReceipt?:  string;
  placeOfDelivery?: string;
  commodity:        string;
  packages:         number;
  packageUnit?:     string;
  grossWeightKg:    number;
  measurementCbm?:  number;
  containers?:      BLContainer[];
  marksAndNumbers?: string;
  freightPayable:   FreightPayable;
  freightAmount?:   number;
  currency?:        string;
  placeOfIssue?:    string;
  voyageId?:        string;
  organizationId?:  string;
}

/** Create a B/L in DRAFT status */
export function createBL(input: CreateBLInput): BillOfLading {
  const blNumber = generateBLNumber();
  const now      = new Date().toISOString();
  const bl: BillOfLading = {
    blNumber,
    status:          'DRAFT',
    releaseType:     input.releaseType,
    shipper:         input.shipper,
    consignee:       input.consignee,
    notifyParty:     input.notifyParty,
    vesselName:      input.vesselName,
    voyageNumber:    input.voyageNumber,
    portOfLoading:   input.portOfLoading,
    portOfDischarge: input.portOfDischarge,
    placeOfReceipt:  input.placeOfReceipt,
    placeOfDelivery: input.placeOfDelivery,
    commodity:       input.commodity,
    packages:        input.packages,
    packageUnit:     input.packageUnit ?? 'CONTAINERS',
    grossWeightKg:   input.grossWeightKg,
    measurementCbm:  input.measurementCbm,
    containers:      input.containers ?? [],
    marksAndNumbers: input.marksAndNumbers,
    freightPayable:  input.freightPayable,
    freightAmount:   input.freightAmount,
    currency:        input.currency ?? 'USD',
    placeOfIssue:    input.placeOfIssue,
    voyageId:        input.voyageId,
    organizationId:  input.organizationId,
    amendments:      [],
    createdAt:       now,
    updatedAt:       now,
  };
  saveBL(bl);
  return bl;
}

/** Issue a DRAFT B/L — assigns issuedAt and changes status to ISSUED */
export function issueBL(blNumber: string, issuedBy: string, placeOfIssue?: string): BillOfLading | null {
  const bl = loadBL(blNumber);
  if (!bl) return null;
  if (bl.status !== 'DRAFT') throw new Error(`Cannot issue B/L in status ${bl.status}`);
  bl.status      = 'ISSUED';
  bl.issuedAt    = new Date().toISOString();
  bl.issuedBy    = issuedBy;
  if (placeOfIssue) bl.placeOfIssue = placeOfIssue;
  saveBL(bl);
  return bl;
}

export interface AmendBLInput {
  field:     string;
  newValue:  string;
  reason:    string;
  amendedBy: string;
}

/** Record an amendment on an ISSUED B/L */
export function amendBL(blNumber: string, input: AmendBLInput): BillOfLading | null {
  const bl = loadBL(blNumber);
  if (!bl) return null;
  if (bl.status !== 'ISSUED') throw new Error(`Amendments only allowed on ISSUED B/Ls (current: ${bl.status})`);

  const oldValue = String((bl as any)[input.field] ?? '');
  const amendmentNo = bl.amendments.length + 1;

  // Apply the change to the B/L itself
  (bl as any)[input.field] = input.newValue;

  bl.amendments.push({
    amendmentNo,
    field:     input.field,
    oldValue,
    newValue:  input.newValue,
    reason:    input.reason,
    amendedBy: input.amendedBy,
    amendedAt: new Date().toISOString(),
  });
  saveBL(bl);
  return bl;
}

export interface ReleaseInput {
  releaseType?:          BLReleaseType;  // can override at release time
  releaseAuthorisedBy:   string;
  telexRefNo?:           string;         // required for TELEX release
}

/**
 * Surrender and release cargo:
 *   ISSUED → SURRENDERED → RELEASED  (ORIGINAL: two separate events)
 *   ISSUED → RELEASED                (TELEX / SEAWAY: combined)
 */
export function surrenderBL(blNumber: string, surrenderedBy: string): BillOfLading | null {
  const bl = loadBL(blNumber);
  if (!bl) return null;
  if (bl.status !== 'ISSUED') throw new Error(`Can only surrender an ISSUED B/L`);
  if (bl.releaseType !== 'ORIGINAL') throw new Error(`Surrender is only for ORIGINAL B/Ls. Use releaseBL() directly for TELEX/SEAWAY`);
  bl.status        = 'SURRENDERED';
  bl.surrenderedAt = new Date().toISOString();
  bl.issuedBy      = surrenderedBy;
  saveBL(bl);
  return bl;
}

export function releaseBL(blNumber: string, input: ReleaseInput): BillOfLading | null {
  const bl = loadBL(blNumber);
  if (!bl) return null;

  const allowedFrom: BLStatus[] = ['ISSUED', 'SURRENDERED'];
  if (!allowedFrom.includes(bl.status)) {
    throw new Error(`Cannot release B/L in status ${bl.status}`);
  }

  if (input.releaseType) bl.releaseType = input.releaseType;

  if (bl.releaseType === 'TELEX' && !input.telexRefNo) {
    throw new Error('TELEX release requires telexRefNo');
  }

  bl.status               = 'RELEASED';
  bl.releasedAt           = new Date().toISOString();
  bl.releaseAuthorisedBy  = input.releaseAuthorisedBy;
  if (input.telexRefNo) bl.telexRefNo = input.telexRefNo;

  saveBL(bl);
  return bl;
}

/** Get a single B/L by number */
export function getBL(blNumber: string): BillOfLading | null {
  return loadBL(blNumber);
}

/** List B/Ls with optional filters */
export interface ListBLFilter {
  status?:           BLStatus;
  vesselName?:       string;
  portOfLoading?:    string;
  portOfDischarge?:  string;
  voyageId?:         string;
  limit?:            number;
}

export function listBLs(filter: ListBLFilter = {}): BLSummary[] {
  const idx     = loadIndex();
  let entries   = Object.keys(idx);

  if (filter.status)           entries = entries.filter(n => idx[n].status     === filter.status);
  if (filter.voyageId)         entries = entries.filter(n => idx[n].voyageId   === filter.voyageId);
  if (filter.vesselName)       entries = entries.filter(n => idx[n].vesselName === filter.vesselName);
  if (filter.portOfDischarge)  entries = entries.filter(n => idx[n].portOfDischarge === filter.portOfDischarge?.toUpperCase());

  // Load full records for summary (newest first)
  entries = entries.slice(-(filter.limit ?? 50)).reverse();

  const results: BLSummary[] = [];
  for (const n of entries) {
    const bl = loadBL(n);
    if (bl) results.push(toSummary(bl));
  }
  return results;
}

/** Dashboard: counts by status */
export function getBLDashboard(): {
  total: number;
  draft: number;
  issued: number;
  surrendered: number;
  released: number;
  pendingRelease: number;
} {
  const idx  = loadIndex();
  const vals = Object.values(idx);
  return {
    total:         vals.length,
    draft:         vals.filter(v => v.status === 'DRAFT').length,
    issued:        vals.filter(v => v.status === 'ISSUED').length,
    surrendered:   vals.filter(v => v.status === 'SURRENDERED').length,
    released:      vals.filter(v => v.status === 'RELEASED').length,
    pendingRelease: vals.filter(v => v.status === 'ISSUED' || v.status === 'SURRENDERED').length,
  };
}
