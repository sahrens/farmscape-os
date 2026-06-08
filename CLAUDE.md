# Claude Instructions — FarmscapeOS

## CRITICAL RULE: NO PRIVATE CONTENT IN THIS REPO

This is a **PUBLIC, open-source** repository. Every file, every commit, every line of history is visible to the entire internet.

**NEVER add any of the following to this repository:**

- Business plans, financial projections, economic analyses, pricing, revenue numbers
- Real personal names (except repo owner for git attribution), addresses, phone numbers, emails
- Farm-specific data: crop yields, supplier names, employee details, compensation, partnerships
- API keys, secrets, tokens, passwords, database IDs
- Legal documents, visa information, immigration details
- Any markdown document containing sensitive business or personal information

**ALL private content belongs in the private deployment wrapper repo** (which uses this as a submodule).

## Architecture

This repo is the **generic, reusable OSS application**. It is deployed via a private wrapper repo that provides:

- Farm-specific configuration (`*.config.ts`)
- Private content files (business docs, economics, plans)
- Cloudflare secrets and D1 database bindings
- The `wrangler.toml` that ties everything together

### Pattern for features that need private data

```
PUBLIC REPO (this):     Generic page component + API route handler (no content)
PRIVATE REPO (wrapper): Actual content files + wrangler config to serve them
```

The public repo provides the **mechanism**. The private repo provides the **content**.

## Before committing

Always verify:
1. No sensitive content in any added/modified files
2. No private data in code comments or string literals
3. `pnpm test:bundle` passes (checks for leaked paths, credentials, farm-specific terms)
4. The `.secret-patterns` file (gitignored) catches farm-specific terms in pre-commit hook

## If you make a mistake

If private content is accidentally committed:
1. `git reset --hard <commit-before-mistake>`
2. `git push --force origin main`
3. Alert the repo owner — exposed credentials must be rotated immediately

**Default stance: when in doubt, it goes in the private repo, not here.**
