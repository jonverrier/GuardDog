/**
 * @module test/unit/reviewPrompt.test
 * Tests prompt template loading and expansion (code path — not prompt quality).
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { createPromptRepository } from '../../src/core/promptFactory';
import { buildReviewPromptParams } from '../../src/core/reviewPromptBuilder';
import { architectureReviewPromptId } from '../../src/PromptIds';

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
         true
      );

      const expanded = repo.expandUserPrompt(prompt!, {
         architectureIntent: params.architectureIntent,
         repoMap: params.repoMap,
         contextFilesSection: params.contextFilesSection,
         sampledReviewNote: params.sampledReviewNote
      });

      expect(expanded).toContain('# Design');
      expect(expanded).toContain('{"rootPath":"/repo"}');
      expect(expanded).toContain('src/api.ts');
      expect(expanded).toContain('sampled review');
      expect(expanded).toContain('Return JSON matching the required schema');
   });

   it('uses placeholder when design content is absent', () => {
      const params = buildReviewPromptParams('{}', undefined, [], false);
      expect(params.architectureIntent).toContain('No architecture intent file was provided');
   });
});
