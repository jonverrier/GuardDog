/**
 * @module test/unit/findingParser.test
 * Tests for LLM response schema validation.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { validateReviewResult } from '../../src/core/findingParser';
import { InvalidOperationError } from '../../src/utils/errors';

const VALID_RAW = {
   tool: 'SeamGuard',
   repoPath: '/repo',
   generatedAt: '2025-05-23T12:00:00.000Z',
   summary: {
      overallRisk: 'high',
      findingCount: 1,
      highSeverityCount: 1,
      criticalSeverityCount: 0,
      mainThemes: ['Coupling']
   },
   findings: [
      {
         id: 'SG-001',
         title: 'Weak boundary',
         severity: 'high',
         impact: 'high',
         confidence: 'medium',
         principle: 'Preserve optionality',
         evidence: [{ file: 'src/a.ts', observation: 'Cross-layer import' }],
         facts: ['Observed import'],
         inferences: ['Boundary violation'],
         risk: 'High change cost',
         blastRadius: { rating: 'high', reasoning: 'Core module' },
         recommendation: 'Add adapter',
         possibleFitnessFunction: 'Import lint',
         suggestedLabels: ['architecture']
      }
   ]
};

describe('findingParser', () => {
   it('validates a well-formed review result', () => {
      const result = validateReviewResult(VALID_RAW, '/repo', 'DESIGN.md', false);
      expect(result.tool).toBe('SeamGuard');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('SG-001');
      expect(result.summary.highSeverityCount).toBe(1);
   });

   it('rejects missing findings array', () => {
      expect(() =>
         validateReviewResult({ summary: VALID_RAW.summary }, '/repo', undefined, false)
      ).toThrow(InvalidOperationError);
   });

   it('rejects invalid severity values', () => {
      const invalid = {
         ...VALID_RAW,
         findings: [{ ...VALID_RAW.findings[0], severity: 'urgent' }]
      };
      expect(() => validateReviewResult(invalid, '/repo', undefined, false)).toThrow(
         InvalidOperationError
      );
   });

   it('marks sampled review from pipeline flag', () => {
      const result = validateReviewResult(VALID_RAW, '/repo', undefined, true);
      expect(result.sampledReview).toBe(true);
   });
});
