/**
 * @module test/unit/tokenCounter.test
 * Tests for tiktoken-based token counting.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import {
   countTokens,
   createTokenEncoder,
   freeTokenEncoder,
   resolveEncodingModel
} from '../../src/utils/tokenCounter';

describe('tokenCounter', () => {
   it('counts tokens for a known string', () => {
      const encoder = createTokenEncoder('gpt-4o');
      try {
         const count = countTokens('Hello, GuardDog!', encoder);
         expect(count).toBeGreaterThan(0);
         expect(count).toBeLessThan(20);
      } finally {
         freeTokenEncoder(encoder);
      }
   });

   it('resolves encoding model from gpt-5 style names', () => {
      expect(resolveEncodingModel('gpt-5.2')).toBe('gpt-4o');
   });
});
