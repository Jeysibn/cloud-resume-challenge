# Mission 5.4.2 dependency security review

Reviewed 2026-10-30 on feat/aws-react-migration with Node 24.22.1 and npm 11.19.1. The npm registry audit is a point-in-time advisory check, not proof that all possible vulnerabilities are absent.

## Before and after

| Audit | Before | After |
| --- | --- | --- |
| Full dependency tree | 7 package entries: 5 high, 2 moderate | 0 |
| Production (`--omit=dev`) | 0 | 0 |

All affected packages are development/testing dependencies. Production dependencies are React and React DOM; neither had an advisory in these audits. The seven entries include Vitest inheriting the mocker finding; they are not seven independent advisories.

| Package | Before → after | Severity before | Dependency path | Available compatible fix | After |
| --- | --- | --- | --- | --- | --- |
| @vitest/mocker | 5.0.0 → 5.0.5 | moderate | vitest → @vitest/mocker | 5.0.3+ | Clear |
| brace-expansion | 5.0.9 → 5.0.12 | high | eslint → minimatch → brace-expansion | 5.0.12 | Clear |
| source-map-js | 1.2.1 → 1.2.2 | high | vite → postcss; @tailwindcss/vite → @tailwindcss/node; jsdom → css-tree | 1.2.2 | Clear |
| undici | 8.10.2 → 8.12.3 | high | jsdom → undici | 8.12.2+ | Clear |
| vite | 8.2.2 → 8.2.4 | high | direct dev dependency (also Tailwind, React plugin, Vitest) | 8.2.4 | Clear |
| vitest | 5.0.0 → 5.0.5 | moderate | direct dev dependency → @vitest/mocker | 5.0.3+ | Clear |
| zod | 4.6.4 → 4.6.7 | high | eslint-plugin-react-hooks → zod; zod-validation-error → zod | 4.6.6+ | Clear |

## Individual advisories

Each issue below was reported by npm audit before the update and is absent afterward. Ranges are the affected ranges reported by the registry. Vitest’s separate moderate entry is inherited from @vitest/mocker.

| Package | Advisory | Severity | Affected range |
| --- | --- | --- | --- |
| @vitest/mocker | [Vitest: Code injection via unauthenticated manual mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | moderate | `>=5.0.0-beta.1 <5.0.3` |
| @vitest/mocker | [Vitest: Windows backslash traversal bypasses the @vitest/mocker redirect allowlist fix](https://github.com/advisories/GHSA-xp26-3454-mjgp) | moderate | `>=5.0.0-rc.2 <5.0.3` |
| brace-expansion | [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | moderate | `>=4.0.0 <5.0.12` |
| brace-expansion | [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | high | `>=4.0.0 <5.0.11` |
| brace-expansion | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | high | `>=4.0.0 <5.0.10` |
| source-map-js | [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | high | `>=1.0.0 <1.2.2` |
| undici | [undici vulnerable to Denial of Service via unbounded memory in the EventSource parser](https://github.com/advisories/GHSA-4qv8-2p9j-2685) | moderate | `>=8.0.0 <8.12.2` |
| undici | [undici vulnerable to Subresource Integrity bypass via non-lowercase algorithm tokens](https://github.com/advisories/GHSA-f72v-6w45-q472) | moderate | `>=8.0.0 <8.12.2` |
| undici | [undici vulnerable to Denial of Service via unhandled error on excessive content-encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c) | high | `>=8.0.0 <8.12.2` |
| undici | [undici vulnerable to cache poisoning and cross-user disclosure via cross-origin redirects](https://github.com/advisories/GHSA-4w7w-5xrc-9h26) | high | `>=8.0.0 <8.12.2` |
| undici | [undici vulnerable to TLS certificate validation bypass via dropped tls options in Agent](https://github.com/advisories/GHSA-2m5v-pch6-74hx) | high | `>=8.0.0 <8.12.2` |
| undici | [undici vulnerable to Denial of Service via TLS 1.2 certificate-changing renegotiation](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) | high | `>=8.0.0 <8.12.2` |
| undici | [undici WebSocket client vulnerable to Denial of Service via unbounded automatic PONG buffering](https://github.com/advisories/GHSA-9fm3-97px-rjf6) | moderate | `>=8.0.0 <8.12.2` |
| undici | [undici vulnerable to Denial of Service via unhandled exception in the decompress interceptor](https://github.com/advisories/GHSA-55wc-3pg8-jfw6) | moderate | `>=8.0.0 <8.12.2` |
| vite | [launch-editor: escapeCmdArgs() omits % escaping on Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | moderate | `>=8.2.0 <=8.2.3` |
| vite | [launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | moderate | `>=8.2.0 <=8.2.3` |
| vite | [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | high | `>=8.2.0 <=8.2.3` |
| vite | [Vite: Cross origin script execution through Vite custom middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | low | `>=8.2.0 <=8.2.3` |
| vite | [Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | moderate | `>=8.2.0 <=8.2.3` |
| vite | [Vite: First 4 bytes of files outside of `server.fs` setting is exposed by `?vite-wasm-instance`](https://github.com/advisories/GHSA-vfpm-58rq-9qcg) | moderate | `>=8.2.0 <=8.2.3` |
| zod | [Zod can exhaust memory while validating oversized constrained collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | high | `<4.6.6` |

## Exposure and update decisions

- Vite advisories concern a running developer server: editor command handling, middleware script execution and filesystem disclosure. Vite is not a runtime service in the S3/CloudFront deployment.
- Vitest mock registration and Windows traversal findings concern the testing/mocking server. Tests should not be exposed as public services.
- Brace expansion, source-map-js and Zod issues involve malicious patterns, source maps or oversized validation input supplied to local tooling.
- Undici issues concern the Node HTTP client used by jsdom: TLS validation, redirect/cache disclosure, integrity checks and denial of service. This dependency is not the browser’s native fetch used by the visitor counter.
- No currently reported dependency vulnerability blocks the static frontend build after these updates. Live AWS API contract, authorization and CORS behavior remain separately unverified; no AWS requests were needed for this review.

Vite was explicitly patched from 8.2.2 to 8.2.4 rather than taking npm’s suggested 8.3.5. Targeted npm updates refreshed Vitest and the vulnerable transitive packages within their existing parent constraints. No force fix, overrides, direct major-version upgrade, React update, or TypeScript 7 migration was applied. Vitest’s patch release itself changes internal dependencies, including obug and why-is-node-running major versions; these are upstream-selected internal tooling dependencies, not application API upgrades. The full local suite validates compatibility.

Other outdated packages were reviewed through npm outdated and left alone because they were not needed to fix these advisories. React/React DOM remain pinned at 19.2.8; TypeScript remains on 5.9.3. npm outdated uses exit code 1 when updates are available; that result is informational.

## Outdated-package review

| Direct package | Installed before | Wanted | Latest reported | Decision |
| --- | --- | --- | --- | --- |
| @axe-core/playwright | 4.13.0 | 4.14.0 | 4.14.0 | Deferred; no reported advisory requiring direct upgrade |
| @playwright/test | 1.63.0 | 1.64.1 | 1.64.1 | Deferred; no reported advisory requiring direct upgrade |
| @testing-library/dom | 10.4.1 | 10.4.2 | 10.4.2 | Deferred; no reported advisory requiring direct upgrade |
| @testing-library/user-event | 14.6.7 | 14.6.8 | 14.6.8 | Deferred; no reported advisory requiring direct upgrade |
| @types/react | 19.2.18 | 19.2.18 | 19.3.0 | Deferred; no reported advisory requiring direct upgrade |
| @types/react-dom | 19.2.5 | 19.2.5 | 19.3.0 | Deferred; no reported advisory requiring direct upgrade |
| @vitejs/plugin-react | 6.1.1 | 6.1.1 | 6.1.2 | Deferred; no reported advisory requiring direct upgrade |
| eslint | 10.10.0 | 10.13.0 | 10.13.0 | Deferred; no reported advisory requiring direct upgrade |
| eslint-plugin-react-refresh | 0.5.6 | 0.5.7 | 0.5.7 | Deferred; no reported advisory requiring direct upgrade |
| globals | 17.12.0 | 17.13.0 | 17.13.0 | Deferred; no reported advisory requiring direct upgrade |
| jsdom | 30.0.1 | 30.1.3 | 30.1.3 | Deferred; no reported advisory requiring direct upgrade |
| playwright | 1.63.0 | 1.64.1 | 1.64.1 | Deferred; no reported advisory requiring direct upgrade |
| react | 19.2.8 | 19.2.8 | 19.3.1 | Deferred; no reported advisory requiring direct upgrade |
| react-dom | 19.2.8 | 19.2.8 | 19.3.1 | Deferred; no reported advisory requiring direct upgrade |
| typescript | 5.9.3 | 5.9.3 | 7.0.2 | Deferred; no reported advisory requiring direct upgrade |
| typescript-eslint | 8.70.0 | 8.72.1 | 8.72.1 | Deferred; no reported advisory requiring direct upgrade |
| vite | 8.2.2 | 8.2.2 | 8.3.5 | Patched to 8.2.4; avoid unrelated minor update |
| vitest | 5.0.0 | 5.0.5 | 5.0.5 | Patched to 5.0.5 |

## Complete lockfile version changes

| Package path | Before | After |
| --- | --- | --- |
| `node_modules/@vitest/mocker` | 5.0.0 | 5.0.5 |
| `node_modules/@vitest/mocker/node_modules/magic-string` | 1.3.1 | 1.4.5 |
| `node_modules/@vitest/spy` | 5.0.0 | 5.0.5 |
| `node_modules/brace-expansion` | 5.0.9 | 5.0.12 |
| `node_modules/chai` | 6.2.2 | 6.3.0 |
| `node_modules/obug` | 2.2.1 | 3.0.0 |
| `node_modules/siginfo` | 2.0.0 | removed |
| `node_modules/source-map-js` | 1.2.1 | 1.2.2 |
| `node_modules/stackback` | 0.0.2 | removed |
| `node_modules/std-env` | 4.2.0 | 4.3.0 |
| `node_modules/tinybench` | 6.1.4 | 6.2.2 |
| `node_modules/tinyexec` | 1.3.0 | 1.3.1 |
| `node_modules/undici` | 8.10.2 | 8.12.3 |
| `node_modules/vite` | 8.2.2 | 8.2.4 |
| `node_modules/vitest` | 5.0.0 | 5.0.5 |
| `node_modules/vitest/node_modules/magic-string` | 1.3.1 | 1.4.5 |
| `node_modules/why-is-node-running` | 2.3.0 | 3.2.1 |
| `node_modules/zod` | 4.6.4 | 4.6.7 |

## Other changes

- Added test:metadata to the existing validate:ci npm command after the build. This remains a local command; no CI/CD configuration or deployment automation was introduced.
- Removed public/social-preview.svg after repository-wide reference searches found no usage. Metadata and artifact tests reference social-preview.png, which remains unchanged. External bookmarked SVG URLs cannot be checked by a repository search.
- AWS client, counter, project content, styling, production metadata, local API configuration and existing browser snapshots are unchanged.

## Validation

Results are recorded below after the clean install and final checks. Browser requests to /visits are intercepted by fixtures, so the checks do not increment the live AWS counter.

| Check | Result |
| --- | --- |
| npm audit before / after | 7 vulnerable package entries → 0 |
| npm audit --omit=dev before / after | 0 → 0 |
| npm outdated | Reviewed; security updates selected, unrelated updates deferred |
| npm ci | Passed, lockfile synchronized, 0 vulnerabilities |
| npm run typecheck | Passed |
| npm run lint | Passed |
| npm test -- --run | Passed: 58 tests in 15 files |
| npm run build | Passed with Vite 8.2.4 |
| npm run test:metadata | Passed against dist/index.html |
| npm run perf:budget | Passed: 79.3 KiB gzip against 180 KiB budget |
| Playwright, isolated local preview on port 4187 | 46 passed, 14 existing viewport-specific skips, 0 failures |
| Preservation check | No changes to src, canonical content, metadata template/config, API configuration, browser tests or snapshots |
| Independent subagent review | Passed; full and production audits independently confirmed clean |

Ready from the frontend dependency-security and local-validation perspective for
manual production deployment. There are no known dependency findings left to block
it. This is not verification of the live AWS environment: confirm the actual API
response contract and browser CORS behavior for the CloudFront origin before the
public release. No AWS resources, deployment, or main-branch merge were performed.
