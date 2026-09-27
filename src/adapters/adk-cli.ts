import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { AxiError } from "axi-sdk-js";

const allowedEnvironmentKeys = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
]);
const maxAdkDiagnosticLength = 4096;

export type AdkSpawnPort = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export async function runAdkCreate(
  projectName: string,
  rootPath: string,
  spawnPort: AdkSpawnPort = spawn,
): Promise<void> {
  const args = [
    "create",
    "--model",
    "<FILL_IN_MODEL>",
    "--type",
    "CODE",
    projectName,
  ];

  await new Promise<void>((resolve, reject) => {
    let child: ChildProcess;
    try {
    child = spawnPort("adk", args, {
      cwd: rootPath,
      env: createAdkEnvironment(process.env),
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    } catch (error) {
      reject(mapSpawnError(error));
      return;
    }

    let settled = false;
    let stderr = "";
    let stderrTruncated = false;
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
      const remaining = maxAdkDiagnosticLength - stderr.length;
      if (remaining <= 0) {
        stderrTruncated = true;
        return;
      }
      stderr += text.slice(0, remaining);
      if (text.length > remaining) stderrTruncated = true;
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(mapSpawnError(error));
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
        return;
      }

      const result = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      const diagnostic = stderrTruncated
        ? `ADK diagnostic exceeded ${maxAdkDiagnosticLength} characters and was omitted for safety`
        : sanitizeAdkDiagnostic(stderr);
      const diagnosticText = diagnostic
        ? `: ${diagnostic}`
        : "";
      reject(new AxiError(`ADK failed to create project ${projectName} (${result})${diagnosticText}`, "ADK_ERROR", [
        "Check that the installed ADK CLI can create code projects, then retry",
      ]));
    });
  });
}

function sanitizeAdkDiagnostic(diagnostic: string): string {
  return diagnostic
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi, "[redacted private key]")
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*$/gi, "[redacted private key]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted API key]")
    .replace(/\b((?:[A-Z0-9_]*(?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|CLIENT[_-]?SECRET|PASSWORD|CREDENTIALS?)[A-Z0-9_]*))\s*[:=]\s*([^\s,;}]+)/gi, "$1=[redacted]")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

export function createAdkEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const filtered: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined && allowedEnvironmentKeys.has(key.toUpperCase())) {
      filtered[key] = value;
    }
  }
  filtered.PYTHONIOENCODING = "utf-8";
  return filtered;
}

function mapSpawnError(error: unknown): AxiError {
  const code = errorCode(error);
  if (code === "ENOENT") {
    return new AxiError("Google ADK CLI `adk` was not found on PATH", "DEPENDENCY_MISSING", [
      "Install Google ADK and make its `adk` command available on PATH",
    ]);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new AxiError(`Could not start Google ADK CLI: ${message}`, "ADK_ERROR", [
    "Check the ADK installation and try again",
  ]);
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}
