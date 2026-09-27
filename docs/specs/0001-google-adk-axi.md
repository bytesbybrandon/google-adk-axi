# Spec 0001: Google ADK AXI MVP

Status: Complete.

Tier: Beta.

Scope: [Google ADK AXI MVP scope](../scope/google-adk-axi.md).

## Goal

Provide an agent-oriented CLI for discovering, inspecting, and creating local Google ADK Python agent projects.

The MVP uses local filesystem discovery and direct calls to the Google ADK CLI.

The CLI has no background daemon or persistent project database.

## Command surface

- `google-adk-axi projects list [--root <path>]` discovers projects below the root, which defaults to the current working directory.
- `google-adk-axi projects inspect <path>` reports the selected directory and its entrypoint status.
- `google-adk-axi projects create <name> [--root <path>]` creates a new project below the root.

## Project discovery and output

Discovery walks directories recursively below the selected root.

Discovery skips hidden directories and common generated directories, including `.git`, `.venv`, `venv`, `node_modules`, `dist`, `build`, and `__pycache__`.

Discovery does not follow directory symlinks.

A directory is a project candidate when it contains `agent.py` or an `__init__.py` that imports `.agent`.

The list output contains exactly four fields: `name`, `path`, `entrypoint`, and `status`.

`name` is the candidate directory name.

`path` is its normalized absolute path.

`entrypoint` is the relative path `agent.py` when that file exists, and `null` otherwise.

`status` is `ready` when `agent.py` exists, and `missing-entrypoint` otherwise.

`ready` reports structural presence only; it does not validate imports, dependencies, model configuration, or credentials.

List results are sorted by absolute path using case-insensitive ordering.

Inspection accepts an existing directory even when it is not discovered as a candidate, and reports `missing-entrypoint` when `agent.py` is absent.

The output format is TOON with stable field names and types.

## Project creation

Creation requires a valid project name and a destination path that does not already exist.

Project names follow ADK's code project rules: they start with an ASCII letter, contain only letters, digits, underscores, or hyphens, and cannot be `user`.

Creation invokes the installed `adk` executable directly as `adk create --model <FILL_IN_MODEL> --type CODE <name>` and closes standard input so the operation cannot wait for prompts.

Creation does not collect or pass API keys, cloud credentials, or project secrets.

The ADK subprocess preserves standard home-directory path variables for normal OS path resolution.

The generated project requires model and authentication configuration before it can run.

The AXI requires Node.js 22.18 or later for its version-only fast path.

The AXI returns the created project path on success.

The AXI returns an actionable error when `adk` is unavailable, the name or path is invalid, the destination already exists, or ADK exits unsuccessfully.

Failed ADK diagnostics are bounded and sanitized before inclusion in the structured error.

If ADK leaves partial files, the AXI preserves them and reports the destination path with inspect and cleanup guidance.

The AXI never overwrites an existing destination.

## Acceptance criteria

1. `projects list` recursively discovers code-based ADK projects under the selected root and skips the specified hidden and generated directories.
2. Every list row has exactly `name`, `path`, `entrypoint`, and `status` with the definitions above.
3. `projects inspect` reports `ready` for a directory with `agent.py` and `missing-entrypoint` for an existing directory without it.
4. `projects create` creates a project through the ADK CLI without interactive input or credential collection.
5. `projects create` never overwrites an existing destination and reports success or failure as structured output.
6. The Beta test suite covers list, inspect, create, invalid inputs, missing `adk`, ADK process failures, and retained partial output without network access or real credentials.
7. User-facing documentation explains installation, project discovery, creation, and the required model and authentication setup before running a created agent.

## Build plan

1. Scaffold the AXI package and concise command surface.
2. Implement project discovery and inspection with the four-field schema.
3. Implement safe noninteractive creation through the ADK CLI.
4. Add the Beta test suite using a controlled stand-in for the `adk` executable.
5. Verify behavior, review errors and output, and write usage documentation.

Manual verification steps: [verify.md](verify.md).

## Decision record

The user selected the MVP delivery approach and Beta workflow tier.

The user approved recursive current-directory discovery, code projects with `agent.py`, structural status checks, and noninteractive creation with the official fill-in model placeholder.

The user approved this spec on 2026-09-27.

Partial ADK output is preserved to avoid deleting files created by a failed external process; errors point to the retained path and explain recovery.

ADR needed: No.

The decisions are local to this CLI and are recorded here without introducing persistent state or a separate architecture decision record.

## Value sources

- `name`, `path`, and `entrypoint` come from the discovered filesystem paths.
- `status` comes only from the presence of `agent.py`.
- The four list field names, status labels, Python scope, direct CLI behavior, and no-daemon constraint come from user approval.
- The code project layout and command behavior follow the [Google ADK Python getting-started guide](https://github.com/google/adk-python/blob/main/.agents/skills/adk-agent-builder/references/getting-started.md).
- The placeholder model and project creation behavior follow the [Google ADK Python create implementation](https://github.com/google/adk-python/blob/main/src/google/adk/cli/cli_create.py).
- Project name validation follows the [Google ADK Python app-name validator](https://github.com/google/adk-python/blob/main/src/google/adk/apps/app.py).
- The Node.js runtime floor follows [Node.js 22.18 TypeScript support](https://nodejs.org/en/blog/release/v22.18.0).

## Alternatives considered

- Immediate-child-only scanning was not selected because the user accepted recursive discovery.
- YAML config projects and import-time validation were not selected for the MVP.
- Requiring credentials during creation was not selected because the user accepted a noninteractive, credential-free create flow.
- An AXI-maintained project template was not selected because the user approved direct calls to the ADK CLI.
