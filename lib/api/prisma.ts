import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var aquathrillPrisma: PrismaClient | undefined;
}

export const prisma =
  global.aquathrillPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.aquathrillPrisma = prisma;
