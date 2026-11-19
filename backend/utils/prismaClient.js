const { PrismaClient } = require('@prisma/client');

// One pool per Node process is important for Supabase session pooler connection limits.
function configuredDatasource() {
  const connectionLimit = Math.min(15, Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || 5)));
  try {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('connection_limit', String(connectionLimit));
    return url.toString();
  } catch {
    return undefined;
  }
}

const datasourceUrl = configuredDatasource();
const prisma = globalThis.__ascendPrismaClient || new PrismaClient(
  datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : undefined
);
if (process.env.NODE_ENV !== 'production') globalThis.__ascendPrismaClient = prisma;

module.exports = prisma;
