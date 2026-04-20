import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single DB client for the Next.js server runtime. Railway exposes `DATABASE_URL` as a managed
 * Postgres 16 connection string. We keep one Postgres.js connection pool per process — Next's
 * server runtime is long-lived so this is safe.
 */
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const sql = globalForDb.sql ?? postgres(connectionString, {
  max: Number(process.env.DB_POOL_SIZE ?? 10),
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  prepare: false, // Drizzle prepares; avoid double-prepare on statement_cache_size=0 providers
});

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
export type Db = typeof db;
