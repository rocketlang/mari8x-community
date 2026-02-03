/**
 * Port GraphQL Types - Community Edition
 */

import { builder } from '../builder.js';

// Port type
builder.prismaObject('Port', {
  fields: (t) => ({
    id: t.exposeID('id'),
    unlocode: t.exposeString('unlocode'),
    name: t.exposeString('name'),
    country: t.exposeString('country'),
    lat: t.exposeFloat('lat', { nullable: true }),
    lng: t.exposeFloat('lng', { nullable: true }),
  }),
});

// Queries
builder.queryFields((t) => ({
  // Get port by UNLOCODE
  port: t.prismaField({
    type: 'Port',
    nullable: true,
    args: {
      unlocode: t.arg.string({ required: true }),
    },
    resolve: async (query, _, args, ctx) => {
      return ctx.prisma.port.findUnique({
        ...query,
        where: { unlocode: args.unlocode },
      });
    },
  }),

  // List ports
  ports: t.prismaField({
    type: ['Port'],
    args: {
      take: t.arg.int({ defaultValue: 50 }),
      skip: t.arg.int({ defaultValue: 0 }),
      search: t.arg.string({ required: false }),
    },
    resolve: async (query, _, args, ctx) => {
      return ctx.prisma.port.findMany({
        ...query,
        where: args.search
          ? {
              OR: [
                { name: { contains: args.search, mode: 'insensitive' } },
                { unlocode: { contains: args.search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        take: args.take,
        skip: args.skip,
        orderBy: { name: 'asc' },
      });
    },
  }),
}));
