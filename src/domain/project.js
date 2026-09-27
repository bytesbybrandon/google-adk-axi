import { basename, resolve } from "node:path";
export function projectRecord(projectPath, hasEntrypoint) {
    return {
        name: basename(projectPath),
        path: resolve(projectPath),
        entrypoint: hasEntrypoint ? "agent.py" : null,
        status: hasEntrypoint ? "ready" : "missing-entrypoint",
    };
}
