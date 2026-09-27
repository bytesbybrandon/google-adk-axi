import { mkdir, lstat, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AxiError } from "axi-sdk-js";
import { runAdkCreate, type AdkSpawnPort } from "../adapters/adk-cli.js";
import { inspectProject } from "../domain/project-discovery.js";
import type { ProjectRecord } from "../domain/project.js";
import { assertExistingDirectory } from "../domain/root-directory.js";

const validProjectName = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export async function createProject(
  projectName: string,
  rootPath: string,
  spawnPort?: AdkSpawnPort,
): Promise<ProjectRecord> {
  validateProjectName(projectName);
  const root = resolve(rootPath);
  await assertExistingDirectory(root, "Project root");
  const targetPath = join(root, projectName);

  await assertDestinationIsNew(targetPath);
  try {
    await mkdir(targetPath);
  } catch (error) {
    if (errorCode(error) === "EEXIST") {
      throw destinationExists(targetPath);
    }
    throw new AxiError(`Could not reserve project path ${targetPath}`, "FILESYSTEM_ERROR", [
      "Check that the project root is writable",
    ]);
  }

  try {
    await runAdkCreate(projectName, root, spawnPort);
  } catch (error) {
    const cleanup = await removeEmptyReservation(targetPath);
    if (cleanup.kind === "retained") {
      throw withRetainedOutput(error, targetPath, cleanup.detail);
    }
    throw error;
  }

  const project = await inspectProject(targetPath);
  if (project.status !== "ready") {
    const error = new AxiError(`ADK finished without creating agent.py at ${targetPath}`, "ADK_ERROR", [
      "Inspect the created directory and retry with an ADK code project",
    ]);
    const cleanup = await removeEmptyReservation(targetPath);
    if (cleanup.kind === "retained") {
      throw withRetainedOutput(error, targetPath, cleanup.detail);
    }
    throw error;
  }
  return project;
}

function validateProjectName(projectName: string): void {
  if (!validProjectName.test(projectName) || projectName === "user") {
    throw new AxiError(
      `Invalid project name: ${projectName}`,
      "VALIDATION_ERROR",
      ["Use a name starting with a letter, followed by letters, digits, underscores, or hyphens; `user` is reserved"],
    );
  }
}

async function assertDestinationIsNew(targetPath: string): Promise<void> {
  try {
    await lstat(targetPath);
    throw destinationExists(targetPath);
  } catch (error) {
    if (error instanceof AxiError) throw error;
    if (errorCode(error) !== "ENOENT") {
      throw new AxiError(`Could not inspect project path ${targetPath}`, "FILESYSTEM_ERROR");
    }
  }
}

function destinationExists(targetPath: string): AxiError {
  return new AxiError(`Project destination already exists: ${targetPath}`, "ALREADY_EXISTS", [
    "Choose another project name or root path",
  ]);
}

type ReservationCleanup =
  | { kind: "removed" }
  | { kind: "retained"; detail: string };

async function removeEmptyReservation(targetPath: string): Promise<ReservationCleanup> {
  try {
    await rmdir(targetPath);
    return { kind: "removed" };
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return { kind: "removed" };
    if (code === "ENOTEMPTY" || code === "EEXIST") {
      return { kind: "retained", detail: "ADK left files in the destination." };
    }
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "retained", detail: `The destination could not be removed (${reason}).` };
  }
}

function withRetainedOutput(error: unknown, targetPath: string, detail: string): AxiError {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof AxiError ? error.code : "ADK_ERROR";
  const previousSuggestions = error instanceof AxiError ? error.suggestions : [];
  return new AxiError(
    `${message} ${detail} Partial project output remains at ${targetPath}`,
    code,
    [
      ...previousSuggestions,
      `Inspect ${targetPath} before retrying`,
      `If the partial output is not needed, remove ${targetPath} and retry`,
    ],
  );
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}
