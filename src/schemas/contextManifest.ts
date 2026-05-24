/**

 * @module schemas/contextManifest

 * Types for context selection manifest and token usage tracking.

 */

// Copyright (c) 2025 Jon Verrier



export type ContextManifestSkipReason = 'budget_exhausted' | 'file_too_large' | 'unreadable';



export interface IContextManifestEntry {

   path: string;

   rank: number;

   tokens: number;

   included: boolean;

   reason?: ContextManifestSkipReason;

}



export type ContextRankerMode = 'c4-llm' | 'heuristic';



/** Token budget and consumption for one context layer. */

export interface ILayerBudgetUtilization {

   budget: number;

   used: number;

   /** used / budget, rounded to three decimal places (0 when budget is 0). */

   fillRatio: number;

}



export interface IBudgetUtilization {

   design: ILayerBudgetUtilization;

   c4: ILayerBudgetUtilization;

   source: ILayerBudgetUtilization;

}



/** Per-layer pack outcomes derived from the manifest. */

export interface ILayerPackStats {

   offered: number;

   included: number;

   skippedBudget: number;

   skippedTooLarge: number;

   skippedUnreadable: number;

}



export interface IContextLayerPack {

   design: ILayerPackStats;

   c4: ILayerPackStats;

   source: ILayerPackStats;

}



/** Aggregate counts for context selection transparency. */

export interface IContextSelectionSummary {

   totalCandidates: number;

   rankedByRanker: number;

   unrankedByRanker: number;

   packedIncluded: number;

   skippedBudget: number;

   skippedTooLarge: number;

   skippedUnreadable: number;

}



/** Distinguishes ranker focus from token-budget truncation. */

export interface IContextSelectionTruncation {

   rankerCapped: boolean;

   budgetExhausted: boolean;

   rankerC4Truncated: boolean;

   design: boolean;

   c4: boolean;

   source: boolean;

}



/** Human-readable context selection summary for reports and JSON output. */
export interface IContextCoverageSummary {
   rankingMode: ContextRankerMode;
   c4DocsDiscovered: number;
   c4DocsInReview: number;
   rankedSourcePaths: number;
   sourcePathsInReview: number;
   discardedTotal: number;
   discardedByLayer: { design: number; c4: number; source: number };
   layerTruncation: { design: boolean; c4: boolean; source: boolean };
   sampledSourceReview: boolean;
}

export interface IContextSelectionMeta {

   ranker: ContextRankerMode;

   c4DocsDiscovered: number;

   c4DocsOfferedToReview: number;

   contextTokenBudget: number;

   c4TokenBudget: number;

   designTokenBudget: number;

   rankerC4TokenBudget: number;

   tokensUsed: { design: number; c4: number; source: number };

   budgetUtilization: IBudgetUtilization;

   layerPack: IContextLayerPack;

   summary: IContextSelectionSummary;

   truncation: IContextSelectionTruncation;

   manifest: IContextManifestEntry[];

}



/**

 * Computes fill ratio for a layer budget.

 * @param budget - Layer token budget

 * @param used - Tokens consumed in the layer

 */

export function computeFillRatio(budget: number, used: number): number {

   if (budget <= 0) {

      return 0;

   }

   return Math.round((used / budget) * 1000) / 1000;

}



/**

 * Builds per-layer budget utilization metadata.

 */

export function buildBudgetUtilization(

   designBudget: number,

   designUsed: number,

   c4Budget: number,

   c4Used: number,

   sourceBudget: number,

   sourceUsed: number

): IBudgetUtilization {

   return {

      design: { budget: designBudget, used: designUsed, fillRatio: computeFillRatio(designBudget, designUsed) },

      c4: { budget: c4Budget, used: c4Used, fillRatio: computeFillRatio(c4Budget, c4Used) },

      source: { budget: sourceBudget, used: sourceUsed, fillRatio: computeFillRatio(sourceBudget, sourceUsed) }

   };

}



/**

 * Builds pack stats for manifest entries matching a path predicate.

 * @param manifest - Full context manifest

 * @param matchesPath - Returns true when an entry belongs to the layer

 */

export function buildLayerPackStats(

   manifest: IContextManifestEntry[],

   matchesPath: (path: string) => boolean

): ILayerPackStats {

   const entries = manifest.filter((m) => matchesPath(m.path));

   return {

      offered: entries.length,

      included: entries.filter((m) => m.included).length,

      skippedBudget: entries.filter((m) => m.reason === 'budget_exhausted').length,

      skippedTooLarge: entries.filter((m) => m.reason === 'file_too_large').length,

      skippedUnreadable: entries.filter((m) => m.reason === 'unreadable').length

   };

}



/**

 * Returns true when any entry in the layer was skipped due to budget or per-file cap.

 * @param stats - Layer pack stats

 */

export function isLayerTruncated(stats: ILayerPackStats): boolean {

   return stats.skippedBudget > 0 || stats.skippedTooLarge > 0;

}



/**

 * Builds summary counts from ranker output and packer manifest.

 */

export function buildContextSelectionSummary(

   totalCandidates: number,

   rankedByRanker: number,

   manifest: IContextManifestEntry[]

): IContextSelectionSummary {

   return {

      totalCandidates,

      rankedByRanker,

      unrankedByRanker: Math.max(0, totalCandidates - rankedByRanker),

      packedIncluded: manifest.filter((m) => m.included).length,

      skippedBudget: manifest.filter((m) => m.reason === 'budget_exhausted').length,

      skippedTooLarge: manifest.filter((m) => m.reason === 'file_too_large').length,

      skippedUnreadable: manifest.filter((m) => m.reason === 'unreadable').length

   };

}



/**

 * Returns true when the packer skipped ranked source files due to token limits or per-file caps.

 * @param sourceStats - Source layer pack stats

 */

export function isSourceLayerTruncated(sourceStats: ILayerPackStats): boolean {

   return isLayerTruncated(sourceStats);

}


