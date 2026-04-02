/**
 * AmosConnect GraphQL Types — Noon Reports + Crew Welfare
 * Pothos code-first schema, consistent with agent.ts pattern.
 */

import { builder } from '../builder.js';
import {
// @rule:M8X-001 — amosconnect
  submitNoonReport,
  getNoonReports,
  getLatestNoonReport,
  getVoyageSummary,
  type NoonReport,
  type NoonReportInput,
} from '../../agent/noon-report.js';
import {
  listCrew,
  addCrewMember,
  signOffCrew,
  recordRestPeriod,
  checkMLCCompliance,
  getDocumentAlerts,
  getCrewSummary,
} from '../../agent/crew-welfare.js';

// ── Noon Report types ─────────────────────────────────────────────────────────

const NoonReportType = builder.objectRef<NoonReport>('NoonReport').implement({
  fields: (t) => ({
    id:                   t.exposeString('id'),
    vesselId:             t.exposeString('vesselId'),
    vesselName:           t.exposeString('vesselName'),
    voyageNumber:         t.exposeString('voyageNumber'),
    reportDate:           t.exposeString('reportDate'),
    reportTime:           t.exposeString('reportTime'),
    speedOverGround:      t.exposeFloat('speedOverGround'),
    courseOverGround:     t.exposeFloat('courseOverGround'),
    distanceSinceLast:    t.exposeFloat('distanceSinceLast'),
    distanceToGo:         t.exposeFloat('distanceToGo'),
    etaNextPort:          t.exposeString('etaNextPort'),
    nextPort:             t.exposeString('nextPort'),
    fuelRobHfo:           t.exposeFloat('fuelRobHfo'),
    fuelRobMdo:           t.exposeFloat('fuelRobMdo'),
    fuelConsumedHfo:      t.exposeFloat('fuelConsumedHfo'),
    windForce:            t.exposeInt('windForce'),
    windDirection:        t.exposeString('windDirection'),
    seaState:             t.exposeInt('seaState'),
    remarks:              t.exposeString('remarks', { nullable: true }),
    masterName:           t.exposeString('masterName'),
    cumulativeDistanceNm: t.exposeFloat('cumulativeDistanceNm'),
    cumulativeFuelHfo:    t.exposeFloat('cumulativeFuelHfo'),
    createdAt:            t.exposeString('createdAt'),
  }),
});

const VoyageSummaryType = builder.objectRef<ReturnType<typeof getVoyageSummary> & {}>('VoyageSummary').implement({
  fields: (t) => ({
    vesselId:        t.field({ type: 'JSON', resolve: (p) => (p as any).vesselId }),
    voyageNumber:    t.field({ type: 'JSON', resolve: (p) => (p as any).voyageNumber }),
    reportDays:      t.field({ type: 'JSON', resolve: (p) => (p as any).reportDays }),
    totalDistanceNm: t.field({ type: 'JSON', resolve: (p) => (p as any).totalDistanceNm }),
    totalFuelHfoMt:  t.field({ type: 'JSON', resolve: (p) => (p as any).totalFuelHfoMt }),
    avgSpeedKts:     t.field({ type: 'JSON', resolve: (p) => (p as any).avgSpeedKts }),
    latestEta:       t.field({ type: 'JSON', resolve: (p) => (p as any).latestEta }),
    firstReport:     t.field({ type: 'JSON', resolve: (p) => (p as any).firstReport }),
    lastReport:      t.field({ type: 'JSON', resolve: (p) => (p as any).lastReport }),
  }),
});

// ── Noon Report input ─────────────────────────────────────────────────────────

const NoonReportInputType = builder.inputType('NoonReportInput', {
  fields: (t) => ({
    vesselId:          t.string({ required: true }),
    vesselName:        t.string({ required: true }),
    voyageNumber:      t.string({ required: true }),
    reportDate:        t.string({ required: true }),
    reportTime:        t.string({ required: true }),
    latDeg:            t.float({ required: true }),
    latMin:            t.float({ required: true }),
    latDir:            t.string({ required: true }),
    lonDeg:            t.float({ required: true }),
    lonMin:            t.float({ required: true }),
    lonDir:            t.string({ required: true }),
    speedOverGround:   t.float({ required: true }),
    courseOverGround:  t.float({ required: true }),
    distanceSinceLast: t.float({ required: true }),
    distanceToGo:      t.float({ required: true }),
    etaNextPort:       t.string({ required: true }),
    nextPort:          t.string({ required: true }),
    windForce:         t.int({ required: true }),
    windDirection:     t.string({ required: true }),
    seaState:          t.int({ required: true }),
    swellHeight:       t.float({ required: true }),
    visibility:        t.float({ required: true }),
    fuelRobHfo:        t.float({ required: true }),
    fuelRobMdo:        t.float({ required: true }),
    fuelRobLsfo:       t.float({ required: true }),
    fuelConsumedHfo:   t.float({ required: true }),
    fuelConsumedMdo:   t.float({ required: true }),
    fuelConsumedLsfo:  t.float({ required: true }),
    cargoTons:         t.float({ required: false }),
    cargoDescription:  t.string({ required: false }),
    remarks:           t.string({ required: false }),
    masterName:        t.string({ required: true }),
    masterEmail:       t.string({ required: false }),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryFields((t) => ({
  noonReports: t.field({
    type: [NoonReportType],
    args: {
      vesselId:      t.arg.string({ required: true }),
      voyageNumber:  t.arg.string({ required: false }),
    },
    resolve: (_, args) => getNoonReports(args.vesselId, args.voyageNumber ?? undefined),
  }),

  latestNoonReport: t.field({
    type: NoonReportType,
    nullable: true,
    args: { vesselId: t.arg.string({ required: true }) },
    resolve: (_, args) => getLatestNoonReport(args.vesselId),
  }),

  voyageSummary: t.field({
    type: 'JSON',
    args: {
      vesselId:     t.arg.string({ required: true }),
      voyageNumber: t.arg.string({ required: true }),
    },
    resolve: (_, args) => getVoyageSummary(args.vesselId, args.voyageNumber),
  }),

  crewList: t.field({
    type: ['JSON'],
    args: {
      vesselId:    t.arg.string({ required: true }),
      onboardOnly: t.arg.boolean({ required: false }),
    },
    resolve: (_, args) => listCrew(args.vesselId, args.onboardOnly ?? true) as any[],
  }),

  // mlcCompliance removed: owned by crew-welfare.ts (full MLC 2006 implementation)
  // documentAlerts removed: owned by crew-welfare.ts
  // crewSummary removed: owned by crew-welfare.ts
}));

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationFields((t) => ({
  submitNoonReport: t.field({
    type: NoonReportType,
    args: { input: t.arg({ type: NoonReportInputType, required: true }) },
    resolve: (_, args) => submitNoonReport(args.input as NoonReportInput),
  }),

  // addCrewMember, signOffCrew, recordRestPeriod removed: owned by crew-welfare.ts
}));
