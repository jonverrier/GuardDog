/**
 * @module test/unit/tokenBudgetPacker.test
 * Tests for greedy token budget packing.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { packFilesToTokenBudget } from '../../src/core/tokenBudgetPacker';
import { ITokenEncoder } from '../../src/utils/tokenCounter';

function createMockEncoder(tokensPerChar: number): ITokenEncoder {
   return {
      encode(text: string): Uint32Array {
         const length = Math.max(1, Math.ceil(text.length * tokensPerChar));
         return new Uint32Array(length);
      },
      free(): void {
         // no-op
      }
   };
}

describe('tokenBudgetPacker', () => {
   it('packs files until budget is exhausted', async () => {
      const encoder = createMockEncoder(0.5);
      const files: Record<string, string> = {
         'a.ts': 'aaaa',
         'b.ts': 'bbbbbbbb',
         'c.ts': 'cc'
      };

      const result = await packFilesToTokenBudget({
         rootPath: '/repo',
         orderedPaths: ['a.ts', 'b.ts', 'c.ts'],
         tokenBudget: 6,
         maxFileTokens: 100,
         encoder,
         readFile: async (_root, rel) => files[rel]
      });

      expect(result.files.map((f) => f.relativePath)).toEqual(['a.ts', 'b.ts']);
      expect(result.tokensUsed).toBe(6);
      expect(result.manifest.find((m) => m.path === 'c.ts')?.reason).toBe('budget_exhausted');
   });

   it('skips files exceeding per-file token cap', async () => {
      const encoder = createMockEncoder(1);
      const result = await packFilesToTokenBudget({
         rootPath: '/repo',
         orderedPaths: ['large.ts'],
         tokenBudget: 10000,
         maxFileTokens: 5,
         encoder,
         readFile: async () => '1234567890'
      });

      expect(result.files).toHaveLength(0);
      expect(result.manifest[0].reason).toBe('file_too_large');
   });

   it('marks unreadable files in manifest', async () => {
      const encoder = createMockEncoder(1);
      const result = await packFilesToTokenBudget({
         rootPath: '/repo',
         orderedPaths: ['missing.ts'],
         tokenBudget: 100,
         maxFileTokens: 100,
         encoder,
         readFile: async () => undefined
      });

      expect(result.manifest[0].reason).toBe('unreadable');
   });
});
