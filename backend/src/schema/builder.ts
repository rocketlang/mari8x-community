/**
 * Pothos GraphQL Schema Builder
 */

import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '@pothos/plugin-prisma/generated';
import { prisma } from '../lib/prisma.js';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    JSON:     { Input: unknown; Output: unknown };
    DateTime: { Input: Date | string; Output: Date | string };
  };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
  },
});

// Root Query type
builder.queryType({});

// Root Mutation type (optional)
builder.mutationType({});

// DateTime scalar (ISO 8601 strings / Date objects)
builder.scalarType('DateTime', {
  serialize:    (v) => (v instanceof Date ? (v as Date).toISOString() : String(v)),
  parseValue:   (v) => (typeof v === 'string' ? new Date(v) : String(v)),
  parseLiteral: (ast) => (ast.kind === 'StringValue' ? new Date(ast.value) : String(ast)),
});

// JSON scalar (used by agent/vessel types)
builder.scalarType('JSON', {
  serialize:    (v) => v,
  parseValue:   (v) => v,
  parseLiteral: (ast) => {
    if (ast.kind === 'StringValue') return ast.value;
    if (ast.kind === 'IntValue') return parseInt(ast.value, 10);
    if (ast.kind === 'FloatValue') return parseFloat(ast.value);
    if (ast.kind === 'BooleanValue') return ast.value;
    return null;
  },
});
