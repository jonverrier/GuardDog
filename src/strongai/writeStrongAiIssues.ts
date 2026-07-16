/**
 * @module strongai/writeStrongAiIssues
 * Writes StrongAI issue markdown drafts to disk.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import { IStrongAiIssueDraft } from '../schemas/strongAiPlatforms';
import { writeTextFile } from '../utils/fileSystem';
import { ILogger, defaultLogger } from '../utils/logger';
import { assertValidStrongAiIssueMarkdown } from './strongAiIssueValidator';

export interface IWriteStrongAiIssuesOptions {
   drafts: readonly IStrongAiIssueDraft[];
   /** Absolute directory that receives the issue markdown files. */
   outputDir: string;
   dryRun?: boolean;
}

export interface IWriteStrongAiIssuesResult {
   writtenPaths: string[];
   outputDir: string;
}

/**
 * Validates and writes issue drafts under the given output directory.
 * @param options - Write options
 * @param logger - Logger
 */
export async function writeStrongAiIssueDrafts(
   options: IWriteStrongAiIssuesOptions,
   logger: ILogger = defaultLogger
): Promise<IWriteStrongAiIssuesResult> {
   const writtenPaths: string[] = [];

   for (const draft of options.drafts) {
      assertValidStrongAiIssueMarkdown(draft.markdown, draft.fileName);
      const outputPath = path.join(options.outputDir, draft.fileName);
      if (options.dryRun) {
         logger.info(`[dry-run] Would write ${outputPath}`);
         writtenPaths.push(outputPath);
         continue;
      }
      await writeTextFile(outputPath, draft.markdown);
      logger.info(`Wrote StrongAI issue draft: ${outputPath}`);
      writtenPaths.push(outputPath);
   }

   return { writtenPaths, outputDir: options.outputDir };
}

/**
 * Resolves the StrongAI issues/ directory from a monorepo root.
 * @param strongAiRoot - Absolute StrongAI monorepo path
 */
export function resolveStrongAiIssuesDir(strongAiRoot: string): string {
   return path.join(strongAiRoot, 'issues');
}
