/**
 * @module core/contextCoverageNotes
 * Human-readable context selection summaries for logs, prompts, and reports.
 */
// Copyright (c) 2025 Jon Verrier

import {
   IContextCoverageSummary,
   IContextSelectionMeta,
   ILayerPackStats
} from '../schemas/contextManifest';

export type { IContextCoverageSummary };

/**
 * Builds a context coverage summary from selection metadata.
 * @param meta - Context selection metadata from the pipeline
 */
export function buildContextCoverageSummary(meta: IContextSelectionMeta): IContextCoverageSummary {
   const discardedByLayer = {
      design:
         meta.layerPack.design.skippedBudget +
         meta.layerPack.design.skippedTooLarge +
         meta.layerPack.design.skippedUnreadable,
      c4:
         meta.layerPack.c4.skippedBudget +
         meta.layerPack.c4.skippedTooLarge +
         meta.layerPack.c4.skippedUnreadable,
      source:
         meta.layerPack.source.skippedBudget +
         meta.layerPack.source.skippedTooLarge +
         meta.layerPack.source.skippedUnreadable
   };

   return {
      rankingMode: meta.ranker,
      c4DocsDiscovered: meta.c4DocsDiscovered,
      c4DocsInReview: meta.layerPack.c4.included,
      rankedSourcePaths: meta.summary.rankedByRanker,
      sourcePathsInReview: meta.layerPack.source.included,
      discardedTotal: discardedByLayer.design + discardedByLayer.c4 + discardedByLayer.source,
      discardedByLayer,
      layerTruncation: {
         design: meta.truncation.design,
         c4: meta.truncation.c4,
         source: meta.truncation.source
      },
      sampledSourceReview: meta.truncation.source
   };
}

/**
 * Builds Markdown lines describing how context was selected (for reports and LLM prompts).
 * @param summary - Context coverage summary
 */
export function formatContextCoverageMarkdown(summary: IContextCoverageSummary): string[] {
   const lines: string[] = [];
   lines.push('## Context coverage');
   lines.push('');

   if (summary.rankingMode === 'c4-llm') {
      lines.push(
         `- **Ranking:** C4-guided (ContextRanker used C4 architecture docs to prioritise source files).`
      );
      lines.push(
         `  - C4 docs discovered: ${summary.c4DocsDiscovered}; included in review context: ${summary.c4DocsInReview}.`
      );
   } else {
      lines.push(
         `- **Ranking:** Heuristic (no C4 architecture docs found — file paths prioritised by config, CI, and directory heuristics).`
      );
      if (summary.c4DocsDiscovered > 0) {
         lines.push(
            `  - Note: ${summary.c4DocsDiscovered} C4 doc(s) were present but ranking still used heuristics (ranker fallback or empty ranker result).`
         );
      }
   }

   lines.push(
      `- **Source context:** ${summary.sourcePathsInReview} of ${summary.rankedSourcePaths} ranked source file(s) inlined for review.`
   );

   if (summary.discardedTotal === 0) {
      lines.push('- **Discarded:** None — all offered design, C4, and ranked source files fit within token budgets.');
   } else {
      lines.push(
         `- **Discarded:** ${summary.discardedTotal} file(s) omitted (design: ${summary.discardedByLayer.design}, C4: ${summary.discardedByLayer.c4}, source: ${summary.discardedByLayer.source}) due to token budgets or per-file caps.`
      );
      const truncatedLayers: string[] = [];
      if (summary.layerTruncation.design) {
         truncatedLayers.push('design');
      }
      if (summary.layerTruncation.c4) {
         truncatedLayers.push('C4');
      }
      if (summary.layerTruncation.source) {
         truncatedLayers.push('source');
      }
      if (truncatedLayers.length > 0) {
         lines.push(`  - Layers that hit limits: ${truncatedLayers.join(', ')}.`);
      }
   }

   if (summary.sampledSourceReview) {
      lines.push(
         '- **Review caveat:** Some ranked source files were not read — findings may under-represent code outside the included set.'
      );
   } else if (summary.discardedTotal > 0) {
      lines.push(
         '- **Review caveat:** Some C4 or design material was truncated; source files ranked for review were fully included within budget.'
      );
   }

   lines.push('');
   return lines;
}

/**
 * Builds a short note block for the ArchitectureReview user prompt.
 * @param summary - Context coverage summary
 */
export function formatContextCoveragePromptNote(summary: IContextCoverageSummary): string {
   const parts: string[] = ['**Context selection (read before findings):**'];

   if (summary.rankingMode === 'c4-llm') {
      parts.push(
         `Ranking was **C4-guided** (${summary.c4DocsInReview} C4 doc(s) in review context; ${summary.c4DocsDiscovered} discovered).`
      );
   } else {
      parts.push('Ranking was **heuristic** (no C4-guided ranker run).');
   }

   if (summary.discardedTotal > 0) {
      parts.push(
         `${summary.discardedTotal} file(s) were discarded (design ${summary.discardedByLayer.design}, C4 ${summary.discardedByLayer.c4}, source ${summary.discardedByLayer.source}).`
      );
   }

   if (summary.sampledSourceReview) {
      parts.push(
         'Some **ranked source files** were not included — do not claim full-repo source coverage.'
      );
   }

   return `${parts.join(' ')}\n`;
}

function layerLogSuffix(stats: ILayerPackStats): string {
   const skipped = stats.skippedBudget + stats.skippedTooLarge + stats.skippedUnreadable;
   if (skipped === 0) {
      return `${stats.included}/${stats.offered} included`;
   }
   return `${stats.included}/${stats.offered} included, ${skipped} discarded`;
}

/**
 * Logs a concise context coverage summary after selection.
 * @param log - Logger info function
 * @param meta - Context selection metadata
 */
export function logContextCoverage(
   log: (message: string) => void,
   meta: IContextSelectionMeta
): void {
   const summary = buildContextCoverageSummary(meta);
   const rankingLabel =
      summary.rankingMode === 'c4-llm'
         ? `C4-guided ranker (${summary.rankedSourcePaths} source path(s) ranked)`
         : 'heuristic ranker (no C4-guided ranking)';

   log(`Context: ${rankingLabel}.`);
   log(
      `Context packs — design: ${layerLogSuffix(meta.layerPack.design)}; C4: ${layerLogSuffix(meta.layerPack.c4)}; source: ${layerLogSuffix(meta.layerPack.source)}.`
   );

   if (summary.discardedTotal > 0) {
      log(
         `Context discarded: ${summary.discardedTotal} file(s) (design ${summary.discardedByLayer.design}, C4 ${summary.discardedByLayer.c4}, source ${summary.discardedByLayer.source}).`
      );
   }

   if (summary.sampledSourceReview) {
      log('Review caveat: ranked source files were truncated by token budget.');
   }
}
