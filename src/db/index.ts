import "@tanstack/react-start/server-only";
import * as schema from "@/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type Db = PostgresJsDatabase<typeof schema.relations>;

let dbInstance: Db | undefined;

const getDb = (): Db => {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Set it in your .env file or environment variables before running the server.",
      );
    }
    dbInstance = drizzle({
      // `prepare: false` is required by Supabase pgbouncer in transaction mode
      // (port 6543 connection pooler) — prepared statements aren't supported.
      connection: { url, prepare: false },
      relations: schema.relations,
      jit: true,
    });
  }
  return dbInstance;
};

export const db = getDb();
