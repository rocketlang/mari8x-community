/**
 * Forja Protocol — Mari8X Community Edition
 * STATE / TRUST / SENSE / PROOF
 *
 * GET  /api/v2/forja/state             — service capability manifest
 * GET  /api/v2/forja/trust/:userId     — role + permissions
 * POST /api/v2/forja/sense/emit        — fire SENSE event to webhook
 * GET  /api/v2/forja/proof             — rule→code compliance matrix
 * GET  /api/v2/forja/proof/history     — coverage trend (stub)
 *
 * MAR-001: Port pre-arrival checklist obligation
 * MAR-002: ETA calculation
 * MAR-003: Demurrage calculation
 * MAR-004: Bill of lading issuance
 * MAR-005: Port congestion assessment
 * MAR-006: DA forecast
 * MAR-007: Noon report obligation
 * MAR-008: Crew welfare minimum standards
 * MAR-YK-001: Laytime commencement
 * MAR-YK-002: Port call sequence
 * MAR-YK-003: Risk escalation — congestion > 7 days
 *
 * FP-001: No ANKR internal calls. FP-003: Forja-native from day 1.
 *
 * @rule:FRJ-P-001  Every Forja service in a regulated domain MUST implement PROOF
 * @rule:FRJ-P-005  PROOF endpoint MUST be publicly accessible without authentication
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { TRUST_PERM, MARITIME_ROLE_MASK, ROLE_MASK, describePerms, TRUST_MASK_SCHEMA } from '@ankr/trust-constants';
// @rule:BMK-001 — trust_mask is a 32-bit integer published alongside string roles
// @rule:BMK-002 — bit positions come from @ankr/trust-constants only

const MARI8X_COMMUNITY_ROLE_MASK: Record<string, number> = {
  MASTER:        ROLE_MASK.ADMIN,
  CHIEF_OFFICER: ROLE_MASK.WRITER,
  AGENT:         ROLE_MASK.WRITER,
  OWNER:         ROLE_MASK.READER,
};

// ── Capability manifest — must stay in sync with codex.json ──────────────────

const CAN_ANSWER = [
  'port-congestion',
  'eta-estimate',
  'demurrage-calculation',
  'bl-status',
  'da-forecast',
  'crew-welfare-status',
  'port-call-status',
];

const CAN_DO = [
  'PRE_ARRIVAL_CHECK',
  'DEMURRAGE_CALCULATE',
  'BL_DRAFT',
  'ETA_UPDATE',
  'NOON_REPORT',
  'CREW_WELFARE_LOG',
];

const EMITS = [
  'pre_arrival_overdue',
  'eta_updated',
  'demurrage_accruing',
  'congestion_alert',
  'bl_issued',
];

// ── TRUST role matrix ─────────────────────────────────────────────────────────

const ROLE_TRUST: Record<string, { can_do: string[]; read_only: boolean }> = {
  MASTER: {
    can_do: CAN_DO,
    read_only: false,
  },
  CHIEF_OFFICER: {
    can_do: ['PRE_ARRIVAL_CHECK', 'NOON_REPORT', 'CREW_WELFARE_LOG'],
    read_only: false,
  },
  AGENT: {
    can_do: ['DEMURRAGE_CALCULATE', 'BL_DRAFT', 'ETA_UPDATE'],
    read_only: false,
  },
  OWNER: {
    can_do: [],
    read_only: true,
  },
};

// ── Router ────────────────────────────────────────────────────────────────────

export const forjaRouter = Router();

// ── STATE: service capability manifest ───────────────────────────────────────
forjaRouter.get('/api/v2/forja/state', async (_req: Request, res: Response) => {
  try {
    // Live counts from DB for enriched manifest
    const [vesselCount, portCount] = await Promise.all([
      prisma.vessel.count().catch(() => 0),
      prisma.port.count().catch(() => 0),
    ]);

    res.json({
      service:       'mari8x-community',
      domain:        'maritime',
      forja_version: '2.0',
      can_answer:    CAN_ANSWER,
      can_do:        CAN_DO,
      emits:         EMITS,
      vessel_count:  vesselCount,
      port_count:    portCount,
      generated_at:  new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── TRUST: role + permissions for user ───────────────────────────────────────
forjaRouter.get('/api/v2/forja/trust/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  // Role passed via header (X-Mari8x-Role) or inferred from userId prefix convention
  // e.g. "MASTER:IMO1234567" → role = MASTER
  const roleHeader = (req.headers['x-mari8x-role'] as string | undefined)?.toUpperCase() ?? null;

  // Try to infer from userId prefix (MASTER:xxx, AGENT:xxx, etc.)
  let role = roleHeader;
  if (!role && userId.includes(':')) {
    role = userId.split(':')[0].toUpperCase();
  }
  if (!role || !ROLE_TRUST[role]) {
    role = 'OWNER'; // default to least-privileged
  }

  const trust = ROLE_TRUST[role];

  res.json({
    user_id:          userId,
    role,
    tier:             role === 'MASTER' ? 'master' : role === 'OWNER' ? 'read-only' : 'operator',
    can_do:           trust.can_do,
    cannot_do:        CAN_DO.filter(a => !trust.can_do.includes(a)),
    read_only:        trust.read_only,
    trust_mask:       MARI8X_COMMUNITY_ROLE_MASK[role] ?? ROLE_MASK.GUEST,
    trust_mask_schema: TRUST_MASK_SCHEMA,
    trust_mask_perms: describePerms(MARI8X_COMMUNITY_ROLE_MASK[role] ?? ROLE_MASK.GUEST),
    forja_version:    '2.0',
  });
});

// ── SENSE: emit event ─────────────────────────────────────────────────────────
forjaRouter.post('/api/v2/forja/sense/emit', async (req: Request, res: Response) => {
  const { type, payload, voyage_id, port_code } = req.body as any;
  if (!type) return res.status(400).json({ error: 'type required' }) as any;

  if (!EMITS.includes(type)) {
    return res.status(400).json({
      error: `Unknown event type: ${type}`,
      valid: EMITS,
    }) as any;
  }

  const event = {
    service:  'mari8x-community',
    type,
    voyage_id: voyage_id ?? null,
    port_code: port_code ?? null,
    payload:   payload ?? {},
    fired_at:  new Date().toISOString(),
  };

  // Fan-out to AnkrClaw webhook if configured — never fail the request on fan-out failure
  const webhookUrl = process.env.ANKR_CLAW_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(event),
      });
    } catch {
      // Webhook failure is non-fatal per FP-001 SENSE fan-out rules
    }
  } else {
    console.log(`[forja:sense] ${type}`, JSON.stringify(event));
  }

  res.json({ ok: true, event });
});

// ── PROOF: rule→code compliance matrix ───────────────────────────────────────
// GET /api/v2/forja/proof
// Returns the rule→code compliance matrix for mari8x-community.
// Coverage is honest — starts at 0% until @rule: annotations are added.
// proof-cache.json is populated by scripts/proof-extract.mjs
//
// @rule:FRJ-P-001  Every Forja service in a regulated domain MUST implement PROOF
// @rule:FRJ-P-005  PROOF endpoint MUST be publicly accessible without authentication
// @rule:FRJ-P-006  Coverage calculated against certified rules only
forjaRouter.get('/api/v2/forja/proof', async (req: Request, res: Response) => {
  const { mode, status } = req.query as any;
  try {
    // ── 1. Load rules from mar_rules table ───────────────────────────────
    type MarRule = {
      rule_id: string;
      rule_type: string;
      domain: string;
      title: string;
      statement: string;
      status: string;
    };

    const allRules: MarRule[] = await prisma.$queryRawUnsafe<MarRule[]>(`
      SELECT rule_id, rule_type, domain, title, statement, status
      FROM mar_rules
      ORDER BY rule_id
    `);

    // ── 2. Load proof-cache.json (written by scripts/proof-extract.mjs) ──
    let annotations: any[] = [];
    let proofCacheAt: string | null = null;
    try {
      const { readFileSync }  = await import('fs');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __dir    = dirname(fileURLToPath(import.meta.url));
      const cachePath = join(__dir, '../../proof-cache.json');
      const raw = JSON.parse(readFileSync(cachePath, 'utf8'));
      annotations  = raw.annotations ?? [];
      proofCacheAt = raw.extracted_at ?? null;
    } catch {
      // proof-cache.json not yet generated — annotation sweep pending
    }

    // ── 3. Build annotation map: rule_id → [FileAnnotation] ──────────────
    const annotationMap: Record<string, any[]> = {};
    for (const ann of annotations) {
      if (!annotationMap[ann.rule_id]) annotationMap[ann.rule_id] = [];
      annotationMap[ann.rule_id].push(ann);
    }

    // Detect orphan annotations (cite non-existent rule_id)
    const knownRuleIds     = new Set(allRules.map(r => r.rule_id));
    const orphanAnnotations = annotations.filter(
      (a: any) => !knownRuleIds.has(a.rule_id)
    );

    // ── 4. Build compliance matrix ────────────────────────────────────────
    const certifiedRules = allRules.filter(r => r.status === 'certified');
    const matrix = allRules.map(r => ({
      rule_id:        r.rule_id,
      rule_type:      r.rule_type,
      status:         r.status,
      statement:      (r.statement ?? r.title ?? '').slice(0, 140),
      implemented_by: annotationMap[r.rule_id] ?? [],
      verified:       (annotationMap[r.rule_id] ?? []).length > 0,
    }));

    // ── 5. Coverage metrics (certified rules only — FRJ-P-006) ───────────
    const rulesTotal        = allRules.length;
    const certifiedTotal    = certifiedRules.length;
    const certifiedWithCode = certifiedRules.filter(
      r => (annotationMap[r.rule_id] ?? []).length > 0
    ).length;
    const coveragePct = certifiedTotal > 0
      ? Math.round((certifiedWithCode / certifiedTotal) * 10000) / 100
      : 0;
    const threshold = 90.0;
    const passing   = coveragePct >= threshold;

    // ── 6. Capabilities without rule backing ──────────────────────────────
    const capabilityAnnotated      = new Set(annotations.map((a: any) => a.capability).filter(Boolean));
    const capabilitiesWithoutRules = [
      ...CAN_DO.filter(c => !capabilityAnnotated.has(c)).map(c => ({ capability: c, type: 'can_do' })),
      ...CAN_ANSWER.filter(c => !capabilityAnnotated.has(c)).map(c => ({ capability: c, type: 'can_answer' })),
    ];

    // ── 7. Accountability summary (founder mode) ──────────────────────────
    const accountabilitySummary = mode === 'founder' ? {
      rules_declared_in_logics:     rulesTotal,
      rules_in_db:                  rulesTotal,
      certified_rules:              certifiedTotal,
      code_with_rule_annotations:   certifiedWithCode,
      gap_certified_to_annotated:   certifiedTotal - certifiedWithCode,
      verdict: certifiedWithCode === 0
        ? 'Chain is traceable on paper. Annotation sweep required to make it machine-verifiable.'
        : `${certifiedWithCode}/${certifiedTotal} certified rules have code annotations. Coverage: ${coveragePct}%.`,
      action: certifiedWithCode === 0
        ? 'Run annotation sweep: add @rule:, @task:, @capability: to existing mari8x-community source files.'
        : coveragePct < threshold
        ? `Continue annotation sweep. Need ${certifiedTotal - certifiedWithCode} more rules annotated to pass threshold.`
        : 'PROOF passing. Maintain annotations as new rules and code are added.',
    } : undefined;

    // ── 8. Apply filters ──────────────────────────────────────────────────
    let filteredMatrix = matrix;
    if (status === 'unimplemented') filteredMatrix = matrix.filter(r => !r.verified);
    if (status === 'orphan')        filteredMatrix = [];

    res.json({
      service:            'mari8x-community',
      version:            '1.0.0',
      domain:             'maritime',
      forja_version:      '2.0',
      proof_generated_at: new Date().toISOString(),
      proof_source:       annotations.length > 0 ? 'codex-crawl' : 'stub-pending-annotation-sweep',
      proof_crawled_at:   proofCacheAt,
      rules_total:        rulesTotal,
      rules_certified:    certifiedTotal,
      rules_with_code:    certifiedWithCode,
      rules_without_code: certifiedTotal - certifiedWithCode,
      coverage_pct:       coveragePct,
      passing,
      threshold_pct:      threshold,
      note: annotations.length === 0
        ? 'Annotation sweep not started. Coverage is honest at 0%.'
        : undefined,
      matrix:                    filteredMatrix,
      unimplemented_rules:       matrix.filter(r => !r.verified && r.status === 'certified').map(r => r.rule_id),
      orphan_annotations:        orphanAnnotations,
      capabilities_without_rules: capabilitiesWithoutRules,
      chain: {
        backend:  { coverage_pct: coveragePct, passing },
        bff:      { coverage_pct: null, note: 'BFF layer not yet registered' },
        frontend: { coverage_pct: null, note: 'Frontend layer not yet registered' },
        chain_complete: false,
      },
      ...(accountabilitySummary ? { accountability_summary: accountabilitySummary } : {}),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PROOF history — coverage trend (stub) ─────────────────────────────────────
// @rule:FRJ-P-007  PROOF snapshots retained for 90 days minimum
forjaRouter.get('/api/v2/forja/proof/history', async (_req: Request, res: Response) => {
  res.json({
    service:   'mari8x-community',
    snapshots: [],
    note:      'Snapshot persistence — pending implementation.',
  });
});
