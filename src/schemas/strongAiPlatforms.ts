/**
 * @module schemas/strongAiPlatforms
 * Package targets and payload types for StrongAI platform cloud reviews.
 */
// Copyright (c) 2025 Jon Verrier

/**
 * One StrongAI platform package reviewed by a dedicated cloud agent.
 */
export interface IStrongAiPlatformTarget {
   /** Stable id used in CLI filters and logs. */
   id: 'platform' | 'platform-client' | 'platform-server';
   /** Path relative to the StrongAI monorepo root. */
   packagePath: string;
   /** Design file relative to packagePath. */
   designFile: string;
   /** Filename slug under StrongAI/issues/ (without .md). */
   issueSlug: string;
   /** Human-readable package label for issue titles. */
   displayName: string;
}

/**
 * Structured payload each cloud agent must return after a GuardDog review.
 */
export interface IStrongAiCloudReviewPayload {
   packageId: IStrongAiPlatformTarget['id'];
   issueSlug: string;
   issueTitle: string;
   issueMarkdown: string;
   reviewSummary: {
      overallRisk: string;
      findingCount: number;
      highSeverityCount: number;
      criticalSeverityCount: number;
      mainThemes: string[];
   };
   /** Optional full GuardDog JSON result for local re-rendering. */
   reviewJson?: unknown;
   agentNotes?: string;
}

/**
 * Local draft ready to write under StrongAI/issues or a dry-run folder.
 */
export interface IStrongAiIssueDraft {
   target: IStrongAiPlatformTarget;
   fileName: string;
   markdown: string;
   title: string;
   agentId?: string;
   runId?: string;
}

export const DEFAULT_STRONGAI_REPO_URL = 'https://github.com/jonverrier/StrongAI';
export const DEFAULT_GUARDDOG_REPO_URL = 'https://github.com/jonverrier/GuardDog';
export const DEFAULT_STRONGAI_STARTING_REF = 'develop';
export const DEFAULT_GUARDDOG_STARTING_REF = 'main';
export const DEFAULT_CURSOR_MODEL = 'composer-2.5';

/**
 * First-wave StrongAI packages reviewed by cloud agents (one issue each).
 */
export const STRONGAI_PLATFORM_TARGETS: readonly IStrongAiPlatformTarget[] = [
   {
      id: 'platform',
      packagePath: 'packages/platform',
      designFile: 'DESIGN.md',
      issueSlug: 'guarddog-platform-architecture-review',
      displayName: 'platform (@jonverrier/assistant-platform)'
   },
   {
      id: 'platform-client',
      packagePath: 'packages/platform-client',
      designFile: 'DESIGN.md',
      issueSlug: 'guarddog-platform-client-architecture-review',
      displayName: 'platform-client (@jonverrier/assistant-platform-client)'
   },
   {
      id: 'platform-server',
      packagePath: 'packages/platform-server',
      designFile: 'DESIGN.md',
      issueSlug: 'guarddog-platform-server-architecture-review',
      displayName: 'platform-server (@jonverrier/assistant-platform-server)'
   }
];

/**
 * Looks up a platform target by id.
 * @param id - Target id
 */
export function findStrongAiPlatformTarget(
   id: string
): IStrongAiPlatformTarget | undefined {
   return STRONGAI_PLATFORM_TARGETS.find((target) => target.id === id);
}
