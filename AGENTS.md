# AI Agent Instructions — FarmscapeOS

## CRITICAL: This is a PUBLIC repository

**This repository is open-source and publicly visible to the entire internet.**

You MUST NOT commit, push, or add any of the following to this repository:

### Absolutely forbidden content

1. **Business plans, financial data, or economic analyses** — revenue projections, profit margins, pricing strategies, investor documents, market analyses, cost breakdowns
2. **Personal information** — real names (other than the repo owner for attribution), addresses, phone numbers, email addresses, visa/immigration details
3. **Farm-specific operational data** — crop yields, harvest schedules, supplier names, customer lists, employee compensation, partnership details
4. **Credentials and secrets** — API keys, tokens, passwords, database IDs, account identifiers
5. **Private business documents** — contracts, legal correspondence, consultant reports, internal memos
6. **Sensitive markdown documents** — anything with financial numbers, business strategy, or personal details

### Where private content belongs

All private, farm-specific, or sensitive content belongs in the **private deployment wrapper repository** (e.g., `kahiliholo-farm`), which:
- Is a private GitHub repo
- Uses this repo as a git submodule
- Contains farm-specific configs, business docs, and deployment secrets
- Has its own `wrangler.toml` pointing to this repo's worker and dist

### What IS appropriate for this repo

- Generic, reusable application code (React components, worker endpoints, utilities)
- Generic features that any farm could use (e.g., an admin docs viewer that fetches content from an API — but NOT the actual document content)
- Configuration types and example configs (with placeholder/example data only)
- Documentation about how to use or deploy the software
- Test fixtures with synthetic/fake data

### Architecture for private features

If a feature requires private content (e.g., serving sensitive documents to admins):

1. **This repo** provides the generic infrastructure (API route handler, page component, markdown renderer)
2. **The private repo** provides the actual content (markdown files, data, configs)
3. The private repo's `wrangler.toml` or worker wrapper injects the content at deploy time
4. The content NEVER appears in this repo's git history

### Before every commit, verify

- [ ] No real names, addresses, or personal details
- [ ] No financial figures, revenue numbers, or business projections
- [ ] No API keys, tokens, or credentials
- [ ] No farm-specific operational data
- [ ] No documents that would be harmful if publicly exposed
- [ ] The `pnpm test:bundle` security checks pass

### If you accidentally commit private content

1. **Do NOT just delete it in a new commit** — git history preserves everything
2. You MUST use `git reset --hard` and `git push --force` to erase it from history
3. Notify the repository owner immediately
4. Consider any exposed credentials compromised and rotate them

---

**When in doubt, keep it out.** If you're unsure whether something is too sensitive for a public repo, it almost certainly is. Put it in the private deployment repo instead.
