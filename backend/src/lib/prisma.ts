/**
 * Prisma Database Client
 */

import { PrismaClient } from '@prisma/client';

// @rule:ANKR-001 — prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
