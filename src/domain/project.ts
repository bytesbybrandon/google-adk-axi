import { basename, resolve } from "node:path";

export type ProjectStatus = "ready" | "missing-entrypoint";

export interface ProjectRecord {
  name: string;
  path: string;
  entrypoint: "agent.py" | null;
  status: ProjectStatus;
}

export function projectRecord(projectPath: string, hasEntrypoint: boolean): ProjectRecord {
  return {
    name: basename(projectPath),
    path: resolve(projectPath),
    entrypoint: hasEntrypoint ? "agent.py" : null,
    status: hasEntrypoint ? "ready" : "missing-entrypoint",
  };
}
