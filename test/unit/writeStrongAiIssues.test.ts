/**
 * @module test/unit/writeStrongAiIssues.test
 * Tests for StrongAI issue draft writing helpers.
 */
// Copyright (c) 2025 Jon Verrier

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'expect';
import { STRONGAI_PLATFORM_TARGETS } from '../../src/schemas/strongAiPlatforms';
import { resolveStrongAiRoot } from '../../src/strongai/syncStrongAiIssues';
import {
   resolveStrongAiIssuesDir,
   writeStrongAiIssueDrafts
} from '../../src/strongai/writeStrongAiIssues';

describe('writeStrongAiIssues', () => {
   it('writes validated issue drafts to the output directory', async () => {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'guarddog-strongai-'));
      const target = STRONGAI_PLATFORM_TARGETS[0];
      const markdown =
         '**Status:** open\n**Type:** proposal\n**GitHub:** pending\n**Superseded by:**\n\n# Title\n\nBody\n';

      const result = await writeStrongAiIssueDrafts({
         outputDir: tmp,
         drafts: [
            {
               target,
               fileName: `${target.issueSlug}.md`,
               markdown,
               title: 'Title'
            }
         ]
      });

      expect(result.writtenPaths).toHaveLength(1);
      const content = await fs.readFile(result.writtenPaths[0], 'utf8');
      expect(content).toContain('**Status:** open');
      expect(resolveStrongAiIssuesDir('/repo/StrongAI').replace(/\\/g, '/')).toBe(
         '/repo/StrongAI/issues'
      );
   });

   it('resolves StrongAI root from explicit path, env, or sibling default', () => {
      const previous = process.env.STRONGAI_PATH;
      try {
         delete process.env.STRONGAI_PATH;
         const fromSibling = resolveStrongAiRoot(undefined, path.join('D:', 'code', 'GuardDog'));
         expect(path.basename(fromSibling)).toBe('StrongAI');
         expect(path.basename(path.dirname(fromSibling))).toBe('code');

         const explicit = resolveStrongAiRoot(path.join('D:', 'custom', 'StrongAI'), path.join('D:', 'code', 'GuardDog'));
         expect(explicit).toBe(path.resolve(path.join('D:', 'custom', 'StrongAI')));

         process.env.STRONGAI_PATH = path.join('D:', 'env', 'StrongAI');
         expect(resolveStrongAiRoot(undefined, path.join('D:', 'code', 'GuardDog'))).toBe(
            path.resolve(path.join('D:', 'env', 'StrongAI'))
         );
      } finally {
         if (previous === undefined) {
            delete process.env.STRONGAI_PATH;
         } else {
            process.env.STRONGAI_PATH = previous;
         }
      }
   });
});
