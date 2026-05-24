/**
 * @module test/unit/reviewPrompt.test
 * Tests prompt template loading and expansion (code path — not prompt quality).
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { createPromptRepository } from '../../src/core/promptFactory';
import { buildReviewPromptParams } from '../../src/core/reviewPromptBuilder';
import { architectureReviewPromptId } from '../../src/PromptIds';
import { IContextSelectionMeta } from '../../src/schemas/contextManifest';

function makeContextSelection(overrides: Partial<IContextSelectionMeta> = {}): IContextSelectionMeta {
   return {
      ranker: 'c4-llm',
      c4DocsDiscovered: 2,
      c4DocsOfferedToReview: 2,
      contextTokenBudget: 32000,
      c4TokenBudget: 12000,
      designTokenBudget: 4000,
      rankerC4TokenBudget: 12000,
      tokensUsed: { design: 100, c4: 500, source: 200 },
      budgetUtilization: {
         design: { budget: 4000, used: 100, fillRatio: 0.025 },
         c4: { budget: 12000, used: 500, fillRatio: 0.042 },
         source: { budget: 32000, used: 200, fillRatio: 0.006 }
      },
      layerPack: {
         design: { offered: 1, included: 1, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 },
         c4: { offered: 2, included: 2, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 },
         source: { offered: 2, included: 2, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 }
      },
      summary: {
         totalCandidates: 10,
         rankedByRanker: 2,
         unrankedByRanker: 8,
         packedIncluded: 5,
         skippedBudget: 0,
         skippedTooLarge: 0,
         skippedUnreadable: 0
      },
      truncation: {
         rankerCapped: true,
         budgetExhausted: false,
         rankerC4Truncated: false,
         design: false,
         c4: false,
         source: false
      },
      manifest: [],
      ...overrides
   };
}

describe('reviewPrompt', () => {
   it('loads ArchitectureReview prompt from Prompts.json', () => {
      const repo = createPromptRepository();
      const prompt = repo.getPrompt(architectureReviewPromptId);
      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('ArchitectureReview');
      expect(prompt?.systemPrompt).toContain('evolutionary architecture');
   });

   it('expands user prompt placeholders from runtime params', () => {
      const repo = createPromptRepository();
      const prompt = repo.getPrompt(architectureReviewPromptId);
      expect(prompt).toBeDefined();

      const params = buildReviewPromptParams(
         '{"rootPath":"/repo"}',
         '# Design\nAPI must not import persistence.',
         [{ relativePath: 'src/api.ts', content: 'export {}' }],
         makeContextSelection({
            truncation: {
               rankerCapped: false,
               budgetExhausted: true,
               rankerC4Truncated: false,
               design: false,
               c4: false,
               source: true
            },
            layerPack: {
               design: { offered: 1, included: 1, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 },
               c4: { offered: 2, included: 2, skippedBudget: 0, skippedTooLarge: 0, skippedUnreadable: 0 },
               source: { offered: 3, included: 1, skippedBudget: 2, skippedTooLarge: 0, skippedUnreadable: 0 }
            }
         })
      );

      const expanded = repo.expandUserPrompt(prompt!, {
         architectureIntent: params.architectureIntent,
         repoMap: params.repoMap,
         contextFilesSection: params.contextFilesSection,
         sampledReviewNote: params.sampledReviewNote
      });

      expect(expanded).toContain('# Design');
      expect(expanded).toContain('C4-guided');
      expect(expanded).toContain('ranked source files');
      expect(expanded).toContain('Return JSON matching the required schema');
      expect(expanded).toContain('Severity rubric');
      expect(expanded).toContain('Do **not** assign **high** or **critical**');
   });

   it('uses placeholder when design content is absent', () => {
      const params = buildReviewPromptParams('{}', undefined, [], makeContextSelection());
      expect(params.architectureIntent).toContain('No architecture intent file was provided');
   });
});
