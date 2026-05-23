/**
 * @module schemas/config
 * Configuration types and defaults for GuardDog reviews.
 */
// Copyright (c) 2025 Jon Verrier

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
}

export const DEFAULT_CONFIG_FILE = '.guarddog/guarddog.config.json';

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
