# GuardDog

**Architecture review CLI for evolutionary architecture risks.**

---

## Where this came from

During a client engagement I worked on systems that did not seem designed for change or co-existence. They had been shaped for **greenfield** delivery — clean starts, happy paths — rather than **brownfield** reality: incremental migration, overlapping versions, and systems that must evolve while still running.

A colleague recommended [*Building Evolutionary Architectures*](https://evolutionaryarchitecture.com/) by Neal Ford, Rebecca Parsons, and Patrick Kua. After reading it, I kept thinking about how to apply that thinking in a world where AI coding assistants are writing and refactoring code at scale. Manual architecture review does not scale; lint rules catch syntax, not intent; and without an explicit record of what the architecture *should* be, drift is invisible until it hurts.

That is how GuardDog came about.

GuardDog is not a style checker or a generic code-smell detector. It asks a different question: **can this codebase evolve safely over time?** It looks for coupling, boundary drift, high blast-radius change areas, weak encapsulation, missing fitness functions, and the other risks the book emphasises — with a bias toward incremental remediation, not rewrites.

---

## How it works

GuardDog rests on three ideas:

### 1. Designers declare intent in `DESIGN.md`

System designers write a document — typically `DESIGN.md` — that explains how they want the system to be structured: layers, encapsulation, extension points, allowed dependencies, deployment boundaries, and so on. This is the **architectural contract**. GuardDog uses it to distinguish findings that drift from declared intent from general evolutionary-architecture observations.

### 2. An LLM acts as architecture reviewer

GuardDog prompts an LLM to review the codebase as an architect. The reviewer prompt is distilled from the key principles of *Building Evolutionary Architectures* (adaptability, coupling, optionality, fitness functions, operability, blast radius). It reads the design document, a factual map of the repository, and a bounded set of source and config files, then returns **structured findings** — severity, evidence, risk, blast radius, and incremental remediation suggestions.

Prompt text lives in `src/Prompts.json` and is loaded via [PromptRepository](https://github.com/jonverrier/PromptRepository). Changing review behaviour is a **prompt change** — validated by evals, not unit tests. Unit tests cover wiring (expansion, parsing, filtering); prompt quality is an eval concern.

### 3. A CLI that fits any workflow

Everything is packaged as a command-line tool so it is easy to run locally, in CI, on a schedule, or from another agent. Output is Markdown and JSON; optionally GuardDog opens a GitHub issue (dry-run by default, create with `--confirm`).

```bash
guarddog review . --design DESIGN.md --out review.md --json review.json
```

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
