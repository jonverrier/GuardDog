/**
 * @module test/unit/reviewStrongAiPlatforms.test
 * Tests for StrongAI cloud-review side effects.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runReviewStrongAiPlatformsCommand } from '../../src/cli/commands/reviewStrongAiPlatforms';
import { STRONGAI_PLATFORM_TARGETS } from '../../src/schemas/strongAiPlatforms';
import { reviewStrongAiPackagesWithCloudAgents } from '../../src/strongai/cloudPackageReviewer';

jest.mock('../../src/strongai/cloudPackageReviewer', () => ({
   reviewStrongAiPackagesWithCloudAgents: jest.fn()
}));

const launchCloudAgents = reviewStrongAiPackagesWithCloudAgents as jest.MockedFunction<
   typeof reviewStrongAiPackagesWithCloudAgents
>;

function restoreEnv(name: string, value: string | undefined): void {
   if (value === undefined) {
      delete process.env[name];
      return;
   }
   process.env[name] = value;
}

const ISSUE_MARKDOWN = [
   '**Status:** open',
   '**Type:** proposal',
   '**GitHub:** pending',
   '**Superseded by:** none',
   '',
   '# GuardDog architecture review: platform',
   ''
].join('\n');

describe('reviewStrongAiPlatforms command', () => {
   const originalCursorKey = process.env.CURSOR_API_KEY;
   const originalOpenAiKey = process.env.OPENAI_API_KEY;
   const originalNodeAuthToken = process.env.NODE_AUTH_TOKEN;
   const originalGithubToken = process.env.GITHUB_TOKEN;

   afterEach(() => {
      restoreEnv('CURSOR_API_KEY', originalCursorKey);
      restoreEnv('OPENAI_API_KEY', originalOpenAiKey);
      restoreEnv('NODE_AUTH_TOKEN', originalNodeAuthToken);
      restoreEnv('GITHUB_TOKEN', originalGithubToken);
      launchCloudAgents.mockReset();
   });

   it('does not launch cloud agents on --dry-run', async () => {
      delete process.env.CURSOR_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.NODE_AUTH_TOKEN;
      process.env.GITHUB_TOKEN = 'github-token-should-stay-local';

      const exitCode = await runReviewStrongAiPlatformsCommand(['--dry-run', '--packages', 'platform']);

      expect(exitCode).toBe(0);
      expect(launchCloudAgents).not.toHaveBeenCalled();
   });

   it('does not copy GITHUB_TOKEN into the cloud agent environment', async () => {
      const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'guarddog-cloud-'));
      process.env.CURSOR_API_KEY = 'cursor-test';
      process.env.OPENAI_API_KEY = 'openai-test';
      process.env.GITHUB_TOKEN = 'github-token-should-stay-local';
      delete process.env.NODE_AUTH_TOKEN;
      launchCloudAgents.mockResolvedValue({
         drafts: [
            {
               target: STRONGAI_PLATFORM_TARGETS[0],
               fileName: 'guarddog-platform-architecture-review.md',
               markdown: ISSUE_MARKDOWN,
               title: 'GuardDog architecture review: platform'
            }
         ],
         payloads: []
      });

      try {
         const exitCode = await runReviewStrongAiPlatformsCommand([
            '--packages',
            'platform',
            '--out-dir',
            outputDir
         ]);
         expect(exitCode).toBe(0);
         expect(launchCloudAgents).toHaveBeenCalledTimes(1);
         const options = launchCloudAgents.mock.calls[0][0];
         expect(options.nodeAuthToken).toBeUndefined();
         expect(JSON.stringify(options)).not.toContain('github-token-should-stay-local');
      } finally {
         await fs.rm(outputDir, { recursive: true, force: true });
      }
   });

   it('forwards NODE_AUTH_TOKEN when the operator set it', async () => {
      const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'guarddog-cloud-'));
      process.env.CURSOR_API_KEY = 'cursor-test';
      process.env.OPENAI_API_KEY = 'openai-test';
      process.env.GITHUB_TOKEN = 'github-token-should-stay-local';
      process.env.NODE_AUTH_TOKEN = 'packages-token';
      launchCloudAgents.mockResolvedValue({ drafts: [], payloads: [] });

      try {
         await runReviewStrongAiPlatformsCommand(['--packages', 'platform', '--out-dir', outputDir]);
         const options = launchCloudAgents.mock.calls[0][0];
         expect(options.nodeAuthToken).toBe('packages-token');
      } finally {
         await fs.rm(outputDir, { recursive: true, force: true });
      }
   });
});
