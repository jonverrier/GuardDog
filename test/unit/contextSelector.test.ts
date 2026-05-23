/**
 * @module test/unit/contextSelector.test
 * Tests for context file selection priorities.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import { generateRepoMap } from '../../src/core/repoScanner';
import { selectContextFiles } from '../../src/core/contextSelector';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

describe('contextSelector', () => {
   it('prioritises C4-Auto architecture docs in selected context', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      expect(repoMap.c4ArchitectureFiles).toEqual([
         'README.StrongAI.Context.md',
         'src/README.StrongAI.Component.md'
      ]);

      const context = await selectContextFiles(FIXTURE_REPO, repoMap, 'DESIGN.md');
      const selectedPaths = context.files.map((file) => file.relativePath);

      expect(selectedPaths.indexOf('README.StrongAI.Context.md')).toBeGreaterThan(-1);
      expect(selectedPaths.indexOf('src/README.StrongAI.Component.md')).toBeGreaterThan(-1);

      const contextIndex = selectedPaths.indexOf('README.StrongAI.Context.md');
      const apiIndex = selectedPaths.indexOf('src/api/users.ts');
      if (apiIndex >= 0) {
         expect(contextIndex).toBeLessThan(apiIndex);
      }
   });
});
