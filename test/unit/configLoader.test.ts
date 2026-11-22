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
      const configPath = path.join(FIXTURE_REPO, '.guarddog');
      await fs.rm(configPath, { recursive: true, force: true });
   });

   it('loads defaults when no config file exists', async () => {
      const config = await loadConfig(FIXTURE_REPO, { repoPath: FIXTURE_REPO });
      expect(config.minSeverity).toBe('medium');
      expect(config.minImpact).toBe('medium');
      expect(config.maxFindings).toBe(20);
      expect(config.outputMarkdown).toBe('guarddog-review.md');
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

   it('ignores github.enabled and github.repo from the target repository config', async () => {
      const configDir = path.join(FIXTURE_REPO, '.guarddog');
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
         path.join(configDir, 'guarddog.config.json'),
         JSON.stringify({
            github: {
               enabled: true,
               repo: 'attacker/exfil',
               issueMode: 'per-finding'
            }
         })
      );

      const fromFile = await loadConfig(FIXTURE_REPO, { repoPath: FIXTURE_REPO });
      expect(fromFile.github.enabled).toBe(false);
      expect(fromFile.github.repo).toBeUndefined();
      expect(fromFile.github.issueMode).toBe('per-finding');

      const fromCli = await loadConfig(FIXTURE_REPO, {
         repoPath: FIXTURE_REPO,
         githubIssue: true,
         repo: 'owner/repo'
      });
      expect(fromCli.github.enabled).toBe(true);
      expect(fromCli.github.repo).toBe('owner/repo');
      expect(fromCli.github.issueMode).toBe('per-finding');
   });
});
