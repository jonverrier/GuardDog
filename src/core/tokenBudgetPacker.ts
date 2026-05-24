/**
 * @module core/tokenBudgetPacker
 * Greedy token-budget packing for review context files.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module packs a set of candidate context files into a fixed token budget using a simple greedy, rank-ordered strategy. It is intended for building review or prompt context where higher-ranked paths should be included first until limits are reached.
// 
// The main export is packFilesToTokenBudget(options), an async function that iterates over orderedPaths, reads each file via the provided readFile callback, counts tokens with the supplied encoder, and decides whether to include the file. It enforces both a total tokenBudget and a per-file maxFileTokens limit. It returns the included files (as relativePath plus content), a manifest describing every path processed, and the total tokensUsed. The manifest records rank (optionally offset by startRank), token counts, inclusion status, and a skip reason such as unreadable, file_too_large, or budget_exhausted. Once the budget is exceeded, remaining entries are marked as budget_exhausted without reading further files.
// 
// Key dependencies are countTokens and ITokenEncoder for token measurement, and the context manifest schemas for manifest entry and skip reason types.
// ===End StrongAI Generated Comment===


import {
   ContextManifestSkipReason,
   IContextManifestEntry
} from '../schemas/contextManifest';
import { IContextFile } from './contextSelector';
import { countTokens, ITokenEncoder } from '../utils/tokenCounter';

export interface ITokenBudgetPackOptions {
   rootPath: string;
   orderedPaths: string[];
   tokenBudget: number;
   maxFileTokens: number;
   encoder: ITokenEncoder;
   readFile: (rootPath: string, relativePath: string) => Promise<string | undefined>;
   startRank?: number;
}

export interface ITokenBudgetPackResult {
   files: IContextFile[];
   manifest: IContextManifestEntry[];
   tokensUsed: number;
}

/**
 * Packs files into a token budget in rank order.
 * @param options - Packing options including paths, budget, and encoder
 */
export async function packFilesToTokenBudget(
   options: ITokenBudgetPackOptions
): Promise<ITokenBudgetPackResult> {
   const files: IContextFile[] = [];
   const manifest: IContextManifestEntry[] = [];
   let tokensUsed = 0;
   let budgetExhausted = false;
   const startRank = options.startRank ?? 1;

   for (let i = 0; i < options.orderedPaths.length; i++) {
      const relativePath = options.orderedPaths[i];
      const rank = startRank + i;

      if (budgetExhausted) {
         manifest.push({
            path: relativePath,
            rank,
            tokens: 0,
            included: false,
            reason: 'budget_exhausted'
         });
         continue;
      }

      const content = await options.readFile(options.rootPath, relativePath);
      if (!content) {
         manifest.push({
            path: relativePath,
            rank,
            tokens: 0,
            included: false,
            reason: 'unreadable'
         });
         continue;
      }

      const fileTokens = countTokens(content, options.encoder);

      if (fileTokens > options.maxFileTokens) {
         manifest.push({
            path: relativePath,
            rank,
            tokens: fileTokens,
            included: false,
            reason: 'file_too_large'
         });
         continue;
      }

      if (tokensUsed + fileTokens > options.tokenBudget) {
         manifest.push({
            path: relativePath,
            rank,
            tokens: fileTokens,
            included: false,
            reason: 'budget_exhausted'
         });
         budgetExhausted = true;
         continue;
      }

      files.push({ relativePath, content });
      tokensUsed += fileTokens;
      manifest.push({
         path: relativePath,
         rank,
         tokens: fileTokens,
         included: true
      });
   }

   return { files, manifest, tokensUsed };
}

export type { ContextManifestSkipReason };
