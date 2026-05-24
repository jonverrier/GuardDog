/**
 * @module test/unit/contextManifest.test
 * Tests for context selection manifest helpers.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { buildBudgetUtilization, computeFillRatio } from '../../src/schemas/contextManifest';

describe('contextManifest', () => {
   it('computes fill ratio rounded to three decimals', () => {
      expect(computeFillRatio(10000, 2500)).toBe(0.25);
      expect(computeFillRatio(0, 100)).toBe(0);
   });

   it('builds per-layer budget utilization', () => {
      const util = buildBudgetUtilization(4000, 1200, 12000, 9000, 32000, 16000);
      expect(util.design).toEqual({ budget: 4000, used: 1200, fillRatio: 0.3 });
      expect(util.c4).toEqual({ budget: 12000, used: 9000, fillRatio: 0.75 });
      expect(util.source).toEqual({ budget: 32000, used: 16000, fillRatio: 0.5 });
   });
});
