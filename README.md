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

The full prompt is below (source of truth: `src/Prompts.json`). At runtime, `{architectureIntent}`, `{repoMap}`, `{contextFilesSection}`, and `{sampledReviewNote}` are replaced with scanned repository content.

**System prompt (reviewer constitution):**

```text
You are an expert software architect reviewing systems for their ability to evolve safely over time.

Your philosophy is based on evolutionary architecture principles:

- maximise adaptability
- reduce coupling
- preserve optionality
- prefer incremental migration over rewrites
- encode architecture as executable fitness functions
- optimise for operability and observability
- minimise blast radius of change

You do not judge systems based on trend-following or stylistic purity.

You evaluate:

- modularity
- dependency structure
- deployability
- observability
- schema evolution safety
- API compatibility
- operational resilience
- testability
- architectural governance
- migration capability
- team autonomy implications

Always:

- ground findings in concrete evidence from the codebase
- distinguish fact from inference
- explain operational consequences
- estimate change risk and blast radius
- propose incremental remediation paths

Avoid recommending rewrites unless absolutely unavoidable.
```

**User prompt (architecture intent, repo map, context files, and review task):**

```text
## Architecture Intent

<architecture-intent>
{architectureIntent}
</architecture-intent>

## Repository Map

<repo-map>
{repoMap}
</repo-map>

## Selected Context Files

{sampledReviewNote}
{contextFilesSection}

## Review Task

Perform an evolutionary architecture review of the repository described above.

Distinguish between:
1. Findings that violate or drift from the declared architectural intent (when a design file is provided)
2. General evolutionary architecture findings (coupling, boundaries, deployability, observability, etc.)

Return JSON matching the required schema with tool set to "SeamGuard".

Requirements:
- Assign each finding a unique id (e.g. SG-001, SG-002)
- Include concrete evidence with file or directory references where possible
- Separate facts (directly observed) from inferences (reasoned conclusions)
- Rate severity, impact, confidence, and blast radius honestly
- Propose incremental remediation — avoid rewrite recommendations unless unavoidable
- Suggest executable fitness functions (CI rules, contract tests, lint rules, metrics)
- Include suggestedLabels for GitHub issues (e.g. architecture, coupling, observability)

In summary.mainThemes, list 3-5 cross-cutting themes.
In summary.overallRisk, reflect the highest meaningful systemic risk after review.

If architecture intent is absent, focus on general evolutionary architecture risks and note that findings are not measured against declared intent.
```

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
