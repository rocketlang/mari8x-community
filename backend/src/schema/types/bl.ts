/**
 * Mari8X Bill of Lading — Pothos GraphQL Types
 *
 * Queries:
 *   billOfLading(blNumber: String!): BillOfLading
 *   billsOfLading(status, portOfDischarge, voyageId, limit): [BLSummary!]!
 *   blDashboard: BLDashboard!
 *
 * Mutations:
 *   createBL(input: CreateBLInput!): BillOfLading!
 *   issueBL(blNumber, issuedBy, placeOfIssue): BillOfLading!
 *   amendBL(blNumber, field, newValue, reason, amendedBy): BillOfLading!
 *   surrenderBL(blNumber, surrenderedBy): BillOfLading!
 *   releaseBL(blNumber, releaseAuthorisedBy, telexRefNo): BillOfLading!
 *
 * © 2026 ANKR Labs — Proprietary
 */

import { builder } from '../builder.js';
import {
  createBL, issueBL, amendBL, surrenderBL, releaseBL,
  getBL, listBLs, getBLDashboard,
  type BillOfLading, type BLSummary,
} from '../../agent/bl.js';
import { generateBLPdf } from '../../agent/bl-pdf.js';

// ── Object types ──────────────────────────────────────────────────────────────

const BLContainerType = builder.objectRef<{ containerNumber: string; isoType: string; sealNumber?: string; grossWeightKg?: number }>('BLContainer').implement({
  fields: t => ({
    containerNumber: t.exposeString('containerNumber'),
    isoType:         t.exposeString('isoType'),
    sealNumber:      t.exposeString('sealNumber', { nullable: true }),
    grossWeightKg:   t.exposeFloat('grossWeightKg', { nullable: true }),
  }),
});

const BLAmendmentType = builder.objectRef<{
  amendmentNo: number; field: string; oldValue: string;
  newValue: string; reason: string; amendedBy: string; amendedAt: string;
}>('BLAmendment').implement({
  fields: t => ({
    amendmentNo: t.exposeInt('amendmentNo'),
    field:       t.exposeString('field'),
    oldValue:    t.exposeString('oldValue'),
    newValue:    t.exposeString('newValue'),
    reason:      t.exposeString('reason'),
    amendedBy:   t.exposeString('amendedBy'),
    amendedAt:   t.exposeString('amendedAt'),
  }),
});

const BillOfLadingType = builder.objectRef<BillOfLading>('BillOfLading').implement({
  fields: t => ({
    blNumber:         t.exposeString('blNumber'),
    status:           t.exposeString('status'),
    releaseType:      t.exposeString('releaseType'),
    shipper:          t.exposeString('shipper'),
    consignee:        t.exposeString('consignee'),
    notifyParty:      t.exposeString('notifyParty', { nullable: true }),
    vesselName:       t.exposeString('vesselName'),
    voyageNumber:     t.exposeString('voyageNumber'),
    portOfLoading:    t.exposeString('portOfLoading'),
    portOfDischarge:  t.exposeString('portOfDischarge'),
    placeOfReceipt:   t.exposeString('placeOfReceipt',  { nullable: true }),
    placeOfDelivery:  t.exposeString('placeOfDelivery', { nullable: true }),
    commodity:        t.exposeString('commodity'),
    packages:         t.exposeInt('packages'),
    packageUnit:      t.exposeString('packageUnit'),
    grossWeightKg:    t.exposeFloat('grossWeightKg'),
    measurementCbm:   t.exposeFloat('measurementCbm',  { nullable: true }),
    marksAndNumbers:  t.exposeString('marksAndNumbers', { nullable: true }),
    freightPayable:   t.exposeString('freightPayable'),
    freightAmount:    t.exposeFloat('freightAmount',    { nullable: true }),
    currency:         t.exposeString('currency'),
    placeOfIssue:     t.exposeString('placeOfIssue',   { nullable: true }),
    issuedAt:         t.exposeString('issuedAt',        { nullable: true }),
    issuedBy:         t.exposeString('issuedBy',        { nullable: true }),
    voyageId:         t.exposeString('voyageId',        { nullable: true }),
    surrenderedAt:    t.exposeString('surrenderedAt',   { nullable: true }),
    releasedAt:       t.exposeString('releasedAt',      { nullable: true }),
    releaseAuthorisedBy: t.exposeString('releaseAuthorisedBy', { nullable: true }),
    telexRefNo:       t.exposeString('telexRefNo',      { nullable: true }),
    containers: t.field({
      type: [BLContainerType],
      resolve: bl => bl.containers,
    }),
    amendments: t.field({
      type: [BLAmendmentType],
      resolve: bl => bl.amendments,
    }),
    amendmentCount: t.field({
      type: 'Int',
      resolve: bl => bl.amendments.length,
    }),
    createdAt: t.exposeString('createdAt'),
    updatedAt: t.exposeString('updatedAt'),
  }),
});

const BLSummaryType = builder.objectRef<BLSummary>('BLSummary').implement({
  fields: t => ({
    blNumber:        t.exposeString('blNumber'),
    status:          t.exposeString('status'),
    releaseType:     t.exposeString('releaseType'),
    shipper:         t.exposeString('shipper'),
    consignee:       t.exposeString('consignee'),
    vesselName:      t.exposeString('vesselName'),
    voyageNumber:    t.exposeString('voyageNumber'),
    portOfLoading:   t.exposeString('portOfLoading'),
    portOfDischarge: t.exposeString('portOfDischarge'),
    containers:      t.exposeInt('containers'),
    grossWeightKg:   t.exposeFloat('grossWeightKg'),
    freightPayable:  t.exposeString('freightPayable'),
    amendmentCount:  t.exposeInt('amendmentCount'),
    issuedAt:        t.exposeString('issuedAt', { nullable: true }),
    createdAt:       t.exposeString('createdAt'),
  }),
});

const BLDashboardType = builder.objectRef<{
  total: number; draft: number; issued: number;
  surrendered: number; released: number; pendingRelease: number;
}>('BLDashboard').implement({
  fields: t => ({
    total:          t.exposeInt('total'),
    draft:          t.exposeInt('draft'),
    issued:         t.exposeInt('issued'),
    surrendered:    t.exposeInt('surrendered'),
    released:       t.exposeInt('released'),
    pendingRelease: t.exposeInt('pendingRelease'),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('billOfLading', t =>
  t.field({
    type:     BillOfLadingType,
    nullable: true,
    args:     { blNumber: t.arg.string({ required: true }) },
    resolve:  (_, args) => getBL(args.blNumber),
  })
);

builder.queryField('billsOfLading', t =>
  t.field({
    type:     [BLSummaryType],
    nullable: false,
    args: {
      status:          t.arg.string({ required: false }),
      portOfDischarge: t.arg.string({ required: false }),
      voyageId:        t.arg.string({ required: false }),
      limit:           t.arg.int({ required: false }),
    },
    resolve: (_, args) => listBLs({
      status:          args.status          as any ?? undefined,
      portOfDischarge: args.portOfDischarge ?? undefined,
      voyageId:        args.voyageId        ?? undefined,
      limit:           args.limit           ?? 50,
    }),
  })
);

builder.queryField('blDashboard', t =>
  t.field({
    type:    BLDashboardType,
    resolve: () => getBLDashboard(),
  })
);

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('createBL', t =>
  t.field({
    type: BillOfLadingType,
    args: {
      releaseType:     t.arg.string({ required: true }),
      shipper:         t.arg.string({ required: true }),
      consignee:       t.arg.string({ required: true }),
      notifyParty:     t.arg.string({ required: false }),
      vesselName:      t.arg.string({ required: true }),
      voyageNumber:    t.arg.string({ required: true }),
      portOfLoading:   t.arg.string({ required: true }),
      portOfDischarge: t.arg.string({ required: true }),
      placeOfReceipt:  t.arg.string({ required: false }),
      placeOfDelivery: t.arg.string({ required: false }),
      commodity:       t.arg.string({ required: true }),
      packages:        t.arg.int({ required: true }),
      packageUnit:     t.arg.string({ required: false }),
      grossWeightKg:   t.arg.float({ required: true }),
      measurementCbm:  t.arg.float({ required: false }),
      freightPayable:  t.arg.string({ required: true }),
      freightAmount:   t.arg.float({ required: false }),
      currency:        t.arg.string({ required: false }),
      placeOfIssue:    t.arg.string({ required: false }),
      voyageId:        t.arg.string({ required: false }),
    },
    resolve: (_, args) => createBL({
      releaseType:     args.releaseType     as any,
      shipper:         args.shipper,
      consignee:       args.consignee,
      notifyParty:     args.notifyParty     ?? undefined,
      vesselName:      args.vesselName,
      voyageNumber:    args.voyageNumber,
      portOfLoading:   args.portOfLoading,
      portOfDischarge: args.portOfDischarge,
      placeOfReceipt:  args.placeOfReceipt  ?? undefined,
      placeOfDelivery: args.placeOfDelivery ?? undefined,
      commodity:       args.commodity,
      packages:        args.packages,
      packageUnit:     args.packageUnit     ?? undefined,
      grossWeightKg:   args.grossWeightKg,
      measurementCbm:  args.measurementCbm  ?? undefined,
      freightPayable:  args.freightPayable  as any,
      freightAmount:   args.freightAmount   ?? undefined,
      currency:        args.currency        ?? undefined,
      placeOfIssue:    args.placeOfIssue    ?? undefined,
      voyageId:        args.voyageId        ?? undefined,
    }),
  })
);

builder.mutationField('issueBL', t =>
  t.field({
    type:     BillOfLadingType,
    nullable: true,
    args: {
      blNumber:     t.arg.string({ required: true }),
      issuedBy:     t.arg.string({ required: true }),
      placeOfIssue: t.arg.string({ required: false }),
    },
    resolve: (_, args) => issueBL(args.blNumber, args.issuedBy, args.placeOfIssue ?? undefined),
  })
);

builder.mutationField('amendBL', t =>
  t.field({
    type:     BillOfLadingType,
    nullable: true,
    args: {
      blNumber:  t.arg.string({ required: true }),
      field:     t.arg.string({ required: true }),
      newValue:  t.arg.string({ required: true }),
      reason:    t.arg.string({ required: true }),
      amendedBy: t.arg.string({ required: true }),
    },
    resolve: (_, args) => amendBL(args.blNumber, {
      field:     args.field,
      newValue:  args.newValue,
      reason:    args.reason,
      amendedBy: args.amendedBy,
    }),
  })
);

builder.mutationField('surrenderBL', t =>
  t.field({
    type:     BillOfLadingType,
    nullable: true,
    args: {
      blNumber:      t.arg.string({ required: true }),
      surrenderedBy: t.arg.string({ required: true }),
    },
    resolve: (_, args) => surrenderBL(args.blNumber, args.surrenderedBy),
  })
);

builder.mutationField('releaseBL', t =>
  t.field({
    type:     BillOfLadingType,
    nullable: true,
    args: {
      blNumber:             t.arg.string({ required: true }),
      releaseAuthorisedBy:  t.arg.string({ required: true }),
      telexRefNo:           t.arg.string({ required: false }),
      releaseType:          t.arg.string({ required: false }),
    },
    resolve: (_, args) => releaseBL(args.blNumber, {
      releaseAuthorisedBy: args.releaseAuthorisedBy,
      telexRefNo:          args.telexRefNo  ?? undefined,
      releaseType:         args.releaseType as any ?? undefined,
    }),
  })
);

// ── PDF Export ────────────────────────────────────────────────────────────────

/**
 * exportBillOfLadingPdf(blNumber) → base64-encoded PDF string
 * Renders the B/L as a professionally formatted A4 PDF via PDFKit.
 * The caller can decode from base64 to get the raw PDF buffer.
 *
 * REST equivalent: GET /api/bl/:blNumber/pdf
 */
builder.mutationField('exportBillOfLadingPdf', t =>
  t.field({
    type:     'String',
    nullable: true,
    args:     { blNumber: t.arg.string({ required: true }) },
    resolve:  async (_, args) => {
      const bl = getBL(args.blNumber);
      if (!bl) return null;
      const buf = await generateBLPdf(bl);
      return buf.toString('base64');
    },
  })
);
