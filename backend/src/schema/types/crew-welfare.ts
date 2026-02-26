/**
 * Crew Welfare — GraphQL types (Pothos schema builder)
 *
 * MLC 2006 compliant crew management:
 *
 * Queries:
 *   crew(vesselId, onboardOnly?)          → [CrewMember]
 *   mlcCompliance(vesselId, referenceDate)→ [MLCComplianceResult]
 *   documentAlerts(vesselId)              → [DocumentAlert]
 *   crewSummary(vesselId)                 → CrewSummary
 *
 * Mutations:
 *   addCrewMember(vesselId, input)        → CrewMember
 *   signOffCrew(vesselId, crewMemberId, signOffDate) → CrewMember
 *   recordRestPeriod(vesselId, input)     → RestPeriod
 *
 * © 2026 ANKR Labs — Mari8X Community Edition
 */

import { builder } from '../builder.js';
import {
  listCrew, addCrewMember, signOffCrew, recordRestPeriod,
  getRestPeriods, checkMLCCompliance, getDocumentAlerts, getCrewSummary,
  type CrewMember, type RestPeriod, type MLCComplianceResult, type DocumentAlert,
} from '../../agent/crew-welfare.js';

// ── CrewDocument (nested in CrewMember) ───────────────────────────────────────

interface CrewDocumentShape {
  type: string; number: string; issuingCountry: string;
  issueDate: string; expiryDate: string; issuingAuthority?: string;
}

const CrewDocumentType = builder.objectRef<CrewDocumentShape>('CrewDocument').implement({
  fields: t => ({
    type:             t.exposeString('type'),
    number:           t.exposeString('number'),
    issuingCountry:   t.exposeString('issuingCountry'),
    issueDate:        t.exposeString('issueDate'),
    expiryDate:       t.exposeString('expiryDate'),
    issuingAuthority: t.exposeString('issuingAuthority', { nullable: true }),
  }),
});

// ── CrewMember ────────────────────────────────────────────────────────────────

const CrewMemberType = builder.objectRef<CrewMember>('CrewMember').implement({
  fields: t => ({
    id:                    t.exposeString('id'),
    vesselId:              t.exposeString('vesselId'),
    seafarerId:            t.exposeString('seafarerId'),
    firstName:             t.exposeString('firstName'),
    lastName:              t.exposeString('lastName'),
    nationality:           t.exposeString('nationality'),
    rank:                  t.exposeString('rank'),
    signOnDate:            t.exposeString('signOnDate'),
    signOffDate:           t.exposeString('signOffDate',      { nullable: true }),
    contractMonths:        t.exposeInt('contractMonths'),
    birthDate:             t.exposeString('birthDate'),
    flagStateEndorsement:  t.exposeString('flagStateEndorsement'),
    notes:                 t.exposeString('notes',             { nullable: true }),
    createdAt:             t.exposeString('createdAt'),
    updatedAt:             t.exposeString('updatedAt'),
    documents:             t.field({
      type: [CrewDocumentType],
      resolve: c => c.documents,
    }),
    emergencyContactName:  t.field({ type: 'String', resolve: c => c.emergencyContact.name }),
    emergencyContactPhone: t.field({ type: 'String', resolve: c => c.emergencyContact.phone }),
  }),
});

// ── RestPeriod ────────────────────────────────────────────────────────────────

const RestPeriodType = builder.objectRef<RestPeriod>('RestPeriod').implement({
  fields: t => ({
    id:           t.exposeString('id'),
    crewMemberId: t.exposeString('crewMemberId'),
    date:         t.exposeString('date'),
    restStartUtc: t.exposeString('restStartUtc'),
    restEndUtc:   t.exposeString('restEndUtc'),
    hoursRest:    t.exposeFloat('hoursRest'),
    notes:        t.exposeString('notes', { nullable: true }),
  }),
});

// ── MLCComplianceResult ───────────────────────────────────────────────────────

const MLCComplianceType = builder.objectRef<MLCComplianceResult>('MLCComplianceResult').implement({
  fields: t => ({
    crewMemberId:      t.exposeString('crewMemberId'),
    name:              t.exposeString('name'),
    rank:              t.exposeString('rank'),
    period:            t.exposeString('period'),
    totalRestHours:    t.exposeFloat('totalRestHours'),
    requiredRestHours: t.exposeFloat('requiredRestHours'),
    totalWorkHours:    t.exposeFloat('totalWorkHours'),
    maxWorkHours:      t.exposeFloat('maxWorkHours'),
    compliant:         t.exposeBoolean('compliant'),
    violations:        t.exposeStringList('violations'),
  }),
});

// ── DocumentAlert ─────────────────────────────────────────────────────────────

const DocumentAlertType = builder.objectRef<DocumentAlert>('DocumentAlert').implement({
  fields: t => ({
    crewMemberId:    t.exposeString('crewMemberId'),
    name:            t.exposeString('name'),
    rank:            t.exposeString('rank'),
    daysUntilExpiry: t.exposeInt('daysUntilExpiry'),
    severity:        t.exposeString('severity'),
    docType:         t.field({ type: 'String', resolve: a => a.document.type }),
    docNumber:       t.field({ type: 'String', resolve: a => a.document.number }),
    docExpiryDate:   t.field({ type: 'String', resolve: a => a.document.expiryDate }),
  }),
});

// ── CrewSummary (inline shape from getCrewSummary) ────────────────────────────

interface CrewSummaryShape {
  vesselId:                   string;
  totalOnboard:               number;
  nationalities:              Record<string, number>;
  contractsEndingWithin30Days: Array<{ id: string; name: string; rank: string; expectedSignOff: string }>;
  criticalDocumentAlerts:     number;
}

const CrewSummaryType = builder.objectRef<CrewSummaryShape>('CrewSummary').implement({
  fields: t => ({
    vesselId:                t.exposeString('vesselId'),
    totalOnboard:            t.exposeInt('totalOnboard'),
    criticalDocumentAlerts:  t.exposeInt('criticalDocumentAlerts'),
    nationalitiesJson:       t.field({
      type: 'String',
      resolve: s => JSON.stringify(s.nationalities),
    }),
    contractsEndingSoon: t.field({
      type: 'String',  // JSON string of the array
      resolve: s => JSON.stringify(s.contractsEndingWithin30Days),
    }),
  }),
});

// ── Input types ───────────────────────────────────────────────────────────────

const CrewDocumentInputRef = builder.inputType('CrewDocumentInput', {
  fields: t => ({
    type:             t.string({ required: true }),
    number:           t.string({ required: true }),
    issuingCountry:   t.string({ required: true }),
    issueDate:        t.string({ required: true }),
    expiryDate:       t.string({ required: true }),
    issuingAuthority: t.string({ required: false }),
  }),
});

const EmergencyContactInputRef = builder.inputType('EmergencyContactInput', {
  fields: t => ({
    name:     t.string({ required: true }),
    phone:    t.string({ required: true }),
    relation: t.string({ required: true }),
  }),
});

const CrewMemberInputRef = builder.inputType('CrewMemberInput', {
  fields: t => ({
    seafarerId:           t.string({ required: true }),
    firstName:            t.string({ required: true }),
    lastName:             t.string({ required: true }),
    nationality:          t.string({ required: true }),
    rank:                 t.string({ required: true }),
    signOnDate:           t.string({ required: true }),
    contractMonths:       t.int({ required: true }),
    birthDate:            t.string({ required: true }),
    flagStateEndorsement: t.string({ required: true }),
    documents:            t.field({ type: [CrewDocumentInputRef], required: false }),
    emergencyContact:     t.field({ type: EmergencyContactInputRef, required: true }),
    notes:                t.string({ required: false }),
  }),
});

const RestPeriodInputRef = builder.inputType('RestPeriodInput', {
  fields: t => ({
    crewMemberId: t.string({ required: true }),
    date:         t.string({ required: true }),
    restStartUtc: t.string({ required: true }),
    restEndUtc:   t.string({ required: true }),
    notes:        t.string({ required: false }),
  }),
});

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('crew', t =>
  t.field({
    type:    [CrewMemberType],
    args:    {
      vesselId:    t.arg.string({ required: true }),
      onboardOnly: t.arg.boolean({ required: false }),
    },
    resolve: (_, { vesselId, onboardOnly }) =>
      listCrew(vesselId, onboardOnly ?? true),
  })
);

builder.queryField('mlcCompliance', t =>
  t.field({
    type:    [MLCComplianceType],
    args:    {
      vesselId:      t.arg.string({ required: true }),
      referenceDate: t.arg.string({ required: true }),
    },
    resolve: (_, { vesselId, referenceDate }) =>
      checkMLCCompliance(vesselId, referenceDate),
  })
);

builder.queryField('documentAlerts', t =>
  t.field({
    type:    [DocumentAlertType],
    args:    { vesselId: t.arg.string({ required: true }) },
    resolve: (_, { vesselId }) => getDocumentAlerts(vesselId),
  })
);

builder.queryField('crewSummary', t =>
  t.field({
    type:     CrewSummaryType,
    args:     { vesselId: t.arg.string({ required: true }) },
    resolve:  (_, { vesselId }) => getCrewSummary(vesselId) as CrewSummaryShape,
  })
);

// ── Mutations ─────────────────────────────────────────────────────────────────

builder.mutationField('addCrewMember', t =>
  t.field({
    type:  CrewMemberType,
    args:  {
      vesselId: t.arg.string({ required: true }),
      input:    t.arg({ type: CrewMemberInputRef, required: true }),
    },
    resolve: (_, { vesselId, input }) =>
      addCrewMember(vesselId, {
        ...(input as any),
        documents: (input.documents ?? []) as any,
      }),
  })
);

builder.mutationField('signOffCrew', t =>
  t.field({
    type:  CrewMemberType,
    args:  {
      vesselId:      t.arg.string({ required: true }),
      crewMemberId:  t.arg.string({ required: true }),
      signOffDate:   t.arg.string({ required: true }),
    },
    resolve: (_, { vesselId, crewMemberId, signOffDate }) =>
      signOffCrew(vesselId, crewMemberId, signOffDate),
  })
);

builder.mutationField('recordRestPeriod', t =>
  t.field({
    type:  RestPeriodType,
    args:  {
      vesselId: t.arg.string({ required: true }),
      input:    t.arg({ type: RestPeriodInputRef, required: true }),
    },
    resolve: (_, { vesselId, input }) =>
      recordRestPeriod(vesselId, input as any),
  })
);
