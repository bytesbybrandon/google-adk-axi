import { resolve } from "node:path";
import { AxiError } from "axi-sdk-js";
import { createProject } from "../application/create-project.js";
import { discoverProjects, inspectProject } from "../domain/project-discovery.js";

export const projectsHelp = [
  "google-adk-axi projects",
  "",
  "Commands:",
  "  list [--root <path>]       Recursively discover projects",
  "  inspect <path>             Inspect one existing directory",
  "  create <name> [--root <path>]  Create a new ADK code project",
  "",
  "Valid flag: --root (list and create only).",
  "Discovery skips hidden and generated directories and does not follow directory symlinks.",
  "Project status reflects agent.py presence only; agent code is never imported or run.",
].join("\n");

export async function projectsCommand(args: string[]): Promise<Record<string, unknown>> {
  const [action, ...actionArgs] = args;
  if (!action) throw usageError();

  if (action === "list") {
    const { positional, root } = parseRootArgs(actionArgs);
    if (positional.length !== 0) {
      throw new AxiError("`projects list` does not accept positional arguments", "VALIDATION_ERROR", [projectsHelp]);
    }
    const projects = await discoverProjects(root);
    return {
      projects_found: projects.length,
      projects_message: `${projects.length} ${projects.length === 1 ? "item" : "items"} found`,
      projects,
    };
  }

  if (action === "inspect") {
    if (actionArgs.length !== 1) {
      throw new AxiError("`projects inspect` requires one directory path", "VALIDATION_ERROR", [projectsHelp]);
    }
    return { ...await inspectProject(actionArgs[0]) };
  }

  if (action === "create") {
    const { positional, root } = parseRootArgs(actionArgs);
    if (positional.length !== 1) {
      throw new AxiError("`projects create` requires one project name", "VALIDATION_ERROR", [projectsHelp]);
    }
    return { created: await createProject(positional[0], root) };
  }

  throw new AxiError(`Unknown projects action: ${action}`, "VALIDATION_ERROR", [projectsHelp]);
}

function parseRootArgs(args: string[]): { positional: string[]; root: string } {
  const positional: string[] = [];
  let root = process.cwd();
  let rootSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--root") {
      if (rootSeen || index + 1 >= args.length || args[index + 1].startsWith("--")) {
        throw new AxiError("`--root` requires one path and may be used once", "VALIDATION_ERROR", [projectsHelp]);
      }
      root = resolve(args[index + 1]);
      rootSeen = true;
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new AxiError(`Unknown option: ${argument}`, "VALIDATION_ERROR", [projectsHelp]);
    }
    positional.push(argument);
  }

  return { positional, root };
}

function usageError(): AxiError {
  return new AxiError("Missing projects action", "VALIDATION_ERROR", [projectsHelp]);
}
