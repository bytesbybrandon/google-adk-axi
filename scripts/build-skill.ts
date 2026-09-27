import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createSkillMarkdown } from "../src/skill.ts";

const SKILL_NAME = "google-adk-axi";
const checkOnly = process.argv.slice(2).includes("--check");
const unexpectedArguments = process.argv.slice(2).filter((argument) => argument !== "--check");

if (unexpectedArguments.length > 0) {
  throw new Error(`Unknown option: ${unexpectedArguments[0]}`);
}

const destination = await getSkillDestination();
const generated = createSkillMarkdown();

if (checkOnly) {
  let current: string;
  try {
    current = await readFile(destination, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new Error(`Skill pointer is missing: ${destination}`);
    }
    throw error;
  }

  if (current !== generated) {
    throw new Error(`Skill pointer has drifted: ${destination}`);
  }
  process.stdout.write(`Skill pointer is current: ${destination}\n`);
} else {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, generated, "utf8");
  process.stdout.write(`Wrote skill pointer: ${destination}\n`);
}

async function getSkillDestination(): Promise<string> {
  const registryPath = join(homedir(), ".agents", "sources.json");
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { sources?: unknown };
    if (Array.isArray(registry.sources)) {
      for (const source of registry.sources) {
        if (typeof source !== "string") continue;
        const expanded = source.startsWith("~/") || source.startsWith("~\\")
          ? join(homedir(), source.slice(2))
          : resolve(source);
        try {
          await access(expanded);
          return join(expanded, SKILL_NAME, "SKILL.md");
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }

  return join(homedir(), ".agents", "skills", SKILL_NAME, "SKILL.md");
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}
