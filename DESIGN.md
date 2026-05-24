# GuardDog — Architecture Intent

This document describes how GuardDog is structured and the invariants we preserve as the tool evolves. It is the architectural contract for **this repository** — not a template for target codebases under review (those have their own `DESIGN.md`).

GuardDog reviews other systems for evolutionary architecture risk. To stay credible, GuardDog itself must be **bounded, inspectable, and safe to change incrementally**.

---

## System purpose

GuardDog is a standalone Node.js CLI (`guarddog`) that:

1. Reads **declared architecture intent** from a design file (typically `DESIGN.md` in the target repo).
2. Builds a **factual repo map** (structure, languages, CI, packages, C4 docs) without sending full source upfront.
3. **Selects review context** via a two-stage pipeline: rank important files, then pack into token budgets.
4. Prompts an LLM to produce **structured findings** (severity, evidence, blast radius, incremental remediation).
5. Optionally renders Markdown/JSON output and opens GitHub issues.

GuardDog is **not** a linter, style checker, or C4 generator. It consumes C4-Auto output when present; it does not invoke C4-Auto.

Primary user workflow:

```text
c4-auto …          # optional: generate C4 docs in target repo
guarddog review …  # rank → pack → review → report
```

---

## Layer boundaries

GuardDog follows a thin CLI over a deterministic core pipeline. Dependencies flow inward; LLM calls sit at explicit boundaries.

```text
┌─────────────────────────────────────────────────────────────┐
│  cli/          argv parsing, exit codes, user-facing errors │
├─────────────────────────────────────────────────────────────┤
│  core/         review pipeline (orchestration, no I/O fmt) │
│    reviewer          single entry: runReview()              │
│    repoScanner       factual scan → IRepoMap                │
│    contextSelector   rank → pack → IContextSelectionResult  │
│    contextRanker     LLM ranker + heuristic fallback        │
│    tokenBudgetPacker greedy budget packing + manifest     │
│    c4ArchitectureDocs discovery, sort, cap                  │
│    findingParser     validate LLM JSON → IReviewResult      │
│    findingFilter     severity/impact/maxFindings            │
│    markdownRenderer  human-readable output                  │
│    llmProvider       ArchitectureReview via PromptRepository│
│    promptFactory     Prompts.json → IPromptRepository       │
├─────────────────────────────────────────────────────────────┤
│  schemas/      shared types, JSON schemas, defaults       │
│  utils/        filesystem, tokens, logging, errors          │
│  github/       optional issue creation (side effects)       │
├─────────────────────────────────────────────────────────────┤
│  Prompts.json  prompt templates (copied to dist/)           │
│  PromptIds.ts  stable UUID constants                        │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  @jonverrier/prompt-repository    tiktoken (token counting)
```

### Allowed dependencies

| Layer | May depend on | Must not depend on |
|-------|---------------|-------------------|
| `cli/` | `core/`, `schemas/`, `utils/`, `github/` | PromptRepository directly |
| `core/` | `schemas/`, `utils/`, PromptRepository, tiktoken | `cli/`, `github/` (except via reviewer wiring) |
| `schemas/` | nothing upstream | `core/`, `cli/` |
| `utils/` | Node built-ins, minimatch | `core/`, LLM drivers |
| `github/` | `schemas/`, `utils/` | LLM, context selection |

### External integration boundaries

- **PromptRepository** — all LLM access goes through `IChatDriver` + `IPromptRepository`. No raw OpenAI SDK calls in GuardDog.
- **C4-Auto** — integration is **file-based only**. GuardDog detects C4 markdown by basename/suffix; no subprocess or npm import of C4-Auto.
- **Target repositories** — read-only scan except for configured outputs (`.guarddog/`, review files, optional GitHub issues).

---

## Core pipeline (invariant sequence)

The review pipeline in `runReview()` must preserve this order:

```text
load config → load DESIGN.md → generateRepoMap()
  → selectContextFiles() [rank → pack DESIGN + C4 + sources]
  → attach contextSelection to repoMap
  → ArchitectureReview LLM → validate → filter → render → write
```

**Context selection** is layered and budgeted:

| Layer | Default budget | Selection rule |
|-------|----------------|----------------|
| Design file | 4,000 tokens (`designTokenBudget`) | packed first; subject to per-file cap |
| C4 docs (review) | 12,000 tokens (`c4TokenBudget`) | depth order (rollups first), max 24 files, greedy pack |
| C4 docs (ranker) | 12,000 tokens (`rankerC4TokenBudget`) | same depth order via `packC4DocsForPrompt` |
| Source files | 32,000 tokens (`contextTokenBudget`) | greedy pack by rank |
| Per file | 4,096 token cap (`maxFileTokens`) | skip with manifest reason |

Token counting uses **tiktoken** via `utils/tokenCounter.ts`. Files are read and counted **lazily**. `contextSelection.budgetUtilization` records `budget`, `used`, and `fillRatio` per layer.

**Ranker selection:**

- C4 docs present → `ContextRanker` LLM (file index + C4 bodies + design intent).
- No C4 docs, LLM failure, or empty rank → **heuristic fallback** (config, CI, manifests, sampled source dirs).
- Ranker mode is recorded in `contextSelection.ranker` (`c4-llm` | `heuristic`).

When files are skipped due to budget, the review is flagged `sampledReview: true`.

---

## Prompt and output contracts

### Prompts live in JSON

All LLM prompts are in `src/Prompts.json`, loaded through `PromptInMemoryRepository`. **Do not embed prompt prose in TypeScript.**

| Prompt | Role | Structured output schema |
|--------|------|--------------------------|
| `ContextRanker` | Rank source paths | `schemas/contextRank.ts` |
| `ArchitectureReview` | Produce findings | `schemas/finding.ts` |

Prompt UUIDs in `PromptIds.ts` must stay stable across releases unless intentionally versioning a new prompt.

**Prompt changes ≠ code changes.** Wording and reviewer constitution evolve in `Prompts.json`; quality is validated by evals (when added), not unit tests.

### Finding schema is a public contract

`IReviewResult` / `IFinding` and `REVIEW_RESULT_JSON_SCHEMA` are consumed by:

- Markdown renderer
- JSON output files
- GitHub issue renderer
- Downstream automation (CI, dashboards)

Breaking field renames or enum changes require a **schema version bump** and migration notes. Prefer additive fields.

**Evidence items (LLM vs parsed):** OpenAI strict JSON requires `file`, `directory`, and `observation` on every evidence object. The LLM must use an **empty string** for `file` or `directory` when not applicable. After parsing, GuardDog stores `IEvidenceItem` with optional `file`/`directory` (omitted when empty). Helpers in `schemas/finding.ts` (`evidenceItemToLlmShape`, `isLlmEvidenceItem`) and `test/unit/findingContract.test.ts` keep the contract aligned.

### Context selection metadata

`contextSelection` on the repo map includes:

- `summary` — `totalCandidates`, `rankedByRanker`, `unrankedByRanker`, and packer skip counts
- `truncation` — `rankerCapped` (ranker returned fewer paths than candidates) vs `budgetExhausted` (packer skipped files)
- `manifest` — per-file rank, tokens, included/skipped, and reason for ranked and packed paths

**`sampledReview`** on the review result is `true` only when `budgetExhausted` is true (token budget or per-file cap prevented inclusion). Ranker focus alone does not set `sampledReview`; the prompt may still note ranker focus via `rankerCapped`.

---

## Deployment model

- **Package:** `@jonverrier/guard-dog` on GitHub Packages.
- **Binary:** `guarddog` → `dist/cli/index.js`.
- **Runtime:** Node 20+, CommonJS, TypeScript compiled to `dist/`.
- **Config:** `.guarddog/guarddog.config.json` in the **target** repo (created by `guarddog init`).
- **Secrets:** `OPENAI_API_KEY` required at review time; GitHub token only when creating issues.
- **Publish artefact:** `dist/**/*` + `README.md` only (`package.json` `files` field).

GuardDog runs locally or in CI against a checkout. It is stateless between runs except for files it writes.

---

## Key invariants

These rules must not break during evolution:

1. **Deterministic pre-LLM stages.** Repo scan, C4 detection, heuristic ranking, and token packing must be reproducible given the same filesystem and config. No hidden randomness before the LLM call.

2. **Bounded context.** Every review run has explicit token budgets, a `contextSelection.summary` with candidate/ranked/unranked counts, and a manifest explaining what was included, skipped, and why. Never silently drop the manifest.

3. **Fail safe on ranker failure.** If the C4 LLM ranker errors or returns invalid paths, fall back to heuristics — do not abort the review solely because ranking failed.

4. **Fail loud on review failure.** If the ArchitectureReview LLM returns empty/unparseable JSON, save debug output and throw — do not emit a fake “all clear” report.

5. **Sampled reviews are visible.** Set `sampledReview: true` only when the **source** layer skips ranked files (`truncation.source`). C4 or design discards are reported in `contextCoverage` and `layerPack` without marking a sampled review. Always log and render whether ranking was **C4-guided** vs **heuristic** separately from discards.

6. **Read-only target scan.** Do not modify source files in the repository under review. Side effects are limited to configured outputs and optional GitHub issues.

7. **Gitignore respected.** Repository walks honour `.gitignore` patterns via `utils/fileSystem.ts`.

8. **No monorepo coupling.** GuardDog must remain installable and runnable without the StrongAI workspace. Peer relationship to C4-Auto is documented, not wired.

---

## Extension points (safe evolution)

When adding capability, prefer these seams rather than new cross-cutting imports:

| Need | Extend here | Avoid |
|------|-------------|-------|
| New prompt | `Prompts.json` + `PromptIds.ts` | String literals in `core/` |
| New config flag | `schemas/config.ts`, CLI in `cli/commands/review.ts`, `configLoader.ts` | Ad hoc `process.env` reads scattered in core |
| New file type in context | `isContextCandidate()` in `contextRanker.ts` | Hard-coded extension lists in multiple files |
| New C4 filename convention | `c4ArchitectureDocs.ts` | Path checks duplicated in ranker/packer |
| New output format | New renderer module; keep `IReviewResult` stable | Forking finding shape per format |
| New LLM provider behaviour | `llmProvider.ts`, inject via tests | Direct `ChatDriverFactory` calls outside ranker/reviewer |
| GitHub behaviour | `github/` only | Issue logic in `reviewer.ts` beyond a single call |

---

## Fitness functions (how we keep GuardDog safe)

Use these checks before merging substantive changes:

### Automated (CI)

- `npm run build` — compiles and copies `Prompts.json` to `dist/`.
- `npm run test:ci` — unit tests with mocked LLM/filesystem; no `OPENAI_API_KEY` required.
- Tests must cover: token packing math, manifest reasons, C4 detection/sort/cap, heuristic fallback, finding filter thresholds, config merge, finding evidence LLM contract (`findingContract.test.ts`), context selection summary/truncation.

### Manual / eval (prompt quality)

- Prompt wording changes → run targeted reviews on fixture repos; add eval suite when ready.
- After ContextRanker changes → verify ranker mode and manifest on repos with and without C4 docs.

### Release discipline

- Work on `develop`; merge to `main` for release.
- Publish only from `main` after build + test:ci.
- Bump `@jonverrier/guard-dog` semver when output schema or CLI contract changes.

### Code review checklist

- [ ] Does a new feature respect token budgets?
- [ ] Is there a manifest entry for every skipped/included file?
- [ ] Does ranker failure still produce a review (heuristic path)?
- [ ] Are prompts still in `Prompts.json`?
- [ ] Are magic numbers named constants at file top?
- [ ] Are errors from `utils/errors.ts`, not raw `Error`?
- [ ] Is `IReviewResult` backward compatible or versioned?

---

## Keeping design and code in sync

This `DESIGN.md` is the **architectural contract for the GuardDog repository itself**. When you change behaviour that affects invariants, context selection, or output contracts:

1. Update the implementation and unit tests first.
2. Update this `DESIGN.md` section that documents the invariant or contract.
3. Update `README.md` user-facing sections (context manifest example, sampled-review semantics).
4. Regenerate C4 docs when module boundaries or public seams change: `npm run generate-docs`.
5. Optionally re-run `guarddog review . --design DESIGN.md` to catch drift between declared intent and code.

Target repos under review have their own `DESIGN.md`; do not confuse this file with those.

---

## Known gaps and intentional debt

Document these when changing related code:

- **Eval suite not yet present.** Prompt quality relies on manual review until evals land.
- **Single LLM provider path.** Model selection is via PromptRepository defaults; `--model` config exists but provider abstraction is minimal.

---

## Related documentation

- `README.md` — user-facing origin story, workflow, and prompt reference.
- `AGENTS.md` — instructions for AI assistants working in this repo.
- [C4-Auto](https://github.com/jonverrier/C4-Auto) — generates architecture docs GuardDog consumes.
- [PromptRepository](https://github.com/jonverrier/PromptRepository) — LLM drivers and prompt expansion.
