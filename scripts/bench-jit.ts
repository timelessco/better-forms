/**
 * Micro-benchmark: drizzle-orm 1.0.0-rc.1 — JIT mappers on vs off.
 *
 * Compares result-mapping cost (JS-side) for the same workload using two
 * separate `drizzle()` instances against the same DATABASE_URL.
 *
 * Usage: bun scripts/bench-jit.ts
 *
 * Note: only `user` table is currently in sync between the codebase schema
 * and the local docker DB. Other workloads use `user` cross-joined with
 * `generate_series` to amplify row count without seeding.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { user } from "../src/db/schema";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const ITERATIONS = 200;
const WARMUP = 25;

const makeDb = (jit: boolean) =>
  drizzle({
    connection: { url: DATABASE_URL, prepare: false },
    relations: schema.relations,
    jit,
  });

type Sample = number;

const ns = () => Number(process.hrtime.bigint());

const stats = (samples: Sample[]) => {
  const sorted = [...samples].toSorted((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const p = (q: number) => sorted[Math.floor(sorted.length * q)];
  return {
    mean: mean / 1e6,
    p50: (p(0.5) ?? 0) / 1e6,
    p95: (p(0.95) ?? 0) / 1e6,
    min: (sorted[0] ?? 0) / 1e6,
    max: (sorted.at(-1) ?? 0) / 1e6,
  };
};

const fmt = (s: ReturnType<typeof stats>) =>
  `mean=${s.mean.toFixed(2)}ms p50=${s.p50.toFixed(2)}ms p95=${s.p95.toFixed(2)}ms min=${s.min.toFixed(2)}ms max=${s.max.toFixed(2)}ms`;

const runWorkload = async (label: string, fn: () => Promise<unknown>): Promise<Sample[]> => {
  for (let i = 0; i < WARMUP; i++) await fn();
  const samples: Sample[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = ns();
    await fn();
    samples.push(ns() - t0);
  }
  console.log(`${label.padEnd(45)} ${fmt(stats(samples))}`);
  return samples;
};

const compare = (label: string, off: Sample[], on: Sample[]) => {
  const sOff = stats(off);
  const sOn = stats(on);
  const deltaMean = ((sOn.mean - sOff.mean) / sOff.mean) * 100;
  const deltaP95 = ((sOn.p95 - sOff.p95) / sOff.p95) * 100;
  const sign = (n: number) => (n >= 0 ? "+" : "");
  console.log(
    `${label.padEnd(45)} mean Δ=${sign(deltaMean)}${deltaMean.toFixed(1)}%  p95 Δ=${sign(deltaP95)}${deltaP95.toFixed(1)}%`,
  );
};

const main = async () => {
  const dbOff = makeDb(false);
  const dbOn = makeDb(true);

  console.log(
    `\nIterations: ${ITERATIONS} (after ${WARMUP} warmup) — DATABASE_URL=${new URL(DATABASE_URL).host}\n`,
  );

  console.log("== A: SELECT user (6 rows, 11 cols) ==");
  const aOff = await runWorkload("user (6 rows)              jit=off", () =>
    dbOff.select().from(user),
  );
  const aOn = await runWorkload("user (6 rows)              jit=on ", () =>
    dbOn.select().from(user),
  );
  compare("user (6 rows)              delta", aOff, aOn);
  console.log();

  console.log("== B: SELECT user × generate_series(1, 100) → 600 rows ==");
  const bOff = await runWorkload("user × 100 (600 rows)      jit=off", () =>
    dbOff
      .select()
      .from(user)
      .innerJoin(sql`generate_series(1, 100) g`, sql`true`),
  );
  const bOn = await runWorkload("user × 100 (600 rows)      jit=on ", () =>
    dbOn
      .select()
      .from(user)
      .innerJoin(sql`generate_series(1, 100) g`, sql`true`),
  );
  compare("user × 100 (600 rows)      delta", bOff, bOn);
  console.log();

  console.log("== C: SELECT user × generate_series(1, 1000) → 6 000 rows ==");
  const cOff = await runWorkload("user × 1000 (6 000 rows)   jit=off", () =>
    dbOff
      .select()
      .from(user)
      .innerJoin(sql`generate_series(1, 1000) g`, sql`true`),
  );
  const cOn = await runWorkload("user × 1000 (6 000 rows)   jit=on ", () =>
    dbOn
      .select()
      .from(user)
      .innerJoin(sql`generate_series(1, 1000) g`, sql`true`),
  );
  compare("user × 1000 (6 000 rows)   delta", cOff, cOn);
  console.log();

  console.log("== D: SELECT user × generate_series(1, 5000) → 30 000 rows ==");
  const dOff = await runWorkload("user × 5000 (30 000 rows)  jit=off", () =>
    dbOff
      .select()
      .from(user)
      .innerJoin(sql`generate_series(1, 5000) g`, sql`true`),
  );
  const dOn = await runWorkload("user × 5000 (30 000 rows)  jit=on ", () =>
    dbOn
      .select()
      .from(user)
      .innerJoin(sql`generate_series(1, 5000) g`, sql`true`),
  );
  compare("user × 5000 (30 000 rows)  delta", dOff, dOn);
  console.log();

  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
