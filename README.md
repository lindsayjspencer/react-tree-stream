# react-tree-stream (monorepo)

This repo contains the package `react-tree-stream` and a separate `test` project.

## Scripts
- `pnpm build` – builds the package
- `pnpm test` – runs tests in the `test` project
- `pnpm release` – builds then publishes via Changesets

## CI & Release
- `.github/workflows/ci.yml` runs build + tests on pushes/PRs.
- `.github/workflows/release.yml` publishes to npm from `main` after CI, using `NPM_TOKEN` and `GH_TOKEN`.