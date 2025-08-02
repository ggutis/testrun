import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();

export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty',
});

export default router;
