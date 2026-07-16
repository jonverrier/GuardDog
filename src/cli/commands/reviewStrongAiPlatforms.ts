/**
 * @module cli/commands/reviewStrongAiPlatforms
 * `guarddog review-strongai-platforms` — cloud GuardDog reviews for StrongAI platform packages.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import {
   DEFAULT_CURSOR_MODEL,
   DEFAULT_GUARDDOG_REPO_URL,
   DEFAULT_GUARDDOG_STARTING_REF,
   DEFAULT_STRONGAI_REPO_URL,
   DEFAULT_STRONGAI_STARTING_REF,
   findStrongAiPlatformTarget,
   IStrongAiPlatformTarget,
   STRONGAI_PLATFORM_TARGETS
} from '../../schemas/strongAiPlatforms';
import { reviewStrongAiPackagesWithCloudAgents } from '../../strongai/cloudPackageReviewer';
import { resolveStrongAiRoot, syncStrongAiIssuesToGitHub } from '../../strongai/syncStrongAiIssues';
import {
   resolveStrongAiIssuesDir,
   writeStrongAiIssueDrafts
} from '../../strongai/writeStrongAiIssues';
import { InvalidParameterError, InvalidStateError } from '../../utils/errors';
import { defaultLogger } from '../../utils/logger';

export interface IReviewStrongAiPlatformsCliOptions {
   dryRun: boolean;
   sync: boolean;
   confirm: boolean;
   preferLocalIssueRender: boolean;
   strongAiPath?: string;
   outDir?: string;
   packages?: string[];
   model?: string;
   strongAiRepoUrl?: string;
   guardDogRepoUrl?: string;
   strongAiStartingRef?: string;
   guardDogStartingRef?: string;
}

/**
 * Parses CLI args and runs StrongAI platform cloud reviews.
 * @param args - Arguments after `review-strongai-platforms`
 * @returns Process exit code
 */
export async function runReviewStrongAiPlatformsCommand(args: string[]): Promise<number> {
   const options = parseArgs(args);
   const guardDogRoot = process.cwd();
   const strongAiRoot = resolveStrongAiRoot(options.strongAiPath, guardDogRoot);
   const targets = resolveTargets(options.packages);

   const apiKey = process.env.CURSOR_API_KEY?.trim() ?? '';
   const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
   if (!apiKey) {
      throw new InvalidStateError('CURSOR_API_KEY environment variable is required.');
   }
   if (!openAiApiKey) {
      throw new InvalidStateError('OPENAI_API_KEY environment variable is required.');
   }

   defaultLogger.info(
      `Reviewing ${targets.map((t) => t.id).join(', ')} against StrongAI at ${strongAiRoot}`
   );

   const { drafts } = await reviewStrongAiPackagesWithCloudAgents(
      {
         targets,
         apiKey,
         openAiApiKey,
         model: options.model,
         strongAiRepoUrl: options.strongAiRepoUrl,
         guardDogRepoUrl: options.guardDogRepoUrl,
         strongAiStartingRef: options.strongAiStartingRef,
         guardDogStartingRef: options.guardDogStartingRef,
         nodeAuthToken: process.env.NODE_AUTH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim(),
         preferLocalIssueRender: options.preferLocalIssueRender
      },
      defaultLogger
   );

   const outputDir = resolveOutputDir(options, strongAiRoot, guardDogRoot);
   const writeResult = await writeStrongAiIssueDrafts(
      {
         drafts,
         outputDir,
         // Always write draft files unless the caller asked for a pure command dry-run
         // that only reports intent. Here dry-run means "do not sync to GitHub" and
         // write under a GuardDog output folder instead of StrongAI/issues.
         dryRun: false
      },
      defaultLogger
   );

   defaultLogger.info(`Issue drafts written under ${writeResult.outputDir}`);
   for (const written of writeResult.writtenPaths) {
      defaultLogger.info(`  - ${written}`);
   }

   if (options.sync) {
      if (options.dryRun || outputDir !== resolveStrongAiIssuesDir(strongAiRoot)) {
         defaultLogger.info(
            'Skipping GitHub sync because dry-run output is not StrongAI/issues. Re-run without --dry-run and with --sync --confirm.'
         );
      } else {
         await syncStrongAiIssuesToGitHub(
            {
               strongAiRoot,
               confirm: options.confirm
            },
            defaultLogger
         );
      }
   } else {
      defaultLogger.info(
         'Skipped GitHub sync. Re-run with --sync --confirm after reviewing local issue drafts, or run StrongAI tools/build/scripts/sync-issues-to-github.sh.'
      );
   }

   return 0;
}

function resolveOutputDir(
   options: IReviewStrongAiPlatformsCliOptions,
   strongAiRoot: string,
   guardDogRoot: string
): string {
   if (options.outDir) {
      return path.resolve(options.outDir);
   }
   if (options.dryRun) {
      return path.join(guardDogRoot, '.guarddog', 'strongai-issue-drafts');
   }
   return resolveStrongAiIssuesDir(strongAiRoot);
}

function resolveTargets(packageIds: string[] | undefined): IStrongAiPlatformTarget[] {
   if (!packageIds || packageIds.length === 0) {
      return [...STRONGAI_PLATFORM_TARGETS];
   }
   const targets: IStrongAiPlatformTarget[] = [];
   for (const id of packageIds) {
      const target = findStrongAiPlatformTarget(id);
      if (!target) {
         throw new InvalidParameterError(
            `Unknown package id: ${id}. Expected one of: ${STRONGAI_PLATFORM_TARGETS.map((t) => t.id).join(', ')}`
         );
      }
      targets.push(target);
   }
   return targets;
}

function parseArgs(args: string[]): IReviewStrongAiPlatformsCliOptions {
   const options: IReviewStrongAiPlatformsCliOptions = {
      dryRun: false,
      sync: false,
      confirm: false,
      preferLocalIssueRender: false,
      model: DEFAULT_CURSOR_MODEL,
      strongAiRepoUrl: DEFAULT_STRONGAI_REPO_URL,
      guardDogRepoUrl: DEFAULT_GUARDDOG_REPO_URL,
      strongAiStartingRef: DEFAULT_STRONGAI_STARTING_REF,
      guardDogStartingRef: DEFAULT_GUARDDOG_STARTING_REF
   };

   for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
         case '--dry-run':
            options.dryRun = true;
            break;
         case '--sync':
            options.sync = true;
            break;
         case '--confirm':
            options.confirm = true;
            break;
         case '--prefer-local-issue-render':
            options.preferLocalIssueRender = true;
            break;
         case '--strongai-path':
            options.strongAiPath = requireNext(args, ++i, '--strongai-path');
            break;
         case '--out-dir':
            options.outDir = requireNext(args, ++i, '--out-dir');
            break;
         case '--packages':
            options.packages = requireNext(args, ++i, '--packages')
               .split(',')
               .map((value) => value.trim())
               .filter((value) => value.length > 0);
            break;
         case '--model':
            options.model = requireNext(args, ++i, '--model');
            break;
         case '--strongai-repo-url':
            options.strongAiRepoUrl = requireNext(args, ++i, '--strongai-repo-url');
            break;
         case '--guarddog-repo-url':
            options.guardDogRepoUrl = requireNext(args, ++i, '--guarddog-repo-url');
            break;
         case '--strongai-ref':
            options.strongAiStartingRef = requireNext(args, ++i, '--strongai-ref');
            break;
         case '--guarddog-ref':
            options.guardDogStartingRef = requireNext(args, ++i, '--guarddog-ref');
            break;
         default:
            throw new InvalidParameterError(`Unknown option: ${arg}`);
      }
   }

   return options;
}

function requireNext(args: string[], index: number, flag: string): string {
   const value = args[index];
   if (!value || value.startsWith('--')) {
      throw new InvalidParameterError(`${flag} requires a value.`);
   }
   return value;
}
