/**
 * @module test/unit/c4DocsPacker.test
 * Tests for budget-aware C4 doc assembly.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as path from 'path';
import { packC4DocsForPrompt } from '../../src/core/c4DocsPacker';
import { createTokenEncoder, freeTokenEncoder } from '../../src/utils/tokenCounter';

const FIXTURE_REPO = path.join(__dirname, '../fixtures/sample-repo');

describe('c4DocsPacker', () => {
   it('formats included C4 docs in depth order', async () => {
      const encoder = createTokenEncoder();
      try {
         const result = await packC4DocsForPrompt({
            rootPath: FIXTURE_REPO,
            orderedPaths: ['README.StrongAI.Context.md', 'src/README.StrongAI.Component.md'],
            tokenBudget: 12000,
            maxFileTokens: 4096,
            encoder,
            readFile: async (root, rel) => {
               const fs = await import('fs/promises');
               try {
                  return await fs.readFile(path.join(root, rel), 'utf-8');
               } catch {
                  return undefined;
               }
            }
         });

         expect(result.docsSection).toContain('### README.StrongAI.Context.md');
         expect(result.tokensUsed).toBeGreaterThan(0);
         expect(result.manifest.every((m) => m.included)).toBe(true);
      } finally {
         freeTokenEncoder(encoder);
      }
   });

   it('marks truncation when budget is exhausted', async () => {
      const encoder = createTokenEncoder();
      try {
         const result = await packC4DocsForPrompt({
            rootPath: FIXTURE_REPO,
            orderedPaths: ['README.StrongAI.Context.md', 'src/README.StrongAI.Component.md'],
            tokenBudget: 1,
            maxFileTokens: 4096,
            encoder,
            readFile: async (root, rel) => {
               const fs = await import('fs/promises');
               try {
                  return await fs.readFile(path.join(root, rel), 'utf-8');
               } catch {
                  return undefined;
               }
            }
         });

         expect(result.truncated).toBe(true);
         expect(result.manifest.some((m) => m.reason === 'budget_exhausted')).toBe(true);
      } finally {
         freeTokenEncoder(encoder);
      }
   });
});
