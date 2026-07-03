import { runMigrations } from "../packages/db/src";

const result = await runMigrations({
  databaseUrl: Bun.env.DATABASE_DIRECT_URL || Bun.env.DATABASE_URL,
  dryRun: !Bun.env.DATABASE_DIRECT_URL && !Bun.env.DATABASE_URL
});

console.log(
  JSON.stringify(
    {
      mode: result.mode,
      files: result.files
    },
    null,
    2
  )
);
