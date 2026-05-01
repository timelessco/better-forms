import "@tanstack/react-start/server-only";
import { relations } from "@/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Set it in your .env file or environment variables before running the server.",
  );
}

export const db = drizzle({
  connection: { url, prepare: false },
  relations,
  jit: true,
});
