# Google ADK AXI

Google ADK AXI lists, inspects, and creates local Google ADK Python projects.

## Requirements

Use Node.js 22.18 or later.

Install the Google ADK Python package and ensure its `adk` command is available on `PATH` before creating projects.

See the [Google ADK getting-started guide](https://github.com/google/adk-python/blob/main/.agents/skills/adk-agent-builder/references/getting-started.md) for ADK installation and setup.

## Local installation

Run `npm install` in this repository.

Run `npm run build` to compile the typed source files.

Run `npm link` to make `google-adk-axi` available on `PATH` for local development.

## Commands

Run `google-adk-axi projects list [--root <path>]` to discover projects below the current directory or a selected root.

Run `google-adk-axi projects inspect <path>` to inspect any existing project directory.

Run `google-adk-axi projects create <name> [--root <path>]` to create a new code project through the installed ADK CLI.

The selected root for listing and creation must already exist.

Project names must start with a letter, contain only letters, digits, underscores, or hyphens, and cannot be `user`.

Creation refuses any existing destination and invokes `adk create` with closed standard input.

Creation passes the model placeholder `<FILL_IN_MODEL>` and does not pass API keys, cloud credentials, or project secrets.

It preserves standard home-directory path variables so the installed ADK runtime can resolve user paths.

If ADK fails after writing files, the AXI keeps the partial output and reports its path so you can inspect it or remove it before retrying.

Failed ADK output includes a bounded, sanitized summary of its diagnostic message.

## Discovery and status

Discovery walks recursively below the selected root and skips hidden directories and common generated directories such as `.git`, `.venv`, `venv`, `node_modules`, `dist`, `build`, and `__pycache__`.

Discovery does not follow directory symlinks.

A project is listed when it contains `agent.py` or an `__init__.py` with a relative import of `.agent`.

Each project row contains `name`, normalized absolute `path`, `entrypoint`, and `status`.

`status` is `ready` only when `agent.py` is present; otherwise it is `missing-entrypoint`.

Status checks are structural and never import or execute discovered agent code.

## Configure and run a created project

After creation, replace `<FILL_IN_MODEL>` in the generated agent with a model supported by your backend.

Configure the matching authentication for Google AI or Vertex AI before running the agent.

Follow the [Google ADK model setup guide](https://google.github.io/adk-docs/agents/models/) for backend-specific configuration.

Once configured, use `adk run <project-path>` to run the agent.

## Development

Run `npm test` for the local Beta suite; it uses temporary directories and a controlled stand-in for the `adk` executable.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and verification commands.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## License

See [LICENSE](LICENSE) for license terms.
