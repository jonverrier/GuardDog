/**
 * @module test/unit/contextCoverageNotes.test
 * Tests for context coverage messaging.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import {
   buildContextCoverageSummary,
   formatContextCoverageMarkdown,
   formatContextCoveragePromptNote
} from '../../src/core/contextCoverageNotes';
import { IContextSelectionMeta } from '../../src/schemas/contextManifest';

function makeMeta(overrides: Partial<IContextSelectionMeta> = {}): IContextSelectionMeta {
   return {
      ranker: 'c4-llm',
      c4DocsDiscovered: 14,
      c4DocsOfferedToReview: 14,
      contextTokenBudget: 32000,
      c4TokenBudget: 12000,
      designTokenBudget: 4000,
      rankerC4TokenBudget: 12000,
      tokensUsed: { design: 500, c4: 8000, source: 10000 },
      budgetUtilization: {
         design: { budget: 4000, used: 500, fillRatio: 0.125 },
         c4: { budget: 12000, used: 8000, fillRatio: 0.667 },
         source: { budget: 32000, used: 10000, fillRatio: 0.313 }
      },
      layerPack: {
         design: { offered: 1, included: 1, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 },
         c4: { offered: 14, included: 6, skippedBudget: 8, skippedTooLarge: 0, skippedUnreadable: 0 },
         source: { offered: 55, included: 40, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 }
      },
      summary: {
         totalCandidates: 200,
         rankedByRanker: 55,
         unrankedByRanker: 145,
         packedIncluded: 47,
         skippedBudget: 8,
         skippedTooLarge: 0,
         skippedUnreadable: 0
      },
      truncation: {
         rankerCapped: true,
         budgetExhausted: true,
         rankerC4Truncated: false,
         design: false,
         c4: true,
         source: false
      },
      manifest: [],
      ...overrides
   };
}

describe('contextCoverageNotes', () => {
   it('describes C4-guided ranking distinctly from discards', () => {
      const md = formatContextCoverageMarkdown(buildContextCoverageSummary(makeMeta()));
      expect(md.join('\n')).toContain('C4-guided');
      expect(md.join('\n')).toContain('14');
      expect(md.join('\n')).toContain('Discarded');
      expect(md.join('\n')).not.toContain('sampled review');
   });

   it('describes heuristic ranking when no C4 ranker', () => {
      const md = formatContextCoverageMarkdown(
         buildContextCoverageSummary(makeMeta({ ranker: 'heuristic', c4DocsDiscovered: 0 }))
      );
      expect(md.join('\n')).toContain('Heuristic');
   });

   it('prompt note mentions source truncation only when source layer truncated', () => {
      const full = formatContextCoveragePromptNote(buildContextCoverageSummary(makeMeta()));
      expect(full).toContain('C4-guided');
      expect(full).not.toContain('ranked source files were not included');

      const c4Only = formatContextCoveragePromptNote(
         buildContextCoverageSummary(
            makeMeta({
               truncation: {
                  rankerCapped: true,
                  budgetExhausted: true,
                  rankerC4Truncated: false,
                  design: false,
                  c4: true,
                  source: false
               }
            })
         )
      );
      expect(c4Only).toContain('discarded');
      expect(c4Only).not.toContain('ranked source files were not included');
   });
});
