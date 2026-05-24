/**
 * @module test/unit/contextRanker.test
 * Tests for context file ranking.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import {
   buildHeuristicRankedPaths,
   rankContextFiles
} from '../../src/core/contextRanker';
import { generateRepoMap } from '../../src/core/repoScanner';
import { DEFAULT_CONFIG } from '../../src/schemas/config';
import { createTokenEncoder, freeTokenEncoder } from '../../src/utils/tokenCounter';
import { IChatDriver, IPromptRepository } from '@jonverrier/prompt-repository';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

describe('contextRanker', () => {
   it('buildHeuristicRankedPaths excludes design and C4 docs', () => {
      const allFiles = [
         'DESIGN.md',
         'README.StrongAI.Context.md',
         'src/api/users.ts',
         'package.json'
      ];
      const repoMap = {
         rootPath: FIXTURE_REPO,
         detectedLanguages: ['TypeScript'],
         packages: [],
         importantFiles: [],
         sourceDirectories: ['src'],
         testDirectories: [],
         configFiles: ['package.json'],
         ciFiles: [],
         deploymentFiles: [],
         dependencyFiles: ['package.json'],
         c4ArchitectureFiles: ['README.StrongAI.Context.md']
      };

      const ranked = buildHeuristicRankedPaths(allFiles, repoMap, 'DESIGN.md', {
         componentFile: DEFAULT_CONFIG.componentFile,
         contextFile: DEFAULT_CONFIG.contextFile
      });

      expect(ranked).not.toContain('DESIGN.md');
      expect(ranked).not.toContain('README.StrongAI.Context.md');
      expect(ranked).toContain('src/api/users.ts');
   });

   it('uses heuristic ranker when no C4 docs exist', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      const repoMapNoC4 = { ...repoMap, c4ArchitectureFiles: [] };
      const allFiles = ['DESIGN.md', 'package.json', 'src/api/users.ts'];

      const encoder = createTokenEncoder();
      try {
         const outcome = await rankContextFiles(
            FIXTURE_REPO,
            repoMapNoC4,
            allFiles,
            'DESIGN.md',
            '# Design',
            DEFAULT_CONFIG,
            encoder
         );

         expect(outcome.ranker).toBe('heuristic');
         expect(outcome.rankedPaths.length).toBeGreaterThan(0);
         expect(outcome.rankerC4Truncated).toBe(false);
      } finally {
         freeTokenEncoder(encoder);
      }
   });

   it('uses LLM ranker when C4 docs exist and driver returns paths', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      const allFiles = [
         'DESIGN.md',
         'README.StrongAI.Context.md',
         'src/README.StrongAI.Component.md',
         'src/api/users.ts',
         'src/persistence/repository.ts',
         'package.json'
      ];

      const mockDriver: IChatDriver = {
         getModelResponse: async () => '',
         getStreamedModelResponse: async function* () { yield ''; },
         getModelResponseWithForcedTools: async () => '',
         getStreamedModelResponseWithForcedTools: async function* () { yield ''; },
         getConstrainedModelResponse: async () => ({
            rankedPaths: ['src/persistence/repository.ts', 'src/api/users.ts']
         })
      } as unknown as IChatDriver;

      const mockRepo: IPromptRepository = {
         getPrompt: () => ({
            id: 'test',
            name: 'ContextRanker',
            description: '',
            version: '1',
            schemaversion: '0.1',
            systemPrompt: 'sys',
            userPrompt: 'user {architectureIntent} {c4DocsSection} {fileIndexJson} {maxRankedFiles}',
            userPromptParameters: []
         }),
         expandSystemPrompt: () => 'system',
         expandUserPrompt: () => 'user'
      };

      const encoder = createTokenEncoder();
      try {
         const outcome = await rankContextFiles(
            FIXTURE_REPO,
            repoMap,
            allFiles,
            'DESIGN.md',
            '# Design',
            DEFAULT_CONFIG,
            encoder,
            { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined },
            mockDriver,
            mockRepo
         );

         expect(outcome.ranker).toBe('c4-llm');
         expect(outcome.rankedPaths[0]).toBe('src/persistence/repository.ts');
      } finally {
         freeTokenEncoder(encoder);
      }
   });

   it('truncates C4 docs for ranker when ranker C4 budget is tight', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      const allFiles = [
         'DESIGN.md',
         'README.StrongAI.Context.md',
         'src/README.StrongAI.Component.md',
         'src/api/users.ts'
      ];
      const mockDriver: IChatDriver = {
         getModelResponse: async () => '',
         getStreamedModelResponse: async function* () { yield ''; },
         getModelResponseWithForcedTools: async () => '',
         getStreamedModelResponseWithForcedTools: async function* () { yield ''; },
         getConstrainedModelResponse: async () => ({ rankedPaths: ['src/api/users.ts'] })
      } as unknown as IChatDriver;
      const mockRepo: IPromptRepository = {
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

      const encoder = createTokenEncoder();
      try {
         const outcome = await rankContextFiles(
            FIXTURE_REPO,
            repoMap,
            allFiles,
            'DESIGN.md',
            '# Design',
            { ...DEFAULT_CONFIG, rankerC4TokenBudget: 1 },
            encoder,
            undefined,
            mockDriver,
            mockRepo
         );
         expect(outcome.rankerC4Truncated).toBe(true);
      } finally {
         freeTokenEncoder(encoder);
      }
   });
});
