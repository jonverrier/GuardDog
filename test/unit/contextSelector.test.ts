/**
 * @module test/unit/contextSelector.test
 * Tests for context file selection priorities.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import { generateRepoMap } from '../../src/core/repoScanner';
import { selectContextFiles } from '../../src/core/contextSelector';
import { DEFAULT_CONFIG } from '../../src/schemas/config';
import { IChatDriver, IPromptRepository } from '@jonverrier/prompt-repository';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

function createMockRankerDeps(): { chatDriver: IChatDriver; promptRepo: IPromptRepository } {
   const chatDriver = {
      getModelResponse: async () => '',
      getStreamedModelResponse: async function* () { yield ''; },
      getModelResponseWithForcedTools: async () => '',
      getStreamedModelResponseWithForcedTools: async function* () { yield ''; },
      getConstrainedModelResponse: async () => ({
         rankedPaths: ['src/persistence/repository.ts', 'src/api/users.ts']
      })
   } as unknown as IChatDriver;

   const promptRepo: IPromptRepository = {
      getPrompt: () => ({
         id: 'test',
         name: 'ContextRanker',
         description: '',
         version: '1',
         schemaversion: '0.1',
         systemPrompt: 'sys',
         userPrompt: 'user',
         userPromptParameters: []
      }),
      expandSystemPrompt: () => 'system',
      expandUserPrompt: () => 'user'
   };

   return { chatDriver, promptRepo };
}

describe('contextSelector', () => {
   it('prioritises C4-Auto architecture docs and includes context manifest', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO, {
         componentFile: DEFAULT_CONFIG.componentFile,
         contextFile: DEFAULT_CONFIG.contextFile
      });
      expect(repoMap.c4ArchitectureFiles).toEqual([
         'README.StrongAI.Context.md',
         'src/README.StrongAI.Component.md'
      ]);

      const { chatDriver, promptRepo } = createMockRankerDeps();
      const context = await selectContextFiles(
         FIXTURE_REPO,
         repoMap,
         'DESIGN.md',
         '# Sample Architecture',
         DEFAULT_CONFIG,
         undefined,
         chatDriver,
         promptRepo
      );
      const selectedPaths = context.files.map((file) => file.relativePath);

      expect(selectedPaths.indexOf('README.StrongAI.Context.md')).toBeGreaterThan(-1);
      expect(selectedPaths.indexOf('src/README.StrongAI.Component.md')).toBeGreaterThan(-1);
      expect(context.contextSelection.ranker).toBe('c4-llm');
      expect(context.contextSelection.summary.totalCandidates).toBeGreaterThan(0);
      expect(context.contextSelection.summary.rankedByRanker).toBe(2);
      expect(context.contextSelection.summary.unrankedByRanker).toBe(
         context.contextSelection.summary.totalCandidates - 2
      );
      expect(context.contextSelection.truncation.rankerCapped).toBe(
         context.contextSelection.summary.unrankedByRanker > 0
      );
      expect(context.contextManifest.length).toBeGreaterThan(0);
      expect(context.tokensUsed.design).toBeGreaterThan(0);
      expect(context.tokensUsed.c4).toBeGreaterThan(0);
      expect(context.contextSelection.budgetUtilization.design.fillRatio).toBeGreaterThan(0);
      expect(context.contextSelection.budgetUtilization.c4.fillRatio).toBeGreaterThan(0);
   });

   it('applies design token budget', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      const tightDesign = {
         ...DEFAULT_CONFIG,
         designTokenBudget: 1,
         c4TokenBudget: 12000,
         contextTokenBudget: 32000
      };
      const context = await selectContextFiles(
         FIXTURE_REPO,
         repoMap,
         'DESIGN.md',
         '# Design',
         tightDesign
      );
      const designEntry = context.contextManifest.find((m) => m.path === 'DESIGN.md');
      expect(designEntry?.included).toBe(false);
      expect(designEntry?.reason).toBe('budget_exhausted');
      expect(context.contextSelection.truncation.design).toBe(true);
      expect(context.sampledReview).toBe(false);
   });

   it('does not mark sampled review when ranker caps paths but budgets are sufficient', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO, {
         componentFile: DEFAULT_CONFIG.componentFile,
         contextFile: DEFAULT_CONFIG.contextFile
      });
      const { chatDriver, promptRepo } = createMockRankerDeps();
      const context = await selectContextFiles(
         FIXTURE_REPO,
         repoMap,
         'DESIGN.md',
         '# Sample Architecture',
         DEFAULT_CONFIG,
         undefined,
         chatDriver,
         promptRepo
      );

      expect(context.contextSelection.truncation.rankerCapped).toBe(true);
      expect(context.contextSelection.truncation.budgetExhausted).toBe(false);
      expect(context.sampledReview).toBe(false);
   });

   it('marks sampled review only when source layer is truncated', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      const tightC4Only = {
         ...DEFAULT_CONFIG,
         contextTokenBudget: 32000,
         c4TokenBudget: 1,
         designTokenBudget: 4000
      };

      const context = await selectContextFiles(
         FIXTURE_REPO,
         repoMap,
         'DESIGN.md',
         '# Design',
         tightC4Only
      );

      expect(context.contextSelection.truncation.c4).toBe(true);
      expect(context.contextSelection.truncation.source).toBe(false);
      expect(context.sampledReview).toBe(false);
   });

   it('marks sampled review when source token budget is exhausted', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      const tightSource = {
         ...DEFAULT_CONFIG,
         contextTokenBudget: 1,
         c4TokenBudget: 12000,
         designTokenBudget: 4000
      };

      const context = await selectContextFiles(
         FIXTURE_REPO,
         repoMap,
         'DESIGN.md',
         '# Design',
         tightSource
      );

      expect(context.contextSelection.truncation.source).toBe(true);
      expect(context.sampledReview).toBe(true);
   });
});
