import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AxiError } from "axi-sdk-js";
import { projectRecord, type ProjectRecord } from "./project.js";
import { assertExistingDirectory } from "./root-directory.js";

const skippedDirectories = new Set([
  ".git",
  ".venv",
  "venv",
  "node_modules",
  "dist",
  "build",
  "__pycache__",
]);

export async function discoverProjects(rootPath: string): Promise<ProjectRecord[]> {
  const root = resolve(rootPath);
  await assertExistingDirectory(root, "Project root");

  const projects: ProjectRecord[] = [];
  const pendingDirectories = [root];

  while (pendingDirectories.length > 0) {
    const current = pendingDirectories.pop();
    if (!current) continue;

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || shouldSkipDirectory(entry.name)) continue;

      const projectPath = join(current, entry.name);
      if (await isProjectCandidate(projectPath)) {
        projects.push(await inspectProject(projectPath));
      }
      pendingDirectories.push(projectPath);
    }
  }

  return projects.sort(compareProjectPaths);
}

export async function inspectProject(projectPath: string): Promise<ProjectRecord> {
  const absolutePath = resolve(projectPath);
  await assertExistingDirectory(absolutePath, "Project path");
  return projectRecord(absolutePath, await isRegularFile(join(absolutePath, "agent.py")));
}

function shouldSkipDirectory(name: string): boolean {
  return name.startsWith(".") || skippedDirectories.has(name.toLowerCase());
}

async function isProjectCandidate(directoryPath: string): Promise<boolean> {
  if (await isRegularFile(join(directoryPath, "agent.py"))) return true;

  const initializerPath = join(directoryPath, "__init__.py");
  if (!(await isRegularFile(initializerPath))) return false;

  const source = await readTextFile(initializerPath);
  return /^\s*from\s+\.agent\b/m.test(source) ||
    /^\s*from\s+\.\s+import\b[^\n]*\bagent\b/m.test(source);
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw filesystemError(`Could not inspect ${filePath}`, error);
  }
}

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return "";
    throw filesystemError(`Could not read ${filePath}`, error);
  }
}

function compareProjectPaths(left: ProjectRecord, right: ProjectRecord): number {
  const leftKey = left.path.toLocaleLowerCase("en-US");
  const rightKey = right.path.toLocaleLowerCase("en-US");
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

function filesystemError(message: string, cause: unknown): AxiError {
  return new AxiError(`${message}: ${cause instanceof Error ? cause.message : String(cause)}`, "FILESYSTEM_ERROR");
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}
