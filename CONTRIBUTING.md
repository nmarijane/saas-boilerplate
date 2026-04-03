# Contributing to saas-boilerplate

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Conventions](#conventions)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

---

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/saas-boilerplate.git
cd saas-boilerplate

# 2. Install dependencies
npm install

# 3. Start dev server (no env vars needed — uses PGlite in-memory DB)
npm run dev
```

That's it. The app runs at [http://localhost:3000](http://localhost:3000) with no external services required.

### Optional: Run with PostgreSQL

```bash
# Copy and fill in env vars
cp .env.example .env.local

# Set DATABASE_URL to your PostgreSQL connection string, then:
npm run db:migrate
npm run db:seed   # Creates plans, admin user, and a dev user
npm run dev
```

### Running Tests

```bash
npm run test          # Unit + integration tests (Vitest)
npm run test:e2e      # End-to-end tests (Playwright)
npm run test:watch    # Watch mode
```

### Storybook

```bash
npm run storybook     # http://localhost:6006
```

---

## Project Structure

```
src/
  app/                  # Next.js routes (App Router)
  features/             # Feature modules — each feature is self-contained
  shared/               # Shared components, hooks, and lib utilities
  models/               # Drizzle ORM schemas
  locales/              # Translation files (en.json, fr.json)
```

Each feature module in `src/features/` owns its own components, server actions, hooks, and tests. When adding a feature, keep everything inside its folder and minimize cross-feature dependencies.

---

## Conventions

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Pre-commit hooks enforce the format.

```
feat(auth): add passkey support
fix(billing): handle webhook signature mismatch
docs(readme): update deployment section
chore(deps): bump Next.js to 16.2
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change with no feature/fix |
| `test` | Adding or fixing tests |
| `chore` | Tooling, deps, config |
| `perf` | Performance improvement |

### Code Style

- **TypeScript strict mode** — no `any`, no type assertions without comment
- **ESLint + Prettier** run automatically on commit (via `lefthook`)
- **Zod** for all external input validation
- **Server Actions** for mutations — no direct API routes unless needed for webhooks/external access
- **`safeAction`** wrapper for all server actions (see `src/shared/lib/safe-action.ts`)

Run checks manually:

```bash
npm run lint          # ESLint
npm run check:types   # TypeScript
npm run format        # Prettier
npm run check:deps    # Unused dependencies (Knip)
```

### Internationalization

All user-facing strings must be added to both `src/locales/en.json` and `src/locales/fr.json`. Use the `useTranslations` hook from `next-intl`.

---

## Pull Request Process

1. **Branch from `main`** using a descriptive name:
   - `feat/passkey-support`
   - `fix/stripe-webhook-signature`
   - `docs/deployment-guide`

2. **Keep PRs small and focused** — one logical change per PR. Large PRs are slow to review and more likely to conflict.

3. **Write or update tests** for any changed behavior. The CI will check coverage.

4. **Update documentation** if you're changing behavior, adding features, or modifying env vars.

5. **Fill in the PR template** — describe what changed and why.

6. **Claude Code AI reviewer** will automatically review your PR for security, quality, and convention adherence. Address its comments or explain why you disagree.

7. **All CI checks must pass** before merge:
   - Lint, typecheck, test, build, Storybook, audit

### What Gets Merged

We prioritize:
- Bug fixes with test coverage
- Performance improvements with benchmarks
- Documentation improvements
- New features that fit the project's scope (auth, billing, SaaS infrastructure)

We generally decline:
- Features that add heavy dependencies for niche use cases
- Breaking changes to the public API without a migration path
- PRs that reduce test coverage

---

## Reporting Issues

Use the GitHub issue templates:

- **[Bug report](.github/ISSUE_TEMPLATE/bug_report.yml)** — unexpected behavior, errors, crashes
- **[Feature request](.github/ISSUE_TEMPLATE/feature_request.yml)** — ideas for new features or improvements

Before opening an issue, check if it already exists. For questions, use [GitHub Discussions](https://github.com/nmarijane/saas-boilerplate/discussions).

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
