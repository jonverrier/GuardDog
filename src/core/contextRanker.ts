/**
 * @module core/contextRanker
 * Ranks source files for review context using C4 LLM ranker or heuristics.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Ranks repository files to build a useful review context. It prefers a C4-aware LLM ranker when C4 architecture documents are present, and falls back to deterministic heuristics otherwise. buildFileIndex scans a provided file list, filters to context-worthy extensions, and records path, extension, and byte size using fs/promises and path. rankContextFiles is the main entry point. It loads and orders C4 docs, calls an LLM with a constrained JSON response, validates and filters returned paths, and reports whether the result came from the C4 LLM ranker or heuristics. buildHeuristicRankedPaths implements the fallback strategy by prioritizing config, CI, deployment, dependency, source-directory samples, and test setup files, then filling in with remaining candidates. isContextCandidate exposes the shared extension and filename rules. Key dependencies include @jonverrier/prompt-repository (ChatDriverFactory, model selection, constrained responses), promptFactory and contextRankerPromptId for prompt loading, schema constants for JSON validation/defaults, and isC4ArchitectureDoc plus file utilities for excluding design and C4 docs.
// ===End StrongAI Generated Comment===


import * as fs from 'fs/promises';
import * as path from 'path';
import {
   ChatDriverFactory,
   EModel,
   EModelProvider,
   EVerbosity,
   IChatDriver,
   IPromptRepository
} from '@jonverrier/prompt-repository';
import { contextRankerPromptId } from '../PromptIds';
import { createPromptRepository } from './promptFactory';
import { isC4ArchitectureDoc, sortC4ArchitectureFiles } from './c4ArchitectureDocs';
import { packC4DocsForPrompt } from './c4DocsPacker';
import { IRepoMap } from '../schemas/repoMap';
import { ContextRankerMode } from '../schemas/contextManifest';
import {
   CONTEXT_RANK_JSON_SCHEMA,
   DEFAULT_CONTEXT_RANK_RESULT,
   IFileIndexEntry,
   IContextRankResult
} from '../schemas/contextRank';
import { IGuardDogConfig } from '../schemas/config';
import { InvalidOperationError } from '../utils/errors';
import { ILogger, defaultLogger } from '../utils/logger';
import { readContextFile } from '../utils/fileSystem';
import { ITokenEncoder } from '../utils/tokenCounter';

const CONTEXT_EXTENSIONS = new Set([
   '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml',
   '.toml', '.tf', '.sh', '.ps1', '.py', '.go', '.rs'
]);

const MAX_RANKED_FILES_FOR_LLM = 80;
const HEURISTIC_SOURCE_FILES_PER_DIR = 8;
const HEURISTIC_TEST_SETUP_FILES = 3;

export interface IContextRankOutcome {
   rankedPaths: string[];
   ranker: ContextRankerMode;
   rankerC4Truncated: boolean;
}

/**
 * Builds a flat file index with path, extension, and byte size.
 * @param rootPath - Repository root
 * @param allFiles - Relative paths from repository walk
 */
export async function buildFileIndex(
   rootPath: string,
   allFiles: string[]
): Promise<IFileIndexEntry[]> {
   const index: IFileIndexEntry[] = [];
   for (const relativePath of allFiles) {
      if (!isSourceIndexCandidate(relativePath)) {
         continue;
      }
      try {
         const stat = await fs.stat(path.join(rootPath, relativePath));
         if (!stat.isFile()) {
            continue;
         }
         index.push({
            path: relativePath,
            extension: path.extname(relativePath).toLowerCase(),
            sizeBytes: stat.size
         });
      } catch {
         // skip unreadable
      }
   }
   return index;
}

/**
 * Ranks source files for context selection.
 * @param rootPath - Repository root
 * @param repoMap - Repository map
 * @param allFiles - All relative file paths
 * @param designFile - Optional design file path to exclude
 * @param designContent - Design file content for LLM ranker
 * @param config - GuardDog configuration
 * @param encoder - Token encoder for C4 budget packing
 * @param logger - Logger instance
 * @param chatDriver - Optional chat driver for tests
 * @param promptRepo - Optional prompt repository for tests
 */
export async function rankContextFiles(
   rootPath: string,
   repoMap: IRepoMap,
   allFiles: string[],
   designFile: string | undefined,
   designContent: string | undefined,
   config: IGuardDogConfig,
   encoder: ITokenEncoder,
   logger: ILogger = defaultLogger,
   chatDriver?: IChatDriver,
   promptRepo?: IPromptRepository
): Promise<IContextRankOutcome> {
   const c4Options = {
      componentFile: config.componentFile,
      contextFile: config.contextFile
   };

   if (repoMap.c4ArchitectureFiles.length === 0) {
      logger.info('No C4 architecture docs found; using heuristic file ranking.');
      return {
         rankedPaths: buildHeuristicRankedPaths(allFiles, repoMap, designFile, c4Options),
         ranker: 'heuristic',
         rankerC4Truncated: false
      };
   }

   try {
      const fileIndex = await buildFileIndex(rootPath, allFiles);
      const c4Pack = await packC4DocsForPrompt({
         rootPath,
         orderedPaths: sortC4ArchitectureFiles(repoMap.c4ArchitectureFiles, c4Options),
         tokenBudget: config.rankerC4TokenBudget,
         maxFileTokens: config.maxFileTokens,
         encoder,
         readFile: readContextFile
      });
      if (c4Pack.truncated) {
         logger.info(
            `ContextRanker C4 input truncated at ${c4Pack.tokensUsed} of ${config.rankerC4TokenBudget} token budget.`
         );
      }
      const c4DocsSection =
         c4Pack.docsSection.length > 0 ? c4Pack.docsSection : '*No C4 documentation could be packed within budget.*';
      const rankResult = await rankWithLlm(
         designContent ?? '*No design file provided.*',
         c4DocsSection,
         fileIndex,
         chatDriver,
         promptRepo
      );
      const validPaths = filterRankedPaths(
         rankResult.rankedPaths,
         fileIndex,
         designFile,
         c4Options
      );
      if (validPaths.length > 0) {
         logger.info(`C4 LLM ranker selected ${validPaths.length} source file(s).`);
         return { rankedPaths: validPaths, ranker: 'c4-llm', rankerC4Truncated: c4Pack.truncated };
      }
      logger.warn('C4 LLM ranker returned no valid paths; falling back to heuristics.');
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`C4 LLM ranker failed (${message}); falling back to heuristics.`);
   }

   return {
      rankedPaths: buildHeuristicRankedPaths(allFiles, repoMap, designFile, c4Options),
      ranker: 'heuristic',
      rankerC4Truncated: false
   };
}

/**
 * Heuristic source file ranking (legacy priority order, source paths only).
 */
export function buildHeuristicRankedPaths(
   allFiles: string[],
   repoMap: IRepoMap,
   designFile: string | undefined,
   c4Options: { componentFile: string; contextFile: string }
): string[] {
   const ranked: string[] = [];
   const seen = new Set<string>();

   const add = (relativePath: string): void => {
      if (seen.has(relativePath) || !allFiles.includes(relativePath)) {
         return;
      }
      if (shouldExcludeFromSourceRank(relativePath, designFile, c4Options)) {
         return;
      }
      seen.add(relativePath);
      ranked.push(relativePath);
   };

   for (const file of repoMap.configFiles) {
      add(file);
   }
   for (const file of repoMap.ciFiles) {
      add(file);
   }
   for (const file of repoMap.deploymentFiles) {
      add(file);
   }
   for (const file of repoMap.dependencyFiles) {
      if (file.endsWith('package.json')) {
         add(file);
      }
   }

   for (const dir of repoMap.sourceDirectories) {
      const dirFiles = allFiles.filter(
         (f) => f.startsWith(`${dir}/`) && isContextCandidate(f) && !shouldExcludeFromSourceRank(f, designFile, c4Options)
      );
      for (const file of dirFiles.slice(0, HEURISTIC_SOURCE_FILES_PER_DIR)) {
         add(file);
      }
   }

   for (const dir of repoMap.testDirectories) {
      const setupFiles = allFiles.filter(
         (f) =>
            f.startsWith(`${dir}/`) &&
            (f.includes('setup') || f.includes('jest') || f.includes('config'))
      );
      for (const file of setupFiles.slice(0, HEURISTIC_TEST_SETUP_FILES)) {
         add(file);
      }
   }

   for (const file of allFiles) {
      if (isContextCandidate(file) && !shouldExcludeFromSourceRank(file, designFile, c4Options)) {
         add(file);
      }
   }

   return ranked;
}

async function rankWithLlm(
   architectureIntent: string,
   c4DocsSection: string,
   fileIndex: IFileIndexEntry[],
   chatDriver?: IChatDriver,
   promptRepo?: IPromptRepository
): Promise<IContextRankResult> {
   const driver = chatDriver ?? new ChatDriverFactory().create(EModel.kLarge, EModelProvider.kOpenAI);
   const repo = promptRepo ?? createPromptRepository();
   const prompt = repo.getPrompt(contextRankerPromptId);
   if (!prompt) {
      throw new InvalidOperationError(`Prompt not found: ${contextRankerPromptId}`);
   }

   const systemPrompt = repo.expandSystemPrompt(prompt, {});
   const userPrompt = repo.expandUserPrompt(prompt, {
      architectureIntent,
      c4DocsSection,
      fileIndexJson: JSON.stringify(fileIndex, null, 2),
      maxRankedFiles: String(MAX_RANKED_FILES_FOR_LLM)
   });

   const result = await driver.getConstrainedModelResponse<IContextRankResult>(
      systemPrompt,
      userPrompt,
      EVerbosity.kLow,
      CONTEXT_RANK_JSON_SCHEMA,
      DEFAULT_CONTEXT_RANK_RESULT,
      [],
      []
   );

   if (!result || !Array.isArray(result.rankedPaths)) {
      throw new InvalidOperationError('LLM context ranker returned invalid result.');
   }

   return result;
}

function filterRankedPaths(
   rankedPaths: string[],
   fileIndex: IFileIndexEntry[],
   designFile: string | undefined,
   c4Options: { componentFile: string; contextFile: string }
): string[] {
   const validSet = new Set(fileIndex.map((e) => e.path));
   const filtered: string[] = [];
   const seen = new Set<string>();
   for (const p of rankedPaths) {
      if (!validSet.has(p) || seen.has(p)) {
         continue;
      }
      if (shouldExcludeFromSourceRank(p, designFile, c4Options)) {
         continue;
      }
      seen.add(p);
      filtered.push(p);
   }
   return filtered;
}

function shouldExcludeFromSourceRank(
   relativePath: string,
   designFile: string | undefined,
   c4Options: { componentFile: string; contextFile: string }
): boolean {
   if (designFile && relativePath === designFile) {
      return true;
   }
   if (isC4ArchitectureDoc(relativePath, c4Options)) {
      return true;
   }
   const base = path.basename(relativePath).toLowerCase();
   if (base === 'readme.md' || base.endsWith('.lock')) {
      return true;
   }
   return false;
}

function isSourceIndexCandidate(relativePath: string): boolean {
   return isContextCandidate(relativePath);
}

export function isContextCandidate(relativePath: string): boolean {
   const ext = path.extname(relativePath).toLowerCase();
   if (!CONTEXT_EXTENSIONS.has(ext)) {
      return false;
   }
   const base = path.basename(relativePath).toLowerCase();
   if (base.endsWith('.lock') || base.includes('.min.')) {
      return false;
   }
   return true;
}
