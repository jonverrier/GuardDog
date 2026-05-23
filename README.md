# GuardDog

**Architecture review CLI for evolutionary architecture risks.**

GuardDog (SeamGuard) is a standalone CLI package (`@jonverrier/guard-dog`) that reviews a codebase for its ability to evolve safely over time. It reads architecture intent from a design file, scans the repository, runs an LLM-based architecture review via [PromptRepository](https://github.com/jonverrier/PromptRepository), and emits structured findings as Markdown and JSON.

This is not a style checker or generic code smell detector. It protects architectural seams — coupling, drift, weak boundaries, deployability risks, observability gaps, and migration blockers.

---

## Install

**Prerequisites:** Node.js 20+, `OPENAI_API_KEY` for LLM reviews.

```bash
npm install -g @jonverrier/guard-dog
```

For GitHub Packages, configure `.npmrc`:

```ini
@jonverrier:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

---

## Quick start

Initialize configuration in a repository:

```bash
seamguard init
```

Run an architecture review:

```bash
guarddog review . \
  --design ./DESIGN.md \
  --out ./seamguard-review.md \
  --json ./seamguard-review.json
```

---

## CLI

### Primary command

```bash
guarddog review <repoPath> \
  --design ./DESIGN.md \
  --out ./seamguard-review.md \
  --json ./seamguard-review.json
```

### Options

| Option | Description |
|--------|-------------|
| `--design <path>` | Architecture intent / design file |
| `--out <path>` | Markdown output path |
| `--json <path>` | JSON output path |
| `--min-severity <level>` | `low` \| `medium` \| `high` \| `critical` (default: `medium`) |
| `--min-impact <level>` | `low` \| `medium` \| `high` \| `critical` (default: `medium`) |
| `--max-findings <number>` | Limit number of findings (default: 20) |
| `--dry-run` | Do not write files or create issues |
| `--github-issue` | Enable GitHub issue creation |
| `--repo <owner/name>` | GitHub repo target |
| `--issue-mode single\|per-finding` | Issue creation mode (default: `single`) |
| `--model <model-name>` | LLM model name |
| `--no-github` | Disable GitHub integration |
| `--confirm` | Confirm GitHub issue creation (default is dry-run for GitHub) |

### Init command

```bash
seamguard init [repoPath]
```

Creates:

```text
.seamguard/
  seamguard.config.json
  reviewer.md
  finding.schema.json
```

---

## GitHub integration

```bash
guarddog review . \
  --design DESIGN.md \
  --github-issue \
  --repo jonverrier/my-repo \
  --confirm
```

Requires `GITHUB_TOKEN`. Without `--confirm`, issue title and body are printed only (dry-run).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required for LLM review |
| `OPENAI_MODEL` | Optional model override |
| `GITHUB_TOKEN` | Required for confirmed GitHub issue creation |
| `GUARDDOG_DEBUG` | Set to `1` for debug logging |

---

## Development

```bash
npm install
npm run build
npm run test:ci
```

Run locally:

```bash
node dist/cli/index.js review . --design DESIGN.md --out review.md
```

---

## License

Copyright (c) 2025 Jon Verrier
