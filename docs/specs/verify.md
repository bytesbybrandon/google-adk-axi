# Google ADK AXI Manual Verification

Run these checks from the project directory with Node.js 22.18 or later.

## Build and automated checks

- Run `npm install` and confirm installation completes without errors.
- Run `npm test` and confirm the Beta suite passes.
- Run `npm run build:skill -- --check` and confirm the skill pointer is current.

## Packaged CLI local test

- Run `npm run verify:package -- --keep` and confirm the package allowlist check and installed CLI smoke check pass.
- Confirm the versioned package tarball is written under `dist`.
- In PowerShell, create a temporary install and point `$axi` at its installed CLI.

```powershell
$testRoot = Join-Path $env:TEMP ("google-adk-axi-local-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testRoot | Out-Null
$tarball = Get-ChildItem .\dist\google-adk-axi-*.tgz | Sort-Object LastWriteTime -Descending | Select-Object -First 1
npm install --prefix $testRoot $tarball.FullName
$axi = Join-Path $testRoot "node_modules\.bin\google-adk-axi.cmd"
& $axi --version
```

- Confirm the installed command prints `0.1.0`.
- Run `& $axi projects list --root "<workspace-path>"` and `& $axi projects inspect "<project-path>"` against a known ADK workspace.
- Confirm the list command only reads directory structure and does not execute agent code.
- With the ADK CLI available, run `$axi projects create axi-local-verify --root <temporary-root>` and confirm the generated project is not run until its model and authentication are configured.
- The GitHub repository is public per the user's decision.
- Complete and review the local package check before the first npm publication.

## Version and home view

- Run `node bin/google-adk-axi.js --version` and confirm it prints `0.1.0`.
- Run `node bin/google-adk-axi.js` and confirm TOON output includes the current workspace, project count, empty-state message when no projects exist, and `next_step`.

## Discovery and inspection

- Create a temporary root with a child directory containing `agent.py` and another child directory containing `__init__.py` with `from . import agent`.
- Add a non-project child directory and an `agent.py` under `.venv`, `node_modules`, or another skipped directory.
- Run `node bin/google-adk-axi.js projects list --root <temporary-root>` and confirm only the two candidates appear with exactly `name`, `path`, `entrypoint`, and `status` in each row.
- Confirm the `agent.py` project is `ready` and the initializer-only candidate is `missing-entrypoint`.
- Run `node bin/google-adk-axi.js projects inspect <agent-project-path>` and confirm it reports `ready`.
- Run `node bin/google-adk-axi.js projects inspect <empty-directory-path>` and confirm it reports `missing-entrypoint`.
- Confirm discovery and inspection do not import or execute project code.

## Creation and error handling

- With the ADK CLI installed, run `node bin/google-adk-axi.js projects create axi-verify-<unique-suffix> --root <temporary-root>`.
- Confirm the command returns the new absolute path and the generated directory contains `agent.py`.
- Confirm the ADK command receives the fill-in model placeholder and does not receive credentials.
- Run create again with the same name and confirm it reports that the destination already exists without changing its contents.
- Run create with an invalid name such as `../outside` and confirm it returns a structured validation error.
- Confirm a created agent is not run until its model and authentication are configured.
- The Beta suite also exercises a failed ADK subprocess that leaves partial output; confirm the structured error preserves and names that directory and sanitizes its diagnostic.

## CLI errors

- Run `node bin/google-adk-axi.js --unknown-flag` and confirm it exits with code `2` and returns a TOON error with the supported flags.
- The automated suite covers missing `adk`, failed ADK processes, and invalid command arguments with a controlled process stub.
- Confirm `projects inspect -workspace` accepts a valid relative directory path beginning with a dash.
