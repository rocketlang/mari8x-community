/**
 * Mari8X Document Readiness Checker
 *
 * Tracks pre-arrival document status for a vessel call.
 * Each doc has a status (pending | submitted | verified | rejected)
 * and a required-by deadline relative to ETA.
 *
 * Storage: /root/.ankr/state/mari8x-docs/<voyageId>.json
 */

import * as fs   from 'fs';
import * as path from 'path';

const DOCS_DIR = '/root/.ankr/state/mari8x-docs';

// ── Doc catalogue ─────────────────────────────────────────────────────────────

export type DocStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

export interface DocRequirement {
  id:          string;
  name:        string;
  category:    'customs' | 'health' | 'cargo' | 'crew' | 'security';
  mandatory:   boolean;
  dueHoursBeforeEta: number;   // how many hours before ETA this must be submitted
  status:      DocStatus;
  submittedAt: string | null;
  notes:       string | null;
}

export interface DocumentChecklist {
  voyageId:     string;
  imo:          string;
  vesselName:   string;
  portUnlocode: string;
  etaAt:        string | null;
  documents:    DocRequirement[];
  summary: {
    total:     number;
    pending:   number;
    submitted: number;
    verified:  number;
    rejected:  number;
    overdue:   number;   // past deadline and still pending
    readyPct:  number;
  };
  updatedAt: string;
}

// ── Standard IMO / port-state-control document requirements ──────────────────

const STANDARD_DOCS: Omit<DocRequirement, 'status' | 'submittedAt' | 'notes'>[] = [
  { id: 'general-declaration',   name: 'General Declaration (FAL 1)',     category: 'customs',  mandatory: true,  dueHoursBeforeEta: 24 },
  { id: 'cargo-declaration',     name: 'Cargo Declaration (FAL 2)',       category: 'customs',  mandatory: true,  dueHoursBeforeEta: 24 },
  { id: 'ships-stores',          name: "Ship's Stores Declaration (FAL 3)", category: 'customs', mandatory: true, dueHoursBeforeEta: 24 },
  { id: 'crew-effects',          name: "Crew's Effects Declaration (FAL 4)", category: 'customs', mandatory: true, dueHoursBeforeEta: 24 },
  { id: 'crew-list',             name: 'Crew List (FAL 5)',               category: 'crew',     mandatory: true,  dueHoursBeforeEta: 24 },
  { id: 'passenger-list',        name: 'Passenger List (FAL 6)',          category: 'crew',     mandatory: false, dueHoursBeforeEta: 24 },
  { id: 'dangerous-goods',       name: 'Dangerous Goods Manifest',        category: 'cargo',    mandatory: false, dueHoursBeforeEta: 48 },
  { id: 'maritime-health',       name: 'Maritime Health Declaration',     category: 'health',   mandatory: true,  dueHoursBeforeEta: 12 },
  { id: 'isps-notification',     name: 'ISPS Pre-Arrival Notification',   category: 'security', mandatory: true,  dueHoursBeforeEta: 96 },
  { id: 'advance-cargo-info',    name: 'Advance Cargo Information (ACI)', category: 'customs',  mandatory: true,  dueHoursBeforeEta: 24 },
  { id: 'bill-of-lading',        name: 'Original Bill of Lading Set',     category: 'cargo',    mandatory: true,  dueHoursBeforeEta: 0 },
  { id: 'certificate-registry',  name: 'Certificate of Registry',        category: 'customs',  mandatory: true,  dueHoursBeforeEta: 0 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function docsFile(voyageId: string): string {
  const safe = voyageId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(DOCS_DIR, `${safe}.json`);
}

function ensureDir(): void {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function buildSummary(docs: DocRequirement[], etaAt: string | null) {
  const now     = Date.now();
  const etaMs   = etaAt ? new Date(etaAt).getTime() : null;
  let overdue   = 0;

  if (etaMs) {
    for (const d of docs) {
      if (d.status === 'pending') {
        const deadline = etaMs - d.dueHoursBeforeEta * 3600_000;
        if (now > deadline) overdue++;
      }
    }
  }

  const pending   = docs.filter(d => d.status === 'pending').length;
  const submitted = docs.filter(d => d.status === 'submitted').length;
  const verified  = docs.filter(d => d.status === 'verified').length;
  const rejected  = docs.filter(d => d.status === 'rejected').length;
  const readyPct  = docs.length === 0 ? 0 :
    Math.round(((submitted + verified) / docs.length) * 100);

  return { total: docs.length, pending, submitted, verified, rejected, overdue, readyPct };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get or create document checklist for a voyage */
export function getChecklist(
  voyageId:     string,
  imo:          string,
  vesselName:   string,
  portUnlocode: string,
  etaAt:        string | null = null,
): DocumentChecklist {
  ensureDir();
  const file = docsFile(voyageId);

  if (fs.existsSync(file)) {
    try {
      const stored = JSON.parse(fs.readFileSync(file, 'utf-8')) as DocumentChecklist;
      // Update ETA if provided
      if (etaAt && stored.etaAt !== etaAt) {
        stored.etaAt    = etaAt;
        stored.summary  = buildSummary(stored.documents, etaAt);
        stored.updatedAt = new Date().toISOString();
        fs.writeFileSync(file, JSON.stringify(stored, null, 2), 'utf-8');
      }
      return stored;
    } catch { /* fall through to create fresh */ }
  }

  // Create new checklist from standard template
  const documents: DocRequirement[] = STANDARD_DOCS.map(d => ({
    ...d,
    status:      'pending',
    submittedAt: null,
    notes:       null,
  }));

  const checklist: DocumentChecklist = {
    voyageId,
    imo,
    vesselName,
    portUnlocode,
    etaAt,
    documents,
    summary:   buildSummary(documents, etaAt),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(file, JSON.stringify(checklist, null, 2), 'utf-8');
  return checklist;
}

/** Update the status of one document */
export function updateDocStatus(
  voyageId: string,
  docId:    string,
  status:   DocStatus,
  notes?:   string,
): DocumentChecklist | null {
  ensureDir();
  const file = docsFile(voyageId);
  if (!fs.existsSync(file)) return null;

  try {
    const checklist = JSON.parse(fs.readFileSync(file, 'utf-8')) as DocumentChecklist;
    const doc       = checklist.documents.find(d => d.id === docId);
    if (!doc) return null;

    doc.status      = status;
    doc.submittedAt = (status === 'submitted' || status === 'verified') ? new Date().toISOString() : doc.submittedAt;
    doc.notes       = notes ?? doc.notes;

    checklist.summary   = buildSummary(checklist.documents, checklist.etaAt);
    checklist.updatedAt = new Date().toISOString();

    fs.writeFileSync(file, JSON.stringify(checklist, null, 2), 'utf-8');
    return checklist;
  } catch { return null; }
}

/** List all voyages with incomplete checklists */
export function listOpenChecklists(): DocumentChecklist[] {
  ensureDir();
  const results: DocumentChecklist[] = [];
  try {
    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const c = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, f), 'utf-8')) as DocumentChecklist;
        if (c.summary.pending > 0 || c.summary.rejected > 0) results.push(c);
      } catch { /* skip corrupt */ }
    }
  } catch { /* empty dir */ }
  return results.sort((a, b) =>
    (a.etaAt ?? '').localeCompare(b.etaAt ?? '') || a.voyageId.localeCompare(b.voyageId),
  );
}
