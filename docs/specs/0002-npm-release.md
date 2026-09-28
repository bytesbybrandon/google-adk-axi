# Spec 0002: npm CI and Release

Status: Implemented and bootstrapped on npm.

Tier: Beta.

Scope: Continuous integration and publishing for the `google-adk-axi` npm package.

## Goal

Run the same quality gates for pull requests, the main branch, and releases.

Publish only after a maintainer deliberately publishes a GitHub Release whose tag matches the package version.

Use npm trusted publishing through GitHub Actions OIDC without a long-lived npm publish token.

## Continuous integration

Run CI for pull requests and pushes to `main`.

Store this workflow as `.github/workflows/ci.yml`.

Use GitHub-hosted Ubuntu runners and test the supported Node.js floor, 22.18.x, plus Node.js 24.x.

Run `npm ci`, `npm test`, and `npm audit --audit-level=high` on both Node.js versions.

Create the package tarball and install it into a clean temporary project.

Run the installed `google-adk-axi --version` command as a packaged CLI smoke check.

Check the tarball against an explicit allowlist so it contains runtime files and public documentation only.

Exclude maintainer-only generators, repository metadata, local configuration, test fixtures, and secrets from the tarball.

The prior package dry run included `scripts/build-skill.ts`, so the package file list now enumerates only required runtime files and public documents.

The launcher imports compiled JavaScript because Node does not allow TypeScript stripping for files installed under `node_modules`.

The package no longer declares an automatic `prepare` build; package verification builds before packing, and consumers install the compiled runtime.

The `verify:package` script builds the package, checks the tarball against an exact allowlist, installs it into a temporary consumer project, and runs the installed CLI version command.

Pass `--keep` to retain the tarball under the ignored `dist` directory for local hands-on testing.

## Release workflow

Store the release workflow as `.github/workflows/npm-publish.yml`.

Trigger publishing only when a GitHub Release is published for a tag matching `v*`.

Require the release workflow to rerun the CI gates and confirm that the tag version exactly matches `package.json` and `package-lock.json`.

Require the GitHub prerelease flag to match the package version's SemVer prerelease status.

Build and smoke-test the exact tarball that will be published.

Publish GitHub prereleases to the npm `beta` dist-tag and stable GitHub Releases to the npm `latest` dist-tag.

Use Node.js 24 and npm CLI 11.5.1 or later for the publish job.

Grant `id-token: write` only to the publish job and keep other workflow permissions read-only.

Configure npm trusted publishing for GitHub user `bytesbybrandon`, repository `google-adk-axi`, workflow filename `npm-publish.yml`, and an optional matching `npm-production` environment.

Allow the trusted publisher to run `npm publish` because this workflow publishes directly after a GitHub Release is approved.

Do not use an npm publish token or publish from pull request and ordinary branch workflows.

Pin GitHub Actions to reviewed full commit SHAs.

## First-publish bootstrap

npm requires the package to exist before a trusted publisher can be configured.

Publish the first beta package manually with interactive account authentication and 2FA, after local verification and explicit release approval.

Do not create or use a long-lived npm token for this bootstrap publish.

The npm trusted publisher is configured for `bytesbybrandon/google-adk-axi` and `npm-publish.yml` with direct publishing allowed.

The user manually published `google-adk-axi@0.1.0` on 2026-09-28 after local package verification, using interactive npm authentication and 2FA.

The npm `beta` and `latest` dist-tags currently both point to `0.1.0`.

Subsequent releases use the automated OIDC workflow.

The manually published bootstrap version will not have an OIDC provenance attestation; subsequent provenance requires both the GitHub repo and npm package to be public.

## Repository gates

Require a pull request and passing CI checks before changes merge to `main`.

Block force pushes and branch deletion on `main`.

Do not require a review count until another reviewer is available.

The active `Protect main with CI` ruleset requires both Node.js checks, resolves review threads, blocks deletion, and blocks force pushes.

Publishing a GitHub Release is the maintainer's explicit release approval for later OIDC releases.

## Provenance and visibility

npm trusted publishing can authenticate releases from a private GitHub repository through OIDC.

npm provenance attestations require both the source repository and npm package to be public.

The GitHub repository is public, and the npm package must also be public before an automated OIDC release can include provenance.

New npm trusted publisher configurations default to allowing staged publishing, so enable direct `npm publish` for this workflow.

Trusted publishing from GitHub Actions generates provenance automatically when both the repository and package are public.

## Acceptance criteria

1. Pull requests and pushes to `main` run the supported Node.js matrix and all configured quality gates.
2. A pull request cannot merge into `main` unless required CI checks pass whenever the repository's GitHub plan supports that control.
3. The packed package contains only its approved runtime files, documentation, and license.
4. The installed packed CLI passes its version smoke check.
5. Only a published version-matched GitHub Release can reach the npm publish job, with prereleases routed to `beta` and stable releases routed to `latest`.
6. The publish job uses npm trusted publishing with narrowly scoped OIDC permissions and no long-lived npm publish token.
7. Post-bootstrap OIDC releases either publish from public source and package repositories with provenance or clearly lack provenance while the source repository is private.
8. The first package version is manually bootstrapped only after local verification, then trusted publishing is configured before automated releases.

## Decision record

The repository is public per the user's decision on 2026-09-28.

The user intended to test the AXI locally before the first npm publication.

The user completed local package verification on Node.js 22.18.0 before publishing.

The user approved and completed the manual `google-adk-axi@0.1.0` bootstrap publish on 2026-09-28.

The npm `beta` and `latest` dist-tags both currently point to `0.1.0`.

The GitHub Actions trusted publisher is configured for `bytesbybrandon/google-adk-axi` and `npm-publish.yml` with direct publishing allowed.

The user approved implementation on 2026-09-27.

The GitHub repository and npm package must both be public before an automated OIDC release to obtain provenance.

The manually published bootstrap version will not have an OIDC provenance attestation.

The first package version was published manually before npm allowed its trusted publisher to be configured.

The next automated release must use a version that has not already been published to npm.

ADR needed: No.

## Value sources

- npm OIDC requirements and provenance visibility conditions follow the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).
- GitHub ruleset plan availability follows [GitHub's ruleset availability documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
- GitHub environment reviewer plan availability follows [GitHub's environment documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
- Workflow permission and action pinning practices follow [GitHub's secure use reference](https://docs.github.com/en/actions/reference/security/secure-use).
