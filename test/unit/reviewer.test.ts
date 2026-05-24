/**
 * @module test/unit/reviewer.test
 * Tests for review pipeline side-effect boundaries.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import * as findingParser from '../../src/core/findingParser';
import { runReview } from '../../src/core/reviewer';
import { PromptRepositoryLlmProvider } from '../../src/core/llmProvider';
import { DEFAULT_REVIEW_RESULT } from '../../src/schemas/finding';
import { InvalidOperationError } from '../../src/utils/errors';
import * as fileSystem from '../../src/utils/fileSystem';
import { ILogger } from '../../src/utils/logger';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

function silentLogger(): ILogger {
   return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
   };
}

describe('reviewer', () => {
   afterEach(() => {
      jest.restoreAllMocks();
   });

   it('does not write debug artifacts on empty LLM result when dry-run is enabled', async () => {
      const writeSpy = jest.spyOn(fileSystem, 'writeTextFile').mockResolvedValue(undefined);
      const saveDebugSpy = jest.spyOn(findingParser, 'saveDebugResponse');

      const llmProvider = {
         getStructuredReview: jest.fn().mockResolvedValue({ ...DEFAULT_REVIEW_RESULT })
      } as unknown as PromptRepositoryLlmProvider;

      await expect(
         runReview(
            {
               repoPath: FIXTURE_REPO,
               dryRun: true
            },
            silentLogger(),
            llmProvider
         )
      ).rejects.toThrow(InvalidOperationError);

      expect(saveDebugSpy).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
   });
});
