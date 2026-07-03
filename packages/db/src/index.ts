import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface MigrationResult {
  mode: "dry-run" | "database";
  files: string[];
}

export function listMigrationFiles(migrationsDir = "database/migrations"): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => join(migrationsDir, file));
}

export async function runMigrations(options: {
  databaseUrl?: string;
  migrationsDir?: string;
  dryRun?: boolean;
}): Promise<MigrationResult> {
  const files = listMigrationFiles(options.migrationsDir);
  if (!options.databaseUrl || options.dryRun) {
    for (const file of files) readFileSync(file, "utf8");
    return { mode: "dry-run", files };
  }

  const { SQL } = await import("bun");
  const sql = new SQL(options.databaseUrl);
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  for (const file of files) {
    const rows = await sql`SELECT filename FROM schema_migrations WHERE filename = ${file}`;
    if (rows.length > 0) continue;
    await sql.unsafe(readFileSync(file, "utf8"));
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
  }

  await sql.close();
  return { mode: "database", files };
}
