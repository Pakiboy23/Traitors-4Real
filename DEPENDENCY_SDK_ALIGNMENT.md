# Dependency and SDK Drift Report

## Scope scanned
- Root app manifests and lockfile (`package.json`, `package-lock.json`).
- `hello-fly` sample service manifests and lockfile.
- Runtime images (`Dockerfile`, `Dockerfile.frontend`, `hello-fly/Dockerfile`).

## Detected drift

### 1) Node runtime drift across services
- Frontend build uses `node:20-alpine`.
- `hello-fly` uses `node:16.19.0-slim`.
- Node 16 is EOL and materially behind Node 20.

**Risk:** inconsistent behavior and security posture across deployments; lockfile/npm behavior differs between major Node/npm releases.

**Alignment proposal:**
- Standardize on Node 20 LTS for all Node workloads.
- Update `hello-fly/Dockerfile` base image to `node:20-alpine` (or `node:20-slim` if glibc is required).

### 2) npm lockfile format drift
- Root lockfile is `lockfileVersion: 3` (npm 9+/10 behavior).
- `hello-fly` lockfile is `lockfileVersion: 2` (npm 7/8-era behavior).

**Risk:** non-deterministic dependency trees when developers/CI run different npm versions.

**Alignment proposal:**
- Re-generate `hello-fly/package-lock.json` using the standardized Node/npm toolchain.
- Optionally add CI checks that fail when lockfile format does not match expected version.

### 3) Toolchain pinning drift risk (missing engines)
- Neither `package.json` currently declares `engines` for Node/npm.

**Risk:** local/CI toolchain drift over time even if Docker images are aligned.

**Alignment proposal:**
- Add explicit `engines` in both package manifests, e.g.:
  - `"node": ">=20 <21"`
  - `"npm": ">=10 <11"`
- Add `.nvmrc` (or `.node-version`) at repo root for developer consistency.

### 4) PocketBase SDK/server alignment status
- Root JS SDK dependency is `pocketbase@^0.25.2`.
- PocketBase server Docker arg is `PB_VERSION=0.25.2`.

**Status:** currently aligned (no version drift detected between JS SDK and server image tag).

**Follow-up recommendation:**
- Keep JS SDK and PocketBase server upgrades coupled in a single PR and smoke-test auth + CRUD flows before release.

## Suggested rollout order
1. Align Node runtime (update `hello-fly/Dockerfile`).
2. Rebuild lockfile(s) with standardized npm.
3. Add `engines` + `.nvmrc`.
4. Add CI guardrails for Node/npm + lockfile version.
