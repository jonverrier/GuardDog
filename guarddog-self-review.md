# GuardDog Architecture Review

Repository: `D:\Code\StrongAI\GuardDog`
Design file: `DESIGN.md`
Generated: `2026-05-24T00:00:00.000Z`

## Context coverage

- **Ranking:** C4-guided (ContextRanker used C4 architecture docs to prioritise source files).
  - C4 docs discovered: 16; included in review context: 16.
- **Source context:** 29 of 34 ranked source file(s) inlined for review.
- **Discarded:** 5 file(s) omitted (design: 0, C4: 0, source: 5) due to token budgets or per-file caps.
  - Layers that hit limits: source.
- **Review caveat:** Some ranked source files were not read — findings may under-represent code outside the included set.

## Summary

Overall risk: Medium

Main themes:
- Declared intent vs implementation drift (model + coverage accounting)
- Context selection transparency and determinism
- Boundary/contract fitness functions (schemas, prompts, layers)
- Operational safety for filesystem scanning (.gitignore semantics)
- Optional integration resilience (GitHub + LLM error handling)

Findings: 3 (high: 0, critical: 0)

## Findings

### GD-001 — Config `--model` is not propagated to LLM drivers (only token encoding), drifting from “model selection via config” expectations

Severity: Medium  
Impact: Medium  
Confidence: High  
Principle: Encode configuration consistently across integration boundaries to preserve operability and predictable behavior.

#### Evidence

- `src/core/llmProvider.ts`: Creates chat driver with `new ChatDriverFactory().create(EModel.kLarge, EModelProvider.kOpenAI)` and does not reference `params` or config-provided model selection when calling the LLM.
- `src/core/contextRanker.ts`: LLM ranker path uses `new ChatDriverFactory().create(EModel.kLarge, EModelProvider.kOpenAI)` in `rankWithLlm`, ignoring `config.model`.
- `src/utils/tokenCounter.ts`: `createTokenEncoder(model?: string)` uses `resolveEncodingModel(model)` which prefers `process.env.OPENAI_MODEL` or config model, meaning the model affects token counting but not the LLM call behavior.

#### Facts

- `config.model` (CLI `--model`) is used to choose a tiktoken encoding model in `createTokenEncoder` via `selectContextFiles`.
- Both `PromptRepositoryLlmProvider` and `rankWithLlm` instantiate a chat driver with hardcoded `EModel.kLarge` and `EModelProvider.kOpenAI`.
- No code in the provided context maps `IGuardDogConfig.model` to `ChatDriverFactory().create(...)` or equivalent driver configuration.

#### Inferences

- Users may believe they are changing the model used for ranking/review via `--model`, but will only affect token estimation, not which model is called.
- Token budgets and truncation decisions may be miscalibrated if token encoding assumptions differ from the actual model used by the driver, leading to more frequent `budget_exhausted` behavior or under-filled budgets.

#### Risk

Operational predictability risk: users can’t reliably tune cost/quality/latency characteristics via config, and token budgeting may become less trustworthy if the encoding model and LLM model diverge.

#### Blast Radius

Medium — Affects the core `review` workflow (ranking + review) for any user who tries to control model selection; does not inherently break default runs but undermines configurability and trust in budgeting.

#### Recommendation

Incrementally thread the resolved model/provider into LLM driver creation without changing prompt contracts:
1) Extend `IGuardDogConfig` with explicit `llmProvider`/`llmModel` fields (additive), defaulting to current behavior.
2) Update `createDefaultLlmProvider()` and `rankWithLlm()` to accept resolved model/provider (or a prebuilt `IChatDriver`) from `reviewer.ts` wiring.
3) Add a log line in `runReview()` summarizing the effective model/provider used for ranker and review (operability).

#### Possible Fitness Function

Unit test: when `--model` is provided, `createDefaultLlmProvider` and `rankWithLlm` are called with the resolved model value (via injected factory), and tokenCounter encoding model matches the same resolved model family.

### GD-002 — `.gitignore` handling is a partial glob match, not full gitignore semantics (negations and directory rules), risking unexpected scanning

Severity: Medium  
Impact: High  
Confidence: Medium  
Principle: Read-only scanning must be predictable and align with user expectations for ignored content to minimize blast radius and data exposure risk.

#### Evidence

- `src/utils/fileSystem.ts`: `loadGitignorePatterns` returns trimmed lines excluding comments, but does not implement gitignore negation (`!`) or anchored path semantics.
- `src/utils/fileSystem.ts`: `isIgnoredPath` applies `minimatch(normalized, pattern, ...)` and separately matches `path.basename(normalized)`; this approximates ignore behavior but is not equivalent to gitignore processing.
- `DESIGN.md`: Invariant states: "Gitignore respected. Repository walks honour `.gitignore` patterns via `utils/fileSystem.ts`."

#### Facts

- The scanner uses `loadGitignorePatterns` + `walkFiles` which in turn uses `isIgnoredPath`.
- `isIgnoredPath` uses minimatch against the raw pattern and against the basename; it does not interpret `!` negation patterns specially.
- Gitignore semantics (e.g., negations, directory-only patterns like `foo/`, and rooted patterns) are not explicitly implemented.

#### Inferences

- Repos with non-trivial `.gitignore` may have files included/excluded differently than `git` would, which can unexpectedly pull in generated artifacts or omit relevant sources.
- This can change review results between environments and may increase the chance of scanning sensitive or irrelevant files (even though `readContextFile` redacts some secrets and caps size).

#### Risk

Loss of trust in “what was scanned” and potential inclusion of unexpected files in the candidate set, which can affect determinism and (in some repos) increase the likelihood of sensitive content being read/redacted and sent as context.

#### Blast Radius

High — Affects all users on the default `guarddog review` workflow because repo walking is foundational; impact depends on how complex the target repo’s `.gitignore` is.

#### Recommendation

Improve correctness incrementally without rewriting scanning:
1) Add explicit support for negation patterns: track patterns in order and apply last-match-wins with `!` meaning unignore.
2) Add a small set of gitignore semantic tests using fixture repos (e.g., ignore `dist/` but unignore `dist/keep.txt`).
3) Document the supported subset until full compatibility is achieved.
4) Consider using a well-tested gitignore parser library (small dependency) behind `utils/fileSystem.ts` to preserve the boundary and keep behavior deterministic.

#### Possible Fitness Function

Contract test suite for `walkFiles` vs expected file lists on fixtures that cover: negation (`!`), directory patterns (`foo/`), and rooted patterns (`/foo`). CI fails if results drift.

### GD-003 — Context selection summary `totalCandidates` includes design/C4 docs while ranker output excludes them, inflating `unrankedByRanker` and `rankerCapped`

Severity: Medium  
Impact: Medium  
Confidence: High  
Principle: Metrics and manifests should measure what they claim, or they become governance noise that reduces credibility.

#### Evidence

- `src/core/contextSelector.ts`: Computes `totalCandidates = allFiles.filter(isContextCandidate).length` and `rankedByRanker = rankOutcome.rankedPaths.length`, then derives `unrankedByRanker` and `rankerCapped`.
- `src/core/contextRanker.ts`: Explicitly excludes design file and C4 docs from ranked source paths via `shouldExcludeFromSourceRank`.
- `DESIGN.md`: Intent describes ranker as selecting “source paths” and `rankerCapped` as “ranker returned fewer paths than candidates” (implying comparable sets).

#### Facts

- `isContextCandidate` includes `.md` files, so `DESIGN.md` and C4 markdown files are counted as candidates.
- The ranker’s `rankedPaths` are filtered to exclude `designFile` and C4 docs (`isC4ArchitectureDoc`).
- `rankerCapped` is computed as `summary.unrankedByRanker > 0`, which depends on the mismatch between candidate set and rankable set.

#### Inferences

- Even when the ranker returns the maximum intended number of source paths, `rankerCapped` can be true simply because non-source docs were counted as candidates.
- This can cause misleading “ranker focus” messaging in prompts/reports, which could bias LLM behavior and user interpretation of coverage.

#### Risk

Governance/observability drift: coverage metrics become less meaningful, reducing trust in the manifest and truncation signals that are core to GuardDog’s credibility.

#### Blast Radius

Medium — Affects all reviews’ context metadata and prompt notes; does not break the pipeline but can mislead users and the review LLM about coverage.

#### Recommendation

Align counts to comparable populations:
1) Define `rankableSourceCandidates` in `contextSelector.ts` using the same exclusion predicate as the ranker (exclude design + C4 + obvious noise like lockfiles/README).
2) Compute `totalCandidates` and `unrankedByRanker` from that set, while keeping a separate `totalContextCandidates` if you still want to report it.
3) Add a unit test that ensures `rankerCapped` only flips when ranker returns fewer than `MAX_RANKED_FILES_FOR_LLM` *and* fewer than the rankable candidate count.

#### Possible Fitness Function

Unit test: given a file list containing design + C4 + 10 sources, `totalCandidates` for ranker accounting equals 10 (not 12+), and `rankerCapped` is false when the ranker returns all 10.
