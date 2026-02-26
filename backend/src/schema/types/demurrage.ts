/**
 * Mari8X Demurrage & Detention — Pothos GraphQL Types
 *
 * Queries:
 *   ddRecord(blNumber: String!): DDRecord
 *   ddRecords(portCode, status, limit): [DDRecord!]!
 *   ddDashboard: DDDashboard!
 *   ddAlerts: [DDRecord!]!
 *
 * Mutations:
 *   upsertDD(input: DDInput!): DDRecord!
 *   clearDD(blNumber, returnDate): DDRecord!
 *   refreshDD: [DDRecord!]!
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import { builder } from '../builder.js';
import {
  upsertDD, getDD, clearDD, listAllDD, listDDByPort,
  getDDAlerts, getDDDashboard, refreshAllDD,
  type DDRecord, type DDContainerDetail, type DDDashboard,
} from '../../agent/demurrage.js';

// ── Object types ──────────────────────────────────────────────────────────────

const DDContainerType = builder.objectRef<DDContainerDetail>('DDContainer').implement({
  fields: t => ({
    containerNumber:  t.exposeString('containerNumber'),
    isoType:          t.exposeString('isoType', { nullable: true }),
    dischargeDate:    t.exposeString('dischargeDate'),
    deliveryDate:     t.exposeString('deliveryDate', { nullable: true }),
    returnDate:       t.exposeString('returnDate', { nullable: true }),
    demurrageDays:    t.exposeInt('demurrageDays'),
    detentionDays:    t.exposeInt('detentionDays'),
    demurrageAmt:     t.exposeFloat('demurrageAmt'),
    detentionAmt:     t.exposeFloat('detentionAmt'),
    totalAmt:         t.exposeFloat('totalAmt'),
  }),
});

const DDRecordType = builder.objectRef<DDRecord>('DDRecord').implement({
  fields: t => ({
    blNumber:             t.exposeString('blNumber'),
    portCode:             t.exposeString('portCode'),
    carrierCode:          t.exposeString('carrierCode', { nullable: true }),
    vesselName:           t.exposeString('vesselName', { nullable: true }),
    voyageNumber:         t.exposeString('voyageNumber', { nullable: true }),
    status:               t.exposeString('status'),
    totalLiabilityUsd:    t.exposeFloat('totalLiabilityUsd'),
    alertThresholdUsd:    t.exposeFloat('alertThresholdUsd'),
    alertFired:           t.exposeBoolean('alertFired'),
    containers:           t.field({ type: [DDContainerType], resolve: r => r.containers }),
    createdAt:            t.exposeString('createdAt'),
    updatedAt:            t.exposeString('updatedAt'),
  }),
});

interface DDDashboardType {
  totalBLs: number; openBLs: number; totalLiabilityUsd: number;
  demurrageLiabilityUsd: number; detentionLiabilityUsd: number;
  alertCount: number; clearedBLs: number;
}

const DDDashboardType = builder.objectRef<DDDashboardType>('DDDashboard').implement({
  fields: t => ({
    totalBLs:              t.exposeInt('totalBLs'),
    openBLs:               t.exposeInt('openBLs'),
    totalLiabilityUsd:     t.exposeFloat('totalLiabilityUsd'),
    demurrageLiabilityUsd: t.exposeFloat('demurrageLiabilityUsd'),
    detentionLiabilityUsd: t.exposeFloat('detentionLiabilityUsd'),
    alertCount:            t.exposeInt('alertCount'),
    clearedBLs:            t.exposeInt('clearedBLs'),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('ddRecord', t =>
  t.field({
    type:     DDRecordType,
    nullable: true,
    args:     { blNumber: t.arg.string({ required: true }) },
    resolve:  (_, { blNumber }) => getDD(blNumber),
  })
);

builder.queryField('ddRecords', t =>
  t.field({
    type:    [DDRecordType],
    args:    {
      portCode: t.arg.string(),
      status:   t.arg.string(),
      limit:    t.arg.int(),
    },
    resolve: (_, { portCode, status, limit }) => {
      let records = portCode ? listDDByPort(portCode) : listAllDD();
      if (status)  records = records.filter(r => r.status === status);
      if (limit)   records = records.slice(0, limit);
      return records;
    },
  })
);

builder.queryField('ddDashboard', t =>
  t.field({
    type:    DDDashboardType,
    resolve: () => getDDDashboard() as DDDashboardType,
  })
);

builder.queryField('ddAlerts', t =>
  t.field({
    type:    [DDRecordType],
    resolve: () => getDDAlerts(),
  })
);

// ── Input ─────────────────────────────────────────────────────────────────────

const DDContainerInput = builder.inputType('DDContainerInput', {
  fields: t => ({
    containerNumber: t.string({ required: true }),
    isoType:         t.string(),
    dischargeDate:   t.string({ required: true }),
    deliveryDate:    t.string(),
    returnDate:      t.string(),
  }),
});

const DDRulesInput = builder.inputType('DDRulesInput', {
  fields: t => ({
    freeDaysDemurrage:   t.int(),
    demurrageRatePerDay: t.float(),
    freeDaysDetention:   t.int(),
    detentionRatePerDay: t.float(),
  }),
});

const DDInput = builder.inputType('DDInput', {
  fields: t => ({
    blNumber:          t.string({ required: true }),
    portCode:          t.string({ required: true }),
    carrierCode:       t.string(),
    vesselName:        t.string(),
    voyageNumber:      t.string(),
    containers:        t.field({ type: [DDContainerInput], required: true }),
    rules:             t.field({ type: DDRulesInput }),
    alertThresholdUsd: t.float(),
  }),
});

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('upsertDD', t =>
  t.field({
    type:    DDRecordType,
    args:    { input: t.arg({ type: DDInput, required: true }) },
    resolve: (_, { input }) => upsertDD(input as any),
  })
);

builder.mutationField('clearDD', t =>
  t.field({
    type:     DDRecordType,
    nullable: true,
    args:     {
      blNumber:   t.arg.string({ required: true }),
      returnDate: t.arg.string(),
    },
    resolve: (_, { blNumber, returnDate }) => clearDD(blNumber, returnDate ?? undefined),
  })
);

builder.mutationField('refreshDD', t =>
  t.field({
    type:    [DDRecordType],
    resolve: () => refreshAllDD(),
  })
);
