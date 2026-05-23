/**
 * @module test/unit/repoScanner.test
 * Tests for repository scanning.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import { generateRepoMap } from '../../src/core/repoScanner';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

describe('repoScanner', () => {
   it('detects package files, source/test dirs, and CI files', async () => {
      const repoMap = await generateRepoMap(FIXTURE_REPO);
      expect(repoMap.packageManager).toBe('npm');
      expect(repoMap.packages.length).toBeGreaterThan(0);
      expect(repoMap.detectedLanguages).toContain('TypeScript');
      expect(repoMap.sourceDirectories.some((d) => d.includes('src'))).toBe(true);
      expect(repoMap.ciFiles.some((f) => f.includes('.github/workflows'))).toBe(true);
      expect(repoMap.importantFiles.some((f) => f.toLowerCase().includes('design.md'))).toBe(true);
   });
});
