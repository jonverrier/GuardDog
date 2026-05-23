/**
 * @module test/unit/configLoader.test
 * Tests for configuration loading and merging.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadConfig } from '../../src/core/configLoader';
import { runInitCommand } from '../../src/cli/commands/init';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

describe('configLoader', () => {
   afterEach(async () => {
      const configPath = path.join(FIXTURE_REPO, '.seamguard');
      await fs.rm(configPath, { recursive: true, force: true });
   });

   it('loads defaults when no config file exists', async () => {
      const config = await loadConfig(FIXTURE_REPO, { repoPath: FIXTURE_REPO });
      expect(config.minSeverity).toBe('medium');
      expect(config.minImpact).toBe('medium');
      expect(config.maxFindings).toBe(20);
      expect(config.outputMarkdown).toBe('seamguard-review.md');
   });

   it('merges config file and CLI overrides', async () => {
      await runInitCommand([FIXTURE_REPO]);
      const config = await loadConfig(FIXTURE_REPO, {
         repoPath: FIXTURE_REPO,
         minSeverity: 'high',
         out: 'custom-review.md',
         githubIssue: true,
         repo: 'owner/repo'
      });
      expect(config.minSeverity).toBe('high');
      expect(config.outputMarkdown).toBe('custom-review.md');
      expect(config.github.enabled).toBe(true);
      expect(config.github.repo).toBe('owner/repo');
   });
});
