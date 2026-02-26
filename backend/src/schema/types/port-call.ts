/**
 * Mari8X Port Call — Pothos GraphQL Types
 *
 * Queries:
 *   portCall(portCallId: String!): PortCallRecord
 *   portCallsByPort(portCode, activeOnly): [PortCallRecord!]!
 *   portCallsByVoyage(voyageId): [PortCallRecord!]!
 *   portCallDashboard: PortCallDashboard!
 *
 * Mutations:
 *   openPortCall(input: PortCallInput!): PortCallRecord!
 *   advancePortCall(portCallId, notes, updatedBy): PortCallRecord!
 *   setPortCallStage(portCallId, stage, notes, updatedBy): PortCallRecord!
 *   setDAEstimate(portCallId, da: DAInput!): PortCallRecord!
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import { builder } from '../builder.js';
import {
  openPortCall, advancePortCall, setPortCallStage, setDAEstimate,
  getPortCall, getPortCallsByVoyage, listPortCallsByPort, listAllPortCalls,
  getPortCallDashboard,
  type PortCallRecord, type PortCallEvent, type DAEstimate, type PortCallDashboard,
} from '../../agent/port-call.js';

// ── Object types ──────────────────────────────────────────────────────────────

const PortCallEventType = builder.objectRef<PortCallEvent>('PortCallEvent').implement({
  fields: t => ({
    stage:     t.exposeString('stage'),
    timestamp: t.exposeString('timestamp'),
    notes:     t.exposeString('notes', { nullable: true }),
    updatedBy: t.exposeString('updatedBy'),
  }),
});

const DAEstimateType = builder.objectRef<DAEstimate>('DAEstimate').implement({
  fields: t => ({
    portDuesUsd:  t.exposeFloat('portDuesUsd'),
    pilotageUsd:  t.exposeFloat('pilotageUsd'),
    towageUsd:    t.exposeFloat('towageUsd'),
    agencyFeeUsd: t.exposeFloat('agencyFeeUsd'),
    miscUsd:      t.exposeFloat('miscUsd'),
    totalUsd:     t.exposeFloat('totalUsd'),
    currency:     t.exposeString('currency'),
    estimatedAt:  t.exposeString('estimatedAt'),
  }),
});

const PortCallRecordType = builder.objectRef<PortCallRecord>('PortCallRecord').implement({
  fields: t => ({
    portCallId:   t.exposeString('portCallId'),
    voyageId:     t.exposeString('voyageId'),
    vesselName:   t.exposeString('vesselName'),
    vesselIMO:    t.exposeString('vesselIMO', { nullable: true }),
    portCode:     t.exposeString('portCode'),
    portName:     t.exposeString('portName', { nullable: true }),
    eta:          t.exposeString('eta', { nullable: true }),
    ata:          t.exposeString('ata', { nullable: true }),
    atd:          t.exposeString('atd', { nullable: true }),
    currentStage: t.exposeString('currentStage'),
    events:       t.field({ type: [PortCallEventType], resolve: r => r.events }),
    da:           t.field({ type: DAEstimateType, nullable: true, resolve: r => r.da }),
    createdAt:    t.exposeString('createdAt'),
    updatedAt:    t.exposeString('updatedAt'),
  }),
});

interface PCByStage {
  NOA_RECEIVED: number; BERTHING_REQUESTED: number; BERTHED: number;
  CARGO_OPS: number; DEPARTURE_CLEARED: number; DEPARTED: number;
}

interface PCDashboard {
  total: number; byStage: PCByStage;
  activePorts: string[]; berthUtilizationPct: number; recentDepartures: number;
}

const PortCallByStageType = builder.objectRef<PCByStage>('PortCallByStage').implement({
  fields: t => ({
    NOA_RECEIVED:       t.exposeInt('NOA_RECEIVED'),
    BERTHING_REQUESTED: t.exposeInt('BERTHING_REQUESTED'),
    BERTHED:            t.exposeInt('BERTHED'),
    CARGO_OPS:          t.exposeInt('CARGO_OPS'),
    DEPARTURE_CLEARED:  t.exposeInt('DEPARTURE_CLEARED'),
    DEPARTED:           t.exposeInt('DEPARTED'),
  }),
});

const PortCallDashboardType = builder.objectRef<PCDashboard>('PortCallDashboard').implement({
  fields: t => ({
    total:               t.exposeInt('total'),
    byStage:             t.field({ type: PortCallByStageType, resolve: r => r.byStage as PCByStage }),
    activePorts:         t.field({ type: ['String'], resolve: r => r.activePorts }),
    berthUtilizationPct: t.exposeInt('berthUtilizationPct'),
    recentDepartures:    t.exposeInt('recentDepartures'),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('portCall', t =>
  t.field({
    type:     PortCallRecordType,
    nullable: true,
    args:     { portCallId: t.arg.string({ required: true }) },
    resolve:  (_, { portCallId }) => getPortCall(portCallId),
  })
);

builder.queryField('portCallsByPort', t =>
  t.field({
    type:    [PortCallRecordType],
    args:    {
      portCode:   t.arg.string({ required: true }),
      activeOnly: t.arg.boolean(),
    },
    resolve: (_, { portCode, activeOnly }) =>
      listPortCallsByPort(portCode, activeOnly ?? false),
  })
);

builder.queryField('portCallsByVoyage', t =>
  t.field({
    type:    [PortCallRecordType],
    args:    { voyageId: t.arg.string({ required: true }) },
    resolve: (_, { voyageId }) => getPortCallsByVoyage(voyageId),
  })
);

builder.queryField('portCalls', t =>
  t.field({
    type:    [PortCallRecordType],
    args:    { activeOnly: t.arg.boolean() },
    resolve: (_, { activeOnly }) => listAllPortCalls(activeOnly ?? false),
  })
);

builder.queryField('portCallDashboard', t =>
  t.field({
    type:    PortCallDashboardType,
    resolve: () => getPortCallDashboard() as PCDashboard,
  })
);

// ── Inputs ────────────────────────────────────────────────────────────────────

const PortCallInputType = builder.inputType('PortCallInput', {
  fields: t => ({
    voyageId:   t.string({ required: true }),
    vesselName: t.string({ required: true }),
    vesselIMO:  t.string(),
    portCode:   t.string({ required: true }),
    portName:   t.string(),
    eta:        t.string(),
    notes:      t.string(),
    updatedBy:  t.string(),
  }),
});

const DAInputType = builder.inputType('DAInput', {
  fields: t => ({
    portDuesUsd:  t.float({ required: true }),
    pilotageUsd:  t.float({ required: true }),
    towageUsd:    t.float({ required: true }),
    agencyFeeUsd: t.float({ required: true }),
    miscUsd:      t.float({ required: true }),
    totalUsd:     t.float({ required: true }),
    currency:     t.string(),
  }),
});

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('openPortCall', t =>
  t.field({
    type:    PortCallRecordType,
    args:    { input: t.arg({ type: PortCallInputType, required: true }) },
    resolve: (_, { input }) => openPortCall(input as any),
  })
);

builder.mutationField('advancePortCall', t =>
  t.field({
    type:    PortCallRecordType,
    args:    {
      portCallId: t.arg.string({ required: true }),
      notes:      t.arg.string(),
      updatedBy:  t.arg.string(),
    },
    resolve: (_, { portCallId, notes, updatedBy }) =>
      advancePortCall(portCallId, { notes: notes ?? null, updatedBy: updatedBy ?? 'system' }),
  })
);

builder.mutationField('setPortCallStage', t =>
  t.field({
    type:    PortCallRecordType,
    args:    {
      portCallId: t.arg.string({ required: true }),
      stage:      t.arg.string({ required: true }),
      notes:      t.arg.string(),
      updatedBy:  t.arg.string(),
    },
    resolve: (_, { portCallId, stage, notes, updatedBy }) =>
      setPortCallStage(portCallId, stage as any, { notes: notes ?? null, updatedBy: updatedBy ?? 'system' }),
  })
);

builder.mutationField('setDAEstimate', t =>
  t.field({
    type:    PortCallRecordType,
    args:    {
      portCallId: t.arg.string({ required: true }),
      da:         t.arg({ type: DAInputType, required: true }),
    },
    resolve: (_, { portCallId, da }) => setDAEstimate(portCallId, {
      portDuesUsd:  da.portDuesUsd,
      pilotageUsd:  da.pilotageUsd,
      towageUsd:    da.towageUsd,
      agencyFeeUsd: da.agencyFeeUsd,
      miscUsd:      da.miscUsd,
      totalUsd:     da.totalUsd,
      currency:     da.currency ?? 'USD',
    }),
  })
);
