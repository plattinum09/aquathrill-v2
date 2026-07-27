import { prisma } from "./prisma";

export type QueryResultRow = Record<string, any>;

function expectsRows(sql: string) {
  const normalized = sql.trim().toLowerCase();
  return (
    normalized.startsWith("select") ||
    normalized.startsWith("with") ||
    normalized.includes(" returning ")
  );
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  if (expectsRows(text)) {
    const rows = await prisma.$queryRawUnsafe<T[]>(text, ...values);
    return { rows, rowCount: rows.length };
  }
  const rowCount = await prisma.$executeRawUnsafe(text, ...values);
  return { rows: [] as T[], rowCount };
}
