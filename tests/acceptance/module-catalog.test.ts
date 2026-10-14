import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Row = Record<string, unknown>;
type QueryError = { code: string; message: string };
type QueryResult = { data: Row[] | Row | null; error: QueryError | null };
type Catalog = {
  getPublishedModules(): Promise<Row[]>;
  getModuleBySlug(slug: string): Promise<Row | null>;
  getModuleById(id: number): Promise<Row | null>;
};

const legacyModule = {
  id: 70,
  title: "Synthetische module",
  slug: "synthetic-module",
  description: "Bestaande moduleomschrijving",
  short_description: "Bestaande samenvatting",
  order_index: 7,
  thumbnail_url: "https://example.invalid/module-thumbnail.webp",
  is_published: true,
};
const loadError = "De modules konden niet worden geladen. Probeer het opnieuw.";

// Execute the real catalog queries against an in-memory PostgREST boundary.
function moduleCatalog(options: {
  rows?: Row[];
  modernError?: QueryError;
  legacyError?: QueryError;
} = {}) {
  const selected: string[] = [];
  const logged: unknown[][] = [];
  const rows = options.rows ?? [{ ...legacyModule, is_free: true }];
  const dependencies: Record<string, unknown> = {
    "@/lib/supabase/server": {
      createClient: async () => ({
        from(table: string) {
          assert.equal(table, "modules");
          const filters: [string, unknown][] = [];
          const ordering: { column: string; ascending: boolean }[] = [];
          let columns = "";
          function execute(single = false): QueryResult {
            const modern = /(?:^|,)\s*is_free\s*(?:,|$)/.test(columns);
            const error = modern ? options.modernError : options.legacyError;
            if (error) return { data: null, error };
            const data = rows
              .filter((row) => filters.every(([column, value]) => row[column] === value))
              .map((row) => Object.fromEntries(
                columns.split(",").map((column) => column.trim())
                  .filter((column) => column in row)
                  .map((column) => [column, row[column]])
              ));
            data.sort((a, b) => {
              for (const { column, ascending } of ordering) {
                const difference = Number(a[column]) - Number(b[column]);
                if (difference !== 0) return ascending ? difference : -difference;
              }
              return 0;
            });
            return { data: single ? data[0] ?? null : data, error: null };
          }
          const query = {
            select(projection: string) {
              columns = projection;
              selected.push(projection);
              return query;
            },
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return query;
            },
            order(column: string, options: { ascending: boolean }) {
              ordering.push({ column, ascending: options.ascending });
              return query;
            },
            maybeSingle: async () => execute(true),
            then(fulfilled: (result: QueryResult) => unknown, rejected: (error: unknown) => unknown) {
              return Promise.resolve(execute()).then(fulfilled, rejected);
            },
          };
          return query;
        },
      }),
    },
    "@/lib/logger": { logError: (...args: unknown[]) => logged.push(args) },
  };
  const compiled = ts.transpileModule(readFileSync(resolve("lib/modules.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loadedModule = { exports: {} as Catalog };
  runInNewContext(compiled.outputText, {
    exports: loadedModule.exports,
    module: loadedModule,
    require(name: string) {
      assert.ok(name in dependencies, `Missing mock for ${name}`);
      return dependencies[name];
    },
  });
  return { catalog: loadedModule.exports, selected, logged };
}

const reads = [
  (catalog: Catalog) => catalog.getPublishedModules().then((modules) => modules[0] ?? null),
  (catalog: Catalog) => catalog.getModuleBySlug(legacyModule.slug),
  (catalog: Catalog) => catalog.getModuleById(legacyModule.id),
];

function assertLegacyFields(module: Row | null) {
  assert.ok(module);
  for (const [field, value] of Object.entries(legacyModule)) {
    assert.equal(module[field], value, `${field} must survive catalog loading`);
  }
}

test("modern catalog queries keep explicit free flags in a single request", async () => {
  for (const isFree of [true, false]) {
    for (const read of reads) {
      const { catalog, selected } = moduleCatalog({ rows: [{ ...legacyModule, is_free: isFree }] });
      const module = await read(catalog);
      assertLegacyFields(module);
      assert.equal(module?.is_free, isFree);
      assert.equal(selected.length, 1);
    }
  }
});

test("a missing is_free column preserves the catalog with paid access until migration", async () => {
  for (const modernError of [
    { code: "42703", message: "column modules.is_free does not exist" },
    { code: "PGRST204", message: "Could not find the 'is_free' column of 'modules' in the schema cache" },
  ]) {
    for (const read of reads) {
      const { catalog, selected } = moduleCatalog({ rows: [legacyModule], modernError });
      const module = await read(catalog);
      assertLegacyFields(module);
      assert.equal(module?.is_free, false);
      assert.equal(selected.length, 2);
      assert.ok(!selected[1].split(",").map((field) => field.trim()).includes("is_free"));
    }
  }
});

test("genuinely empty catalogs and absent module details retain empty results", async () => {
  for (const modernError of [
    undefined,
    { code: "42703", message: "column modules.is_free does not exist" },
  ]) {
    const { catalog } = moduleCatalog({ rows: [], modernError });
    assert.equal((await catalog.getPublishedModules()).length, 0);
    assert.equal(await catalog.getModuleBySlug("absent-module"), null);
    assert.equal(await catalog.getModuleById(999), null);
  }
});

test("other catalog errors are logged and surfaced instead of appearing as empty data", async () => {
  for (const modernError of [
    { code: "42501", message: "permission denied for table modules" },
    { code: "42703", message: "column modules.thumbnail_url does not exist" },
    { code: "PGRST204", message: "Could not find the 'is_free_label' column of 'modules' in the schema cache" },
    { code: "XX000", message: "Unexpected is_free backend failure" },
  ]) {
    for (const read of reads) {
      const { catalog, selected, logged } = moduleCatalog({ modernError });
      await assert.rejects(read(catalog), { message: loadError });
      assert.equal(selected.length, 1);
      assert.ok(logged.length > 0);
    }
  }
});

test("a failed legacy retry is also surfaced and logged", async () => {
  for (const read of reads) {
    const { catalog, selected, logged } = moduleCatalog({
      modernError: { code: "42703", message: "column modules.is_free does not exist" },
      legacyError: { code: "42501", message: "permission denied for table modules" },
    });
    await assert.rejects(read(catalog), { message: loadError });
    assert.equal(selected.length, 2);
    assert.ok(logged.length > 0);
  }
});
