/**
 * @module core/reviewer
 * Orchestrates the architecture review pipeline.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Orchestrates the end-to-end architecture review pipeline for a repository. The module’s main export is runReview, which resolves the target repo path, loads configuration and the design document, scans the repo to build a structured repo map, and selects relevant context files and sampled prior review content to ground the analysis. It then builds prompt parameters and calls an LLM provider to produce a structured review result. The result is checked for empty/unparseable output, validated against expected schema and context, and filtered by severity, impact, and maximum finding count. Finally, it renders a Markdown report and optionally writes both Markdown and JSON outputs, supporting a dry-run mode that logs intended writes without touching disk. Key dependencies include loadConfig, loadDesignFile, generateRepoMap, selectContextFiles, buildReviewPromptParams, and the LLM provider factory; validateReviewResult, isEmptyDefaultResult, and saveDebugResponse for parsing safeguards; and renderMarkdownReview plus writeTextFile for output. InvalidOperationError is used to surface LLM and parsing failures clearly.
// ===End StrongAI Generated Comment===


import * as path from 'path';
import { loadConfig } from './configLoader';
import { loadDesignFile } from './designLoader';
import { generateRepoMap } from './repoScanner';
import { selectContextFiles } from './contextSelector';
import { applyFindingFilters } from './findingFilter';
import { validateReviewResult, isEmptyDefaultResult, saveDebugResponse } from './findingParser';
import { renderMarkdownReview } from './markdownRenderer';
import { createDefaultLlmProvider, PromptRepositoryLlmProvider } from './llmProvider';
import { buildContextCoverageSummary } from './contextCoverageNotes';
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

   const c4Options = {
      componentFile: config.componentFile,
      contextFile: config.contextFile
   };

   const design = await loadDesignFile(repoPath, config.designFile, logger);
   const repoMap = await generateRepoMap(repoPath, c4Options);
   const context = await selectContextFiles(
      repoPath,
      repoMap,
      design.designFile,
      design.designContent,
      config,
      logger
   );

   repoMap.contextSelection = context.contextSelection;

   const promptParams = buildReviewPromptParams(
      JSON.stringify(repoMap, null, 2),
      design.designContent,
      context.files,
      context.contextSelection
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
      const rawJson = JSON.stringify(rawResult, null, 2);
      if (cliOptions.dryRun) {
         logger.info('[dry-run] Skipping LLM debug artifact write under .guarddog/');
         throw new InvalidOperationError(
            'LLM returned an empty or unparseable result. Debug output was not written (--dry-run).'
         );
      }
      const debugPath = await saveDebugResponse(repoPath, rawJson);
      throw new InvalidOperationError(
         `LLM returned an empty or unparseable result. Debug output saved to ${debugPath}`
      );
   }

   const contextCoverage = buildContextCoverageSummary(context.contextSelection);

   let validated = validateReviewResult(
      rawResult,
      repoPath,
      design.designFile,
      context.sampledReview,
      contextCoverage
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
