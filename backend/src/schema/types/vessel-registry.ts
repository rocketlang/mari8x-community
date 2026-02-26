/**
 * Vessel Registry — GraphQL types (Pothos schema builder)
 *
 * Queries:
 *   vessel(imo: String!)       → VesselParticulars
 *   vessels(type?, flag?)      → [VesselParticulars]
 *   searchVessels(query)       → [VesselParticulars]
 *   vesselRegistryStats        → VesselRegistryStats
 *
 * Mutations:
 *   registerVessel(input)      → VesselParticulars
 *   updateVessel(imo, input)   → VesselParticulars
 *   importVesselsFromPortCalls → ImportResult
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import { builder } from '../builder.js';
import {
  registerVessel, getVessel, searchVessels, listVessels,
  updateVessel, bulkImportFromPortCalls, getRegistryStats,
  type VesselParticulars,
} from '../../agent/vessel-registry.js';

// ── Object types ──────────────────────────────────────────────────────────────

const VesselParticularsType = builder.objectRef<VesselParticulars>('VesselParticulars').implement({
  fields: t => ({
    imo:          t.exposeString('imo'),
    name:         t.exposeString('name'),
    mmsi:         t.exposeString('mmsi',         { nullable: true }),
    callSign:     t.exposeString('callSign',      { nullable: true }),
    flag:         t.exposeString('flag',          { nullable: true }),
    type:         t.exposeString('type'),
    dwt:          t.exposeFloat('dwt',            { nullable: true }),
    gt:           t.exposeFloat('gt',             { nullable: true }),
    builtYear:    t.exposeInt('builtYear',        { nullable: true }),
    classSociety: t.exposeString('classSociety',  { nullable: true }),
    owner:        t.exposeString('owner',         { nullable: true }),
    operator:     t.exposeString('operator',      { nullable: true }),
    registeredAt: t.exposeString('registeredAt'),
    updatedAt:    t.exposeString('updatedAt'),
  }),
});

const VesselRegistryStatsType = builder.objectRef<ReturnType<typeof getRegistryStats>>('VesselRegistryStats').implement({
  fields: t => ({
    total:    t.exposeInt('total'),
    withDWT:  t.exposeInt('withDWT'),
    withMMSI: t.exposeInt('withMMSI'),
    byType:   t.field({ type: 'String', resolve: r => JSON.stringify(r.byType) }),
  }),
});

const ImportResultType = builder.objectRef<{ imported: number; skipped: number }>('VesselImportResult').implement({
  fields: t => ({
    imported: t.exposeInt('imported'),
    skipped:  t.exposeInt('skipped'),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('vessel', t =>
  t.field({
    type:     VesselParticularsType,
    nullable: true,
    args:     { imo: t.arg.string({ required: true }) },
    resolve:  (_, { imo }) => getVessel(imo),
  })
);

builder.queryField('vessels', t =>
  t.field({
    type:    [VesselParticularsType],
    args:    {
      type: t.arg.string({ required: false }),
      flag: t.arg.string({ required: false }),
    },
    resolve: (_, { type, flag }) => listVessels({ type: type as any, flag: flag ?? undefined }),
  })
);

builder.queryField('searchVessels', t =>
  t.field({
    type:    [VesselParticularsType],
    args:    { query: t.arg.string({ required: true }) },
    resolve: (_, { query }) => searchVessels(query),
  })
);

builder.queryField('vesselRegistryStats', t =>
  t.field({
    type:    VesselRegistryStatsType,
    resolve: () => getRegistryStats(),
  })
);

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('registerVessel', t =>
  t.field({
    type:    VesselParticularsType,
    args:    {
      imo:          t.arg.string({ required: true }),
      name:         t.arg.string({ required: true }),
      mmsi:         t.arg.string({ required: false }),
      callSign:     t.arg.string({ required: false }),
      flag:         t.arg.string({ required: false }),
      type:         t.arg.string({ required: false }),
      dwt:          t.arg.float({ required: false }),
      gt:           t.arg.float({ required: false }),
      builtYear:    t.arg.int({ required: false }),
      classSociety: t.arg.string({ required: false }),
      owner:        t.arg.string({ required: false }),
      operator:     t.arg.string({ required: false }),
    },
    resolve: (_, args) => registerVessel({ ...args, type: args.type as any }),
  })
);

builder.mutationField('importVesselsFromPortCalls', t =>
  t.field({
    type:    ImportResultType,
    resolve: () => bulkImportFromPortCalls(),
  })
);
