/**
 * Agent Wedge GraphQL Types - Community Edition
 *
 * Exposes the Agent Wedge REST intelligence as GraphQL queries:
 *   preArrival(portCode, window)     — inbound vessel ETA list
 *   vesselProfile(imo)              — full vessel intelligence card
 *   voyageSchedule(portCode, window) — ETA-ordered arrival timeline
 *   portDashboard(portCode, ...)    — aggregated port view
 *   portAlerts(portCode)            — active arrival alert queue
 *
 * Types use JSON scalar for nested complex objects
 * (consistent with routing.ts pattern).
 */

import { builder } from '../builder.js';
import {
  getPreArrivalVessels,
}                          from '../../agent/pre-arrival.js';
import { getVesselProfile } from '../../agent/vessel-profile.js';
import { getPortCongestion, getAllPortsCongestion } from '../../congestion/engine.js';
import {
  forecastDA,
}                          from '../../agent/da-forecast.js';
import {
  getChecklist,
  listOpenChecklists,
}                          from '../../agent/documents.js';
import { getAlerts, evaluateAlerts } from '../../agent/alerts.js';

// ── PreArrival types ───────────────────────────────────────────────────────────

const PreArrivalVesselType = builder.objectRef<{
  imo:         string;
  name:        string;
  etaHours:    number;
  etaAt:       string;
  distanceNm:  number;
  speedKt:     number;
  confidence:  string;
}>('PreArrivalVessel').implement({
  fields: (t) => ({
    imo:        t.exposeString('imo'),
    name:       t.exposeString('name'),
    etaHours:   t.exposeFloat('etaHours'),
    etaAt:      t.exposeString('etaAt'),
    distanceNm: t.exposeFloat('distanceNm'),
    speedKt:    t.exposeFloat('speedKt'),
    confidence: t.exposeString('confidence'),
  }),
});

const PreArrivalReportType = builder.objectRef<{
  port:         { unlocode: string; name: string; lat: number | null; lng: number | null };
  windowHours:  number;
  generatedAt:  string;
  vesselCount:  number;
  vessels:      any[];
}>('PreArrivalReport').implement({
  fields: (t) => ({
    port:        t.field({ type: 'JSON', resolve: (p) => p.port }),
    windowHours: t.exposeInt('windowHours'),
    generatedAt: t.exposeString('generatedAt'),
    vesselCount: t.exposeInt('vesselCount'),
    vessels:     t.field({ type: ['JSON'], resolve: (p) => p.vessels }),
  }),
});

// ── VesselProfile type ────────────────────────────────────────────────────────

const VesselProfileType = builder.objectRef<{
  imo:          string;
  name:         string;
  lastPosition: any;
  trackPoints:  number;
  track:        any[];
  nearestPort:  any | null;
  congestion:   any | null;
  daForecast:   any | null;
  openChecklists: any[];
  generatedAt:  string;
}>('VesselProfile').implement({
  fields: (t) => ({
    imo:            t.exposeString('imo'),
    name:           t.exposeString('name'),
    lastPosition:   t.field({ type: 'JSON', nullable: true, resolve: (p) => p.lastPosition }),
    trackPoints:    t.exposeInt('trackPoints'),
    track:          t.field({ type: ['JSON'], resolve: (p) => p.track }),
    nearestPort:    t.field({ type: 'JSON', nullable: true, resolve: (p) => p.nearestPort }),
    congestion:     t.field({ type: 'JSON', nullable: true, resolve: (p) => p.congestion }),
    daForecast:     t.field({ type: 'JSON', nullable: true, resolve: (p) => p.daForecast }),
    openChecklists: t.field({ type: ['JSON'], resolve: (p) => p.openChecklists }),
    generatedAt:    t.exposeString('generatedAt'),
  }),
});

// ── VoyageSchedule types ──────────────────────────────────────────────────────

const VoyageScheduleType = builder.objectRef<{
  port:               any;
  windowHours:        number;
  generatedAt:        string;
  currentCongestion:  any | null;
  arrivalCount:       number;
  arrivals:           any[];
}>('VoyageSchedule').implement({
  fields: (t) => ({
    port:              t.field({ type: 'JSON', resolve: (p) => p.port }),
    windowHours:       t.exposeInt('windowHours'),
    generatedAt:       t.exposeString('generatedAt'),
    currentCongestion: t.field({ type: 'JSON', nullable: true, resolve: (p) => p.currentCongestion }),
    arrivalCount:      t.exposeInt('arrivalCount'),
    arrivals:          t.field({ type: ['JSON'], resolve: (p) => p.arrivals }),
  }),
});

// ── PortDashboard type ────────────────────────────────────────────────────────

const PortDashboardType = builder.objectRef<{
  port:        any;
  generatedAt: string;
  congestion:  any | null;
  preArrival:  any | null;
  documents:   any;
  daForecast:  any | null;
}>('PortDashboard').implement({
  fields: (t) => ({
    port:        t.field({ type: 'JSON', resolve: (p) => p.port }),
    generatedAt: t.exposeString('generatedAt'),
    congestion:  t.field({ type: 'JSON', nullable: true, resolve: (p) => p.congestion }),
    preArrival:  t.field({ type: 'JSON', nullable: true, resolve: (p) => p.preArrival }),
    documents:   t.field({ type: 'JSON', resolve: (p) => p.documents }),
    daForecast:  t.field({ type: 'JSON', nullable: true, resolve: (p) => p.daForecast }),
  }),
});

// ── Alert type ────────────────────────────────────────────────────────────────

const ArrivalAlertType = builder.objectRef<{
  id:          string;
  ts:          string;
  portCode:    string;
  type:        string;
  severity:    string;
  imo:         string;
  vesselName:  string;
  message:     string;
  acknowledged: boolean;
}>('ArrivalAlert').implement({
  fields: (t) => ({
    id:           t.exposeString('id'),
    ts:           t.exposeString('ts'),
    portCode:     t.exposeString('portCode'),
    type:         t.exposeString('type'),
    severity:     t.exposeString('severity'),
    imo:          t.exposeString('imo'),
    vesselName:   t.exposeString('vesselName'),
    message:      t.exposeString('message'),
    acknowledged: t.exposeBoolean('acknowledged'),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryFields((t) => ({

  /** Pre-arrival vessel list for a port */
  preArrival: t.field({
    type: PreArrivalReportType,
    nullable: true,
    args: {
      portCode: t.arg.string({ required: true }),
      window:   t.arg.int({ defaultValue: 48 }),
    },
    resolve: async (_, args) => {
      const data = await getPreArrivalVessels(args.portCode, args.window ?? 48);
      if (!data) return null;
      return data;
    },
  }),

  /** Full vessel intelligence profile */
  vesselProfile: t.field({
    type: VesselProfileType,
    nullable: true,
    args: {
      imo: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      return getVesselProfile(args.imo);
    },
  }),

  /** ETA-ordered arrival timeline for a port */
  voyageSchedule: t.field({
    type: VoyageScheduleType,
    nullable: true,
    args: {
      portCode: t.arg.string({ required: true }),
      window:   t.arg.int({ defaultValue: 72 }),
    },
    resolve: async (_, args) => {
      const portCode  = args.portCode;
      const windowHrs = args.window ?? 72;
      const [preArrival, congestion] = await Promise.all([
        getPreArrivalVessels(portCode, windowHrs),
        getPortCongestion(portCode),
      ]);
      if (!preArrival) return null;

      const allOpen   = listOpenChecklists();
      const portUpper = portCode.toUpperCase();
      const daBase    = forecastDA(portCode, { grt: 50000, loaMetres: 250, teuCapacity: 4000 });

      const arrivals = preArrival.vessels.map((v: any) => {
        const checklist = allOpen.find((c: any) => c.imo === v.imo && c.portUnlocode === portUpper) ?? null;
        return {
          imo:         v.imo,
          vesselName:  v.name,
          etaHours:    v.etaHours,
          etaAt:       v.etaAt,
          distanceNm:  v.distanceNm,
          speedKt:     v.speedKt,
          confidence:  v.confidence,
          docs: checklist ? {
            voyageId:  checklist.voyageId,
            readyPct:  checklist.summary.readyPct,
            overdue:   checklist.summary.overdue,
            pending:   checklist.summary.pending,
          } : null,
          congestionAtArrival: congestion ? {
            level:              congestion.level,
            score:              congestion.congestionScore,
            estimatedWaitHours: congestion.estimatedWaitHours,
          } : null,
          daEstimateUsd: daBase.costs.totalUsd,
        };
      });

      return {
        port:              preArrival.port,
        windowHours:       windowHrs,
        generatedAt:       new Date().toISOString(),
        currentCongestion: congestion ? {
          level:   congestion.level,
          score:   congestion.congestionScore,
          vessels: congestion.anchorageVessels + congestion.approachVessels,
        } : null,
        arrivalCount:  arrivals.length,
        arrivals,
      };
    },
  }),

  /** Aggregated port view: congestion + pre-arrival + docs + DA */
  portDashboard: t.field({
    type: PortDashboardType,
    nullable: true,
    args: {
      portCode: t.arg.string({ required: true }),
      window:   t.arg.int({ defaultValue: 48 }),
      grt:      t.arg.int({ defaultValue: 50000 }),
      loa:      t.arg.int({ defaultValue: 250 }),
      teu:      t.arg.int({ defaultValue: 4000 }),
    },
    resolve: async (_, args) => {
      const portCode = args.portCode;
      const [congestion, preArrival] = await Promise.all([
        getPortCongestion(portCode),
        getPreArrivalVessels(portCode, args.window ?? 48),
      ]);
      if (!congestion && !preArrival) return null;

      const allOpen   = listOpenChecklists();
      const portUpper = portCode.toUpperCase();
      const portDocs  = allOpen.filter((c: any) => c.portUnlocode === portUpper);
      const vesselSpec = {
        grt:         args.grt         ?? 50000,
        loaMetres:   args.loa         ?? 250,
        teuCapacity: args.teu         ?? 4000,
      };
      const daForecast = forecastDA(portCode, vesselSpec);

      return {
        port:        congestion?.port ?? (preArrival as any)?.port ?? { unlocode: portUpper },
        generatedAt: new Date().toISOString(),
        congestion:  congestion ?? null,
        preArrival:  preArrival ?? null,
        documents: {
          openVoyages:   portDocs.length,
          totalPending:  portDocs.reduce((s: number, c: any) => s + c.summary.pending, 0),
          totalOverdue:  portDocs.reduce((s: number, c: any) => s + c.summary.overdue, 0),
          checklists:    portDocs,
        },
        daForecast,
      };
    },
  }),

  /** Active arrival alerts for a port */
  portAlerts: t.field({
    type: [ArrivalAlertType],
    args: {
      portCode: t.arg.string({ required: true }),
      includeAcknowledged: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (_, args) => {
      return getAlerts(args.portCode, args.includeAcknowledged ?? false);
    },
  }),

  /** Port congestion snapshot */
  portCongestion: t.field({
    type: 'JSON',
    nullable: true,
    args: {
      portCode: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      return getPortCongestion(args.portCode);
    },
  }),

  /** All ports congestion summary */
  allPortsCongestion: t.field({
    type: ['JSON'],
    resolve: async () => {
      return getAllPortsCongestion();
    },
  }),

}));

// ── Mutation ──────────────────────────────────────────────────────────────────

builder.mutationFields((t) => ({
  /** Trigger alert evaluation for a port (returns new alerts fired) */
  evaluatePortAlerts: t.field({
    type: [ArrivalAlertType],
    args: {
      portCode: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      return evaluateAlerts(args.portCode);
    },
  }),
}));
