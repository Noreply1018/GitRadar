import {
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
  migrateDailyDigestArchives,
} from "../core/archive";

interface MigrateArchivesArgs {
  dryRun: boolean;
}

async function main(): Promise<void> {
  const args = parseMigrateArchivesArgs(process.argv.slice(2));

  console.log("Migrating GitRadar archives...");
  console.log(`Dry run: ${args.dryRun ? "yes" : "no"}`);

  const result = await migrateDailyDigestArchives(process.cwd(), {
    dryRun: args.dryRun,
  });

  console.log(`Archives scanned: ${result.scanned}`);
  console.log(`Already current: ${result.alreadyCurrent}`);
  console.log(`Migrated: ${result.migrated}`);
  console.log(
    `Target schemaVersion: ${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION}`,
  );

  for (const file of result.files.filter((entry) => entry.changed)) {
    console.log(
      `${args.dryRun ? "Would migrate" : "Migrated"} ${file.date}: ${file.fromSchemaVersion} -> ${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION}`,
    );
  }
}

export function parseMigrateArchivesArgs(argv: string[]): MigrateArchivesArgs {
  const supportedArgs = new Set(["--dry-run"]);

  for (const arg of argv) {
    if (!supportedArgs.has(arg)) {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return {
    dryRun: argv.includes("--dry-run"),
  };
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`GitRadar archive migration failed: ${message}`);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return /migrate-archives\.(ts|js)$/.test(entry);
}
