import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const QUERY_COLLECTIONS_DIR = path.resolve("src/collections/query");

const getQueryCollectionFiles = () =>
  fs.readdirSync(QUERY_COLLECTIONS_DIR).filter((f) => f.endsWith(".ts"));

const getFileContent = (filename: string) =>
  fs.readFileSync(path.join(QUERY_COLLECTIONS_DIR, filename), "utf-8");

describe("electric removal parity", () => {
  it("query-backed collections cover all authenticated surfaces", () => {
    const queryFiles = getQueryCollectionFiles();
    const names = queryFiles.map((f) => f.replace(".ts", ""));

    expect(names).toContain("workspace");
    expect(names).toContain("form-listing");
    expect(names).toContain("version");
    expect(names).toContain("submission");
  });

  it("query-backed collections have no Electric imports", () => {
    for (const file of getQueryCollectionFiles()) {
      const content = getFileContent(file);
      expect(content).not.toContain("electric-db-collection");
      expect(content).not.toContain("@electric-sql");
      expect(content).not.toContain("getElectricUrl");
    }
  });

  it("query collections use queryCollectionOptions not electricCollectionOptions", () => {
    for (const file of getQueryCollectionFiles()) {
      const content = getFileContent(file);
      expect(content).not.toContain("electricCollectionOptions");
    }
  });
});
