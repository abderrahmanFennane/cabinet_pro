import { prisma } from '../config/prisma';

export async function writeAuditLog(input: {
  userId?: string | null;
  cabinetId?: string | null;
  action: string;
  method: string;
  path: string;
  status: number;
}) {
  try {
    await prisma.auditLog.create({ data: input });
  } catch {
    // Audit failures must not break the business request.
  }
}