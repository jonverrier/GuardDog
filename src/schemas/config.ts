/**
 * @module schemas/config
 * Configuration types and defaults for GuardDog reviews.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Defines the configuration schema and default values used by GuardDog architecture reviews and the review CLI. It centralizes type definitions for review settings, GitHub issue integration, and token budgets so other modules can validate inputs and apply consistent defaults.
// 
// Exports IssueMode, which controls whether GitHub issues are created as a single issue or one per finding. Exports IGuardDogGithubConfig for GitHub-specific settings (enabled flag, issueMode, and optional repo override). Exports IGuardDogConfig for the full resolved configuration, including design and output file paths, severity/impact thresholds, maximum findings, model selection, context/C4 token budgets, max per-file token limit, C4 component/context file names, and nested GitHub settings. Exports IReviewCliOptions for raw CLI inputs, with many optional overrides and flags such as dryRun, noGithub, and confirm.
// 
// Also exports constants for default file names, candidate design document paths, token budget defaults, DEFAULT_CONFIG_FILE, DEFAULT_CONFIG, and default GitHub issue labels and title. Depends on FindingSeverity and FindingImpact types from ./finding to type threshold fields.
// ===End StrongAI Generated Comment===


import { FindingImpact, FindingSeverity } from './finding';

export type IssueMode = 'single' | 'per-finding';

export interface IGuardDogGithubConfig {
   enabled: boolean;
   issueMode: IssueMode;
   repo?: string;
}

export interface IGuardDogConfig {
   designFile?: string;
   outputMarkdown: string;
   outputJson?: string;
   minSeverity: FindingSeverity;
   minImpact: FindingImpact;
   maxFindings: number;
   model?: string;
   contextTokenBudget: number;
   c4TokenBudget: number;
   designTokenBudget: number;
   rankerC4TokenBudget: number;
   maxFileTokens: number;
   componentFile: string;
   contextFile: string;
   github: IGuardDogGithubConfig;
}

export interface IReviewCliOptions {
   repoPath: string;
   design?: string;
   out?: string;
   json?: string;
   minSeverity?: FindingSeverity;
   minImpact?: FindingImpact;
   maxFindings?: number;
   dryRun?: boolean;
   githubIssue?: boolean;
   repo?: string;
   issueMode?: IssueMode;
   model?: string;
   noGithub?: boolean;
   confirm?: boolean;
   contextTokenBudget?: number;
   c4TokenBudget?: number;
   designTokenBudget?: number;
   rankerC4TokenBudget?: number;
   maxFileTokens?: number;
   componentFile?: string;
   contextFile?: string;
}

export const DEFAULT_C4_COMPONENT_FILE = 'README.StrongAI.Component.md';
export const DEFAULT_C4_CONTEXT_FILE = 'README.StrongAI.Context.md';

export const DEFAULT_CONFIG_FILE = '.guarddog/guarddog.config.json';

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 32000;
export const DEFAULT_C4_TOKEN_BUDGET = 12000;
export const DEFAULT_DESIGN_TOKEN_BUDGET = 4000;
export const DEFAULT_MAX_FILE_TOKENS = 4096;

export const DEFAULT_DESIGN_CANDIDATES: readonly string[] = [
   'DESIGN.md',
   'ARCHITECTURE.md',
   'architecture/DESIGN.md',
   'architecture/architecture-context.md'
];

export const DEFAULT_CONFIG: IGuardDogConfig = {
   designFile: 'DESIGN.md',
   outputMarkdown: 'guarddog-review.md',
   outputJson: 'guarddog-review.json',
   minSeverity: 'medium',
   minImpact: 'medium',
   maxFindings: 20,
   contextTokenBudget: DEFAULT_CONTEXT_TOKEN_BUDGET,
   c4TokenBudget: DEFAULT_C4_TOKEN_BUDGET,
   designTokenBudget: DEFAULT_DESIGN_TOKEN_BUDGET,
   rankerC4TokenBudget: DEFAULT_C4_TOKEN_BUDGET,
   maxFileTokens: DEFAULT_MAX_FILE_TOKENS,
   componentFile: DEFAULT_C4_COMPONENT_FILE,
   contextFile: DEFAULT_C4_CONTEXT_FILE,
   github: {
      enabled: false,
      issueMode: 'single'
   }
};

export const DEFAULT_ISSUE_LABELS: readonly string[] = [
   'architecture',
   'guarddog',
   'technical-debt'
];

export const DEFAULT_ISSUE_TITLE = 'GuardDog architecture review findings';
