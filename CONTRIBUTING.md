# Contributing

Thanks for helping improve Google ADK AXI.

## Development setup

Use Node.js 22.18 or later.

Run `npm ci` to install the locked dependencies.

Run `npm run build` to compile the TypeScript source.

Run `npm test` to run the Beta suite.

The automated suite uses a controlled `adk` stand-in and does not need network access or credentials.

Install Google ADK only when you need to check project creation against the real `adk` CLI.

## Change guidelines

Add or update tests for behavior changes.

Keep project discovery structural; never import or execute discovered agent code.

Keep creation noninteractive, credential-free, and safe from overwriting existing directories.

Update the README or specification when a user-visible contract changes.

Do not commit local environment files, credentials, generated workspace state, or temporary package archives.

## Pull requests

Open a pull request with a concise summary of the change and its motivation.

Include the verification commands you ran and any relevant results.

Call out behavior changes, compatibility concerns, and follow-up work.
