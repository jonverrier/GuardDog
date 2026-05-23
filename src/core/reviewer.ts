/**
 * @module core/reviewer
 * Orchestrates the architecture review pipeline.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import { loadConfig } from './configLoader';
import { loadDesignFile } from './designLoader';
import { generateRepoMap } from './repoScanner';
import { selectContextFiles } from './contextSelector';
import { applyFindingFilters } from './findingFilter';
import { validateReviewResult, isEmptyDefaultResult, saveDebugResponse } from './findingParser';
import { renderMarkdownReview } from './markdownRenderer';
import { createDefaultLlmProvider, PromptRepositoryLlmProvider } from './llmProvider';
import { buildReviewPromptParams } from './reviewPromptBuilder';
import { IReviewCliOptions } from '../schemas/config';
import { IReviewResult } from '../schemas/finding';
import { resolveRepoPath, writeTextFile } from '../utils/fileSystem';
import { ILogger, defaultLogger } from '../utils/logger';
import { InvalidOperationError } from '../utils/errors';

export interface IReviewRunResult {
   result: IReviewResult;
   markdownPath: string;
   jsonPath?: string;
}

/**
 * Runs the full architecture review pipeline.
 * @param cliOptions - CLI options for the review command
 * @param logger - Logger instance
 * @param llmProvider - Optional LLM provider (for testing)
 */
export async function runReview(
   cliOptions: IReviewCliOptions,
   logger: ILogger = defaultLogger,
   llmProvider: PromptRepositoryLlmProvider = createDefaultLlmProvider()
): Promise<IReviewRunResult> {
   const repoPath = await resolveRepoPath(cliOptions.repoPath);
   const config = await loadConfig(repoPath, cliOptions);

   const design = await loadDesignFile(repoPath, config.designFile, logger);
   const repoMap = await generateRepoMap(repoPath);
   const context = await selectContextFiles(repoPath, repoMap, design.designFile, logger);

   const promptParams = buildReviewPromptParams(
      JSON.stringify(repoMap, null, 2),
      design.designContent,
      context.files,
      context.sampledReview
   );

   logger.info('Running LLM architecture review...');
   let rawResult: IReviewResult;
   try {
      rawResult = await llmProvider.getStructuredReview(promptParams);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InvalidOperationError(`LLM review failed: ${message}`);
   }

   if (isEmptyDefaultResult(rawResult)) {
      const debugPath = await saveDebugResponse(
         repoPath,
         JSON.stringify(rawResult, null, 2)
      );
      throw new InvalidOperationError(
         `LLM returned an empty or unparseable result. Debug output saved to ${debugPath}`
      );
   }

   let validated = validateReviewResult(
      rawResult,
      repoPath,
      design.designFile,
      context.sampledReview
   );

   validated = applyFindingFilters(
      validated,
      config.minSeverity,
      config.minImpact,
      config.maxFindings
   );

   const markdown = renderMarkdownReview(validated);
   const markdownPath = path.isAbsolute(config.outputMarkdown)
      ? config.outputMarkdown
      : path.join(repoPath, config.outputMarkdown);

   if (!cliOptions.dryRun) {
      await writeTextFile(markdownPath, markdown);
      logger.info(`Markdown review written to ${markdownPath}`);
   } else {
      logger.info(`[dry-run] Would write Markdown to ${markdownPath}`);
   }

   let jsonPath: string | undefined;
   if (config.outputJson) {
      jsonPath = path.isAbsolute(config.outputJson)
         ? config.outputJson
         : path.join(repoPath, config.outputJson);
      if (!cliOptions.dryRun) {
         await writeTextFile(jsonPath, JSON.stringify(validated, null, 2));
         logger.info(`JSON review written to ${jsonPath}`);
      } else {
         logger.info(`[dry-run] Would write JSON to ${jsonPath}`);
      }
   }

   return { result: validated, markdownPath, jsonPath };
}
