# GuardDog Agent Instructions

Instructions for AI assistants working on the `@jonverrier/guard-dog` package. This is a **standalone** repository — not part of the StrongAI monorepo.

## Project Overview

GuardDog is a publishable Node.js CLI that reviews a codebase for **evolutionary architecture** risks. It reads designer intent from `DESIGN.md`, selects context via C4-guided ranking and token budgets, prompts an LLM for structured findings, and optionally opens GitHub issues.

**Peer to AutoDoc** — GuardDog consumes C4 architecture docs when present; it does not invoke AutoDoc.

**Product name:** GuardDog. **CLI binary:** `guarddog`. **Config dir:** `.guarddog/`.

## Review Pipeline

1. Load config and `DESIGN.md`
2. Scan repo → repo map (file index + discovered C4 docs)
3. **Rank** source files — `ContextRanker` LLM when C4 docs exist, else heuristics
4. **Pack** C4 docs and ranked sources into layered token budgets (tiktoken)
5. **ArchitectureReview** LLM → parse/filter findings → Markdown/JSON output

Prompts live in `src/Prompts.json` (copied to `dist/` on build). Prompt wording changes are prompt changes — unit tests cover wiring; prompt quality is an eval concern.

## Package Structure

```text
src/
  cli/                      Entry (bin: guarddog) — review, review-strongai-platforms, init
  strongai/                 StrongAI cloud review orchestration + issue drafting/sync
  core/
    reviewer.ts             Orchestrates the review pipeline
    contextSelector.ts      Rank → pack orchestration
    contextRanker.ts        LLM + heuristic file ranking
    tokenBudgetPacker.ts      Greedy pack by rank with manifest
    c4ArchitectureDocs.ts   C4 file discovery
    repoScanner.ts          Repo walk and file index
    findingParser.ts        Structured finding extraction
  schemas/                  Config, repo map, context manifest, findings, StrongAI targets
  github/                   Optional issue creation
  PromptIds.ts              Prompt UUID constants
  Prompts.json              In-memory prompt templates
test/                       Jest unit tests + fixtures
dist/                       Published compiled output only
```

## Defaults And Conventions

| Setting | Default |
|---------|---------|
| C4 component file | `README.StrongAI.Component.md` |
| C4 context file | `README.StrongAI.Context.md` |
| Design token budget | 4,000 |
| C4 token budget (review) | 12,000 |
| C4 token budget (ranker) | 12,000 (defaults to C4 budget) |
| Source token budget | 32,000 |
| Max tokens per file | 4,096 |
| Max C4 files in review context | 24 |

Layers pack in order: design → C4 (depth order) → sources. `budgetUtilization` records fill ratio per layer. ContextRanker uses `packC4DocsForPrompt` (same depth order as review).

**Contracts:** Evidence in LLM JSON uses `file`/`directory`/`observation` (empty string when N/A); parsed `IEvidenceItem` omits empty locations. `sampledReview` means budget truncation only; `contextSelection.summary` and `truncation` record ranker focus vs budget skips. Keep `DESIGN.md`, `README.md`, and code in sync when changing these behaviours.

## Build, Test, And Publish

```bash
npm install              # needs NODE_AUTH_TOKEN for @jonverrier/prompt-repository
npm run build            # rimraf dist && tsc && copy Prompts.json
npm run test:ci          # unit tests; no OPENAI_API_KEY
npm pack --dry-run       # verify dist-only tarball
npm run review:strongai-platforms -- --dry-run   # needs CURSOR_API_KEY + OPENAI_API_KEY
```

**StrongAI cloud reviews:** `guarddog review-strongai-platforms` launches one Cursor cloud agent per platform package, writes StrongAI `issues/*.md` drafts, and can invoke `tools/build/scripts/sync-issues-to-github.sh` with `--sync --confirm`. See README § StrongAI platform cloud reviews.

**Branch policy:** work on `develop`; merge to `main` for release.

**Publish** (GitHub Packages): on `main`, build, then `npm publish` with `NODE_AUTH_TOKEN`.

## Coding Standards

- TypeScript strict mode, ES2022, Node 20+, CommonJS.
- Use GuardDog error classes from `src/utils/errors.ts` — never raw `Error`.
- Interface prefix `I`, enum prefix `E`, enum members prefix `k`.
- JSDoc on public modules/functions; copyright header on source files.
- Constants for magic numbers at file top (budgets, caps, limits).
- Tests: Jest + `expect` + Sinon; `describe`/`it` are globals.
- Do not pipe live Jest output through `tail`/`grep` — run `npm run test:ci` directly.

## Git Safety

- Never run destructive git commands unless explicitly requested.
- Do not delete untracked files without approval.
- Inspect `git status --short --branch` before committing.
- No AI attribution in commit messages.

## Related Packages

- **PromptRepository** (`@jonverrier/prompt-repository`) — LLM drivers and prompt expansion.
- **AutoDoc** (`@jonverrier/auto-doc`) — generates C4 docs that GuardDog consumes for context ranking.
