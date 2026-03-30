import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENV_FILE_NAME = ".env";

export function getManagedEnvPath(rootDir: string): string {
  return path.join(rootDir, ENV_FILE_NAME);
}

export async function readManagedEnv(
  rootDir: string,
): Promise<NodeJS.ProcessEnv> {
  const envPath = getManagedEnvPath(rootDir);
  return parseEnvContent(await readManagedEnvFile(envPath));
}

export async function upsertManagedEnvValue(
  rootDir: string,
  key: string,
  value: string,
): Promise<string> {
  const envPath = getManagedEnvPath(rootDir);
  const currentContent = await readManagedEnvFile(envPath);
  const nextContent = upsertEnvValue(currentContent, key, value);

  await mkdir(path.dirname(envPath), { recursive: true });
  await writeFile(envPath, nextContent, "utf8");

  return envPath;
}

async function readManagedEnvFile(envPath: string): Promise<string> {
  try {
    return await readFile(envPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return "";
    }

    throw error;
  }
}

function parseEnvContent(content: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    result[key] = unquoteEnvValue(value);
  }

  return result;
}

function upsertEnvValue(content: string, key: string, value: string): string {
  const lines = content ? content.split(/\r?\n/) : [];
  const nextLine = `${key}=${value}`;
  let updated = false;

  const nextLines = lines.map((line) => {
    if (line.trimStart().startsWith(`${key}=`)) {
      updated = true;
      return nextLine;
    }

    return line;
  });

  if (!updated) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(nextLine);
  }

  const normalized = nextLines.filter((line, index, array) => {
    return !(index === array.length - 1 && line === "");
  });

  return `${normalized.join("\n")}\n`;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
