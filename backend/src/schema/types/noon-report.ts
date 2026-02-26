/**
 * Noon Report — GraphQL types (Pothos schema builder)
 *
 * Queries:
 *   noonReports(vesselId, voyageNumber?)  → [NoonReport]
 *   latestNoonReport(vesselId)            → NoonReport
 *   voyageSummary(vesselId, voyageNumber) → VoyageSummary
 *
 * Mutations:
 *   submitNoonReport(input)               → NoonReport
 *     ↳ also upserts ETA tracker with etaNextPort
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import { builder } from '../builder.js';
import {
  submitNoonReport, getNoonReports, getLatestNoonReport, getVoyageSummary,
  type NoonReport, type NoonReportInput,
} from '../../agent/noon-report.js';
import { upsertETA } from '../../agent/eta.js';

// ── Object types ──────────────────────────────────────────────────────────────

const NoonReportType = builder.objectRef<NoonReport>('NoonReport').implement({
  fields: t => ({
    id:                   t.exposeString('id'),
    vesselId:             t.exposeString('vesselId'),
    vesselName:           t.exposeString('vesselName'),
    voyageNumber:         t.exposeString('voyageNumber'),
    reportDate:           t.exposeString('reportDate'),
    reportTime:           t.exposeString('reportTime'),
    latDeg:               t.exposeFloat('latDeg'),
    latMin:               t.exposeFloat('latMin'),
    latDir:               t.exposeString('latDir'),
    lonDeg:               t.exposeFloat('lonDeg'),
    lonMin:               t.exposeFloat('lonMin'),
    lonDir:               t.exposeString('lonDir'),
    speedOverGround:      t.exposeFloat('speedOverGround'),
    courseOverGround:     t.exposeFloat('courseOverGround'),
    distanceSinceLast:    t.exposeFloat('distanceSinceLast'),
    distanceToGo:         t.exposeFloat('distanceToGo'),
    etaNextPort:          t.exposeString('etaNextPort'),
    nextPort:             t.exposeString('nextPort'),
    windForce:            t.exposeFloat('windForce'),
    windDirection:        t.exposeString('windDirection'),
    seaState:             t.exposeFloat('seaState'),
    swellHeight:          t.exposeFloat('swellHeight'),
    visibility:           t.exposeFloat('visibility'),
    fuelRobHfo:           t.exposeFloat('fuelRobHfo'),
    fuelRobMdo:           t.exposeFloat('fuelRobMdo'),
    fuelRobLsfo:          t.exposeFloat('fuelRobLsfo'),
    fuelConsumedHfo:      t.exposeFloat('fuelConsumedHfo'),
    fuelConsumedMdo:      t.exposeFloat('fuelConsumedMdo'),
    fuelConsumedLsfo:     t.exposeFloat('fuelConsumedLsfo'),
    cargoTons:            t.exposeFloat('cargoTons',        { nullable: true }),
    cargoDescription:     t.exposeString('cargoDescription', { nullable: true }),
    remarks:              t.exposeString('remarks',          { nullable: true }),
    masterName:           t.exposeString('masterName'),
    cumulativeDistanceNm: t.exposeFloat('cumulativeDistanceNm'),
    cumulativeFuelHfo:    t.exposeFloat('cumulativeFuelHfo'),
    createdAt:            t.exposeString('createdAt'),
  }),
});

const VoyageSummaryType = builder.objectRef<NonNullable<ReturnType<typeof getVoyageSummary>>>('VoyageSummary').implement({
  fields: t => ({
    vesselId:         t.exposeString('vesselId'),
    voyageNumber:     t.exposeString('voyageNumber'),
    reportDays:       t.exposeInt('reportDays'),
    totalDistanceNm:  t.exposeFloat('totalDistanceNm'),
    totalFuelHfoMt:   t.exposeFloat('totalFuelHfoMt'),
    totalFuelMdoMt:   t.exposeFloat('totalFuelMdoMt'),
    totalFuelLsfoMt:  t.exposeFloat('totalFuelLsfoMt'),
    avgSpeedKts:      t.exposeFloat('avgSpeedKts'),
    latestEta:        t.exposeString('latestEta'),
    firstReport:      t.exposeString('firstReport'),
    lastReport:       t.exposeString('lastReport'),
  }),
});

// ── Input type ────────────────────────────────────────────────────────────────

const NoonReportInputRef = builder.inputType('NoonReportInput', {
  fields: t => ({
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
    windForce:         t.float({ required: true }),
    windDirection:     t.string({ required: true }),
    seaState:          t.float({ required: true }),
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

builder.queryField('noonReports', t =>
  t.field({
    type:     [NoonReportType],
    args:     {
      vesselId:      t.arg.string({ required: true }),
      voyageNumber:  t.arg.string({ required: false }),
    },
    resolve: (_, { vesselId, voyageNumber }) =>
      getNoonReports(vesselId, voyageNumber ?? undefined),
  })
);

builder.queryField('latestNoonReport', t =>
  t.field({
    type:     NoonReportType,
    nullable: true,
    args:     { vesselId: t.arg.string({ required: true }) },
    resolve:  (_, { vesselId }) => getLatestNoonReport(vesselId),
  })
);

builder.queryField('voyageSummary', t =>
  t.field({
    type:     VoyageSummaryType,
    nullable: true,
    args:     {
      vesselId:     t.arg.string({ required: true }),
      voyageNumber: t.arg.string({ required: true }),
    },
    resolve: (_, { vesselId, voyageNumber }) => getVoyageSummary(vesselId, voyageNumber),
  })
);

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('submitNoonReport', t =>
  t.field({
    type:  NoonReportType,
    args:  { input: t.arg({ type: NoonReportInputRef, required: true }) },
    resolve: (_, { input }) => {
      const report = submitNoonReport(input as NoonReportInput);
      // Sync ETA tracker — non-blocking
      try {
        upsertETA({
          voyageId:   report.voyageNumber,
          vesselName: report.vesselName,
          portCode:   report.nextPort,
          eta:        report.etaNextPort,
          source:     'noon-report',
        });
      } catch { /* non-fatal */ }
      return report;
    },
  })
);
