# Dependency security check

**Checked:** 2026-11-01 against the current `package-lock.json`, using npm 11.19.1. Registry results can change, so run the commands below for a fresh check.

## Results

| Command | Result |
| --- | --- |
| `npm audit` | 12 moderate findings in the development-tool dependency tree. npm traces them to `minimatch` through ESLint and TypeScript lint packages. |
| `npm audit --omit=dev` | 0 findings in production dependencies. |

The audit offers a fix only with `npm audit fix --force`, which would downgrade or otherwise change major development tooling. That command was not run. These findings do not change the deployed website bundle, but they remain a risk for local and CI development tools. Review them before upgrading dependencies; rerun the tests after any update.

## Recheck

From `frontend/app`:

```bash
npm ci
npm audit
npm audit --omit=dev
```

This is a snapshot of npm's advisories, not a complete security review of the application or AWS account. The GitHub Actions workflow currently runs typecheck, lint, unit tests, and a production build; it does not run `npm audit`.
