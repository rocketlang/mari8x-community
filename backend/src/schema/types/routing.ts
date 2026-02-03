/**
 * Routing GraphQL Types - Community Edition
 */

import { builder } from '../builder.js';
import { prisma } from '../../lib/prisma.js';
import { haversineDistance, generateWaypoints } from '../../lib/geo-utils.js';

// Route result type
const RouteResult = builder.objectRef<{
  distanceNm: number;
  distanceKm: number;
  estimatedDays: number;
  estimatedHours: number;
  speedKnots: number;
  fromPort: { unlocode: string; name: string; lat: number; lng: number };
  toPort: { unlocode: string; name: string; lat: number; lng: number };
  waypoints: Array<{ lat: number; lng: number }>;
}>('RouteResult').implement({
  fields: (t) => ({
    distanceNm: t.exposeFloat('distanceNm'),
    distanceKm: t.exposeFloat('distanceKm'),
    estimatedDays: t.exposeFloat('estimatedDays'),
    estimatedHours: t.exposeFloat('estimatedHours'),
    speedKnots: t.exposeFloat('speedKnots'),
    fromPort: t.field({
      type: 'JSON',
      resolve: (parent) => parent.fromPort,
    }),
    toPort: t.field({
      type: 'JSON',
      resolve: (parent) => parent.toPort,
    }),
    waypoints: t.field({
      type: ['JSON'],
      resolve: (parent) => parent.waypoints,
    }),
  }),
});

// Queries
builder.queryFields((t) => ({
  // Calculate great circle route
  calculateRoute: t.field({
    type: RouteResult,
    args: {
      fromUnlocode: t.arg.string({ required: true }),
      toUnlocode: t.arg.string({ required: true }),
      speedKnots: t.arg.float({ defaultValue: 14 }),
    },
    resolve: async (_, args) => {
      // Get ports
      const fromPort = await prisma.port.findUnique({
        where: { unlocode: args.fromUnlocode },
      });
      const toPort = await prisma.port.findUnique({
        where: { unlocode: args.toUnlocode },
      });

      if (!fromPort || !toPort || !fromPort.lat || !toPort.lat) {
        throw new Error('Port not found or missing coordinates');
      }

      // Calculate distance
      const distanceNm = haversineDistance(
        fromPort.lat,
        fromPort.lng!,
        toPort.lat,
        toPort.lng!
      );

      const distanceKm = distanceNm * 1.852;
      const estimatedHours = distanceNm / args.speedKnots;
      const estimatedDays = estimatedHours / 24;

      // Generate waypoints
      const waypoints = generateWaypoints(
        fromPort.lat,
        fromPort.lng!,
        toPort.lat,
        toPort.lng!,
        20
      );

      return {
        distanceNm,
        distanceKm,
        estimatedDays,
        estimatedHours,
        speedKnots: args.speedKnots,
        fromPort: {
          unlocode: fromPort.unlocode,
          name: fromPort.name,
          lat: fromPort.lat,
          lng: fromPort.lng!,
        },
        toPort: {
          unlocode: toPort.unlocode,
          name: toPort.name,
          lat: toPort.lat,
          lng: toPort.lng!,
        },
        waypoints,
      };
    },
  }),
}));
