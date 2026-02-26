/**
 * ETA GraphQL types — Pothos schema builder
 */

import { builder } from '../builder.js'
import {
  upsertETA, getETA, listETAsByPort, listAllETAs, getETADashboard, markArrived,
  type EtaRecord, type EtaHistoryEntry,
} from '../../agent/eta.js'

// ── Object types ──────────────────────────────────────────────────────────────

const EtaHistoryType = builder.objectRef<EtaHistoryEntry>('EtaHistoryEntry').implement({
  fields: t => ({
    eta:       t.exposeString('eta'),
    source:    t.exposeString('source'),
    updatedAt: t.exposeString('updatedAt'),
    delta:     t.exposeInt('delta', { nullable: true }),
  }),
})

const EtaRecordType = builder.objectRef<EtaRecord>('EtaRecord').implement({
  fields: t => ({
    voyageId:    t.exposeString('voyageId'),
    vesselName:  t.exposeString('vesselName'),
    vesselIMO:   t.exposeString('vesselIMO', { nullable: true }),
    portCode:    t.exposeString('portCode'),
    portName:    t.exposeString('portName', { nullable: true }),
    originalETA: t.exposeString('originalETA'),
    currentETA:  t.exposeString('currentETA'),
    status:      t.exposeString('status'),
    deltaMins:   t.exposeInt('deltaMins'),
    source:      t.exposeString('source'),
    remarks:     t.exposeString('remarks', { nullable: true }),
    history:     t.field({ type: [EtaHistoryType], resolve: r => r.history }),
    createdAt:   t.exposeString('createdAt'),
    updatedAt:   t.exposeString('updatedAt'),
  }),
})

interface EtaPortGroup { portCode: string; today: number; tomorrow: number; overdue: number; delayed: number }
interface EtaDashboard { totalVessels: number; totalPorts: number; arrivingToday: number; arrivingTomorrow: number; delayed: number; overdue: number; ports: EtaPortGroup[] }

const EtaPortGroupType = builder.objectRef<EtaPortGroup>('EtaPortGroup').implement({
  fields: t => ({
    portCode:  t.exposeString('portCode'),
    today:     t.exposeInt('today'),
    tomorrow:  t.exposeInt('tomorrow'),
    overdue:   t.exposeInt('overdue'),
    delayed:   t.exposeInt('delayed'),
  }),
})

const EtaDashboardType = builder.objectRef<EtaDashboard>('EtaDashboard').implement({
  fields: t => ({
    totalVessels:     t.exposeInt('totalVessels'),
    totalPorts:       t.exposeInt('totalPorts'),
    arrivingToday:    t.exposeInt('arrivingToday'),
    arrivingTomorrow: t.exposeInt('arrivingTomorrow'),
    delayed:          t.exposeInt('delayed'),
    overdue:          t.exposeInt('overdue'),
    ports:            t.field({ type: [EtaPortGroupType], resolve: r => r.ports }),
  }),
})

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('etaRecord', t =>
  t.field({
    type:     EtaRecordType,
    nullable: true,
    args:     { voyageId: t.arg.string({ required: true }) },
    resolve:  (_, { voyageId }) => getETA(voyageId),
  })
)

builder.queryField('etaByPort', t =>
  t.field({
    type:    [EtaRecordType],
    args:    { portCode: t.arg.string({ required: true }) },
    resolve: (_, { portCode }) => listETAsByPort(portCode),
  })
)

builder.queryField('etaDashboard', t =>
  t.field({
    type:    EtaDashboardType,
    resolve: () => getETADashboard(),
  })
)

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('upsertETA', t =>
  t.field({
    type: EtaRecordType,
    args: {
      voyageId:   t.arg.string({ required: true }),
      vesselName: t.arg.string({ required: true }),
      vesselIMO:  t.arg.string(),
      portCode:   t.arg.string({ required: true }),
      portName:   t.arg.string(),
      eta:        t.arg.string({ required: true }),
      source:     t.arg.string(),
      remarks:    t.arg.string(),
    },
    resolve: (_, args) => upsertETA({
      voyageId:   args.voyageId,
      vesselName: args.vesselName,
      vesselIMO:  args.vesselIMO ?? undefined,
      portCode:   args.portCode,
      portName:   args.portName ?? undefined,
      eta:        args.eta,
      source:     args.source ?? undefined,
      remarks:    args.remarks ?? undefined,
    }),
  })
)

builder.mutationField('markArrived', t =>
  t.field({
    type:     EtaRecordType,
    nullable: true,
    args:     {
      voyageId: t.arg.string({ required: true }),
      remarks:  t.arg.string(),
    },
    resolve: (_, { voyageId, remarks }) => markArrived(voyageId, remarks ?? undefined),
  })
)
