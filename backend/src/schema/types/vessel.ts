/**
 * Vessel GraphQL Types - Community Edition
 */

import { builder } from '../builder.js';

// Vessel type
builder.prismaObject('Vessel', {
  fields: (t) => ({
    id: t.exposeID('id'),
    imo: t.exposeString('imo'),
    name: t.exposeString('name'),
    type: t.exposeString('type'),
    flag: t.exposeString('flag'),
    mmsi: t.exposeString('mmsi', { nullable: true }),
    dwt: t.exposeFloat('dwt', { nullable: true }),
    yearBuilt: t.exposeInt('yearBuilt', { nullable: true }),
    positions: t.relation('positions', {
      args: {
        take: t.arg.int({ defaultValue: 100 }),
        orderBy: t.arg({ type: 'JSON', required: false }),
      },
    }),
  }),
});

// VesselPosition type
builder.prismaObject('VesselPosition', {
  fields: (t) => ({
    id: t.exposeID('id'),
    latitude: t.exposeFloat('latitude'),
    longitude: t.exposeFloat('longitude'),
    speed: t.exposeFloat('speed', { nullable: true }),
    course: t.exposeFloat('course', { nullable: true }),
    heading: t.exposeFloat('heading', { nullable: true }),
    timestamp: t.expose('timestamp', { type: 'DateTime' }),
    navigationStatus: t.exposeInt('navigationStatus', { nullable: true }),
    vessel: t.relation('vessel'),
  }),
});

// Queries
builder.queryFields((t) => ({
  // Get vessel by IMO
  vessel: t.prismaField({
    type: 'Vessel',
    nullable: true,
    args: {
      imo: t.arg.string({ required: true }),
    },
    resolve: async (query, _, args, ctx) => {
      return ctx.prisma.vessel.findUnique({
        ...query,
        where: { imo: args.imo },
      });
    },
  }),

  // List vessels
  vessels: t.prismaField({
    type: ['Vessel'],
    args: {
      take: t.arg.int({ defaultValue: 20 }),
      skip: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (query, _, args, ctx) => {
      return ctx.prisma.vessel.findMany({
        ...query,
        take: args.take,
        skip: args.skip,
        orderBy: { name: 'asc' },
      });
    },
  }),
}));
