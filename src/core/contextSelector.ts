/**
 * @module core/contextSelector
 * Selects bounded context files using C4-guided ranking and tiktoken budgets.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import {
   capC4ArchitectureFilesForContext,
   isC4ArchitectureDoc,
   sortC4ArchitectureFiles
} from './c4ArchitectureDocs';
import { logContextCoverage } from './contextCoverageNotes';
import { rankContextFiles, isContextCandidate } from './contextRanker';
import { packFilesToTokenBudget } from './tokenBudgetPacker';
import { IRepoMap } from '../schemas/repoMap';
import { IGuardDogConfig } from '../schemas/config';
import {
   buildBudgetUtilization,
   buildContextSelectionSummary,
   buildLayerPackStats,
   IContextManifestEntry,
   IContextSelectionMeta,
   isLayerTruncated,
   isSourceLayerTruncated
} from '../schemas/contextManifest';
import { loadGitignorePatterns, readContextFile, walkFiles } from '../utils/fileSystem';
import { createTokenEncoder, freeTokenEncoder } from '../utils/tokenCounter';
import { ILogger, defaultLogger } from '../utils/logger';
import { IPromptRepository, IChatDriver } from '@jonverrier/prompt-repository';

export interface IContextFile {
   relativePath: string;
   content: string;
}

export interface IContextSelectionResult {
   files: IContextFile[];
   sampledReview: boolean;
   totalFilesAvailable: number;
   contextManifest: IContextManifestEntry[];
   tokensUsed: { design: number; c4: number; source: number };
   contextSelection: IContextSelectionMeta;
}

/**
 * Selects bounded context files for the architecture review prompt.
 */
export async function selectContextFiles(
   rootPath: string,
   repoMap: IRepoMap,
   designFile: string | undefined,
   designContent: string | undefined,
   config: IGuardDogConfig,
   logger: ILogger = defaultLogger,
   chatDriver?: IChatDriver,
   promptRepo?: IPromptRepository
): Promise<IContextSelectionResult> {
   const gitignorePatterns = await loadGitignorePatterns(path.join(rootPath, '.gitignore'));
   const allFiles = await walkFiles(rootPath, gitignorePatterns);
   const c4Options = {
      componentFile: config.componentFile,
      contextFile: config.contextFile
   };

   const encoder = createTokenEncoder(config.model);
   const manifest: IContextManifestEntry[] = [];
   const files: IContextFile[] = [];
   let rankCounter = 1;
   let designTokensUsed = 0;
   let c4TokensUsed = 0;
   let sourceTokensUsed = 0;

   const rankOutcome = await rankContextFiles(
      rootPath,
      repoMap,
      allFiles,
      designFile,
      designContent,
      config,
      encoder,
      logger,
      chatDriver,
      promptRepo
   );

   const c4PathsOffered = capC4ArchitectureFilesForContext(
      sortC4ArchitectureFiles(repoMap.c4ArchitectureFiles, c4Options)
   );
   const rankedSourceSet = new Set(rankOutcome.rankedPaths);

   try {
      if (designFile) {
         const designPack = await packFilesToTokenBudget({
            rootPath,
            orderedPaths: [designFile],
            tokenBudget: config.designTokenBudget,
            maxFileTokens: config.maxFileTokens,
            encoder,
            readFile: readContextFile,
            startRank: rankCounter
         });
         rankCounter += 1;
         files.push(...designPack.files);
         manifest.push(...designPack.manifest);
         designTokensUsed = designPack.tokensUsed;
      }

      const c4Pack = await packFilesToTokenBudget({
         rootPath,
         orderedPaths: c4PathsOffered,
         tokenBudget: config.c4TokenBudget,
         maxFileTokens: config.maxFileTokens,
         encoder,
         readFile: readContextFile,
         startRank: rankCounter
      });
      rankCounter += c4PathsOffered.length;
      files.push(...c4Pack.files);
      manifest.push(...c4Pack.manifest);
      c4TokensUsed = c4Pack.tokensUsed;

      const sourcePack = await packFilesToTokenBudget({
         rootPath,
         orderedPaths: rankOutcome.rankedPaths,
         tokenBudget: config.contextTokenBudget,
         maxFileTokens: config.maxFileTokens,
         encoder,
         readFile: readContextFile,
         startRank: rankCounter
      });
      files.push(...sourcePack.files);
      manifest.push(...sourcePack.manifest);
      sourceTokensUsed = sourcePack.tokensUsed;
   } finally {
      freeTokenEncoder(encoder);
   }

   const isDesignPath = (p: string): boolean => designFile !== undefined && p === designFile;
   const isC4Path = (p: string): boolean => isC4ArchitectureDoc(p, c4Options);
   const isSourcePath = (p: string): boolean => rankedSourceSet.has(p);

   const layerPack = {
      design: buildLayerPackStats(manifest, isDesignPath),
      c4: buildLayerPackStats(manifest, isC4Path),
      source: buildLayerPackStats(manifest, isSourcePath)
   };

   const totalCandidates = allFiles.filter(isContextCandidate).length;
   const rankedByRanker = rankOutcome.rankedPaths.length;
   const summary = buildContextSelectionSummary(totalCandidates, rankedByRanker, manifest);
   const rankerCapped = summary.unrankedByRanker > 0;
   const sourceTruncated = isSourceLayerTruncated(layerPack.source);
   const sampledReview = sourceTruncated;

   const budgetUtilization = buildBudgetUtilization(
      config.designTokenBudget,
      designTokensUsed,
      config.c4TokenBudget,
      c4TokensUsed,
      config.contextTokenBudget,
      sourceTokensUsed
   );

   const contextSelection: IContextSelectionMeta = {
      ranker: rankOutcome.ranker,
      c4DocsDiscovered: repoMap.c4ArchitectureFiles.length,
      c4DocsOfferedToReview: c4PathsOffered.length,
      contextTokenBudget: config.contextTokenBudget,
      c4TokenBudget: config.c4TokenBudget,
      designTokenBudget: config.designTokenBudget,
      rankerC4TokenBudget: config.rankerC4TokenBudget,
      tokensUsed: { design: designTokensUsed, c4: c4TokensUsed, source: sourceTokensUsed },
      budgetUtilization,
      layerPack,
      summary,
      truncation: {
         rankerCapped,
         budgetExhausted: isLayerTruncated(layerPack.design) || isLayerTruncated(layerPack.c4) || sourceTruncated,
         rankerC4Truncated: rankOutcome.rankerC4Truncated,
         design: isLayerTruncated(layerPack.design),
         c4: isLayerTruncated(layerPack.c4),
         source: sourceTruncated
      },
      manifest
   };

   logContextCoverage((message) => logger.info(message), contextSelection);

   return {
      files,
      sampledReview,
      totalFilesAvailable: allFiles.length,
      contextManifest: manifest,
      tokensUsed: { design: designTokensUsed, c4: c4TokensUsed, source: sourceTokensUsed },
      contextSelection
   };
}
