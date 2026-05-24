/**
 * @module test/unit/findingParser.test
 * Tests for LLM response schema validation.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { isEmptyDefaultResult, validateReviewResult } from '../../src/core/findingParser';
import { DEFAULT_REVIEW_RESULT } from '../../src/schemas/finding';
import { InvalidOperationError } from '../../src/utils/errors';

const VALID_RAW = {
   tool: 'GuardDog',
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
         id: 'GD-001',
         title: 'Weak boundary',
         severity: 'high',
         impact: 'high',
         confidence: 'medium',
         principle: 'Preserve optionality',
         evidence: [{ file: 'src/a.ts', directory: '', observation: 'Cross-layer import' }],
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
      expect(result.tool).toBe('GuardDog');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('GD-001');
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

   it('marks sampled review from pipeline flag only', () => {
      const result = validateReviewResult(
         { ...VALID_RAW, sampledReview: true },
         '/repo',
         undefined,
         false
      );
      expect(result.sampledReview).toBe(false);
   });

   it('normalizes missing design file to empty string', () => {
      const result = validateReviewResult(VALID_RAW, '/repo', undefined, false);
      expect(result.designFile).toBe('');
   });

   it('preserves design file path when provided', () => {
      const result = validateReviewResult(VALID_RAW, '/repo', 'DESIGN.md', false);
      expect(result.designFile).toBe('DESIGN.md');
   });

   it('detects empty fallback via sentinel generatedAt', () => {
      expect(
         isEmptyDefaultResult({
            ...DEFAULT_REVIEW_RESULT,
            generatedAt: DEFAULT_REVIEW_RESULT.generatedAt
         })
      ).toBe(true);
   });

   it('detects empty fallback when repoPath is empty with zero findings', () => {
      expect(
         isEmptyDefaultResult({
            ...DEFAULT_REVIEW_RESULT,
            generatedAt: '2026-05-24T12:00:00.000Z'
         })
      ).toBe(true);
   });

   it('allows legitimate zero-finding result with real repo metadata', () => {
      expect(
         isEmptyDefaultResult({
            ...DEFAULT_REVIEW_RESULT,
            repoPath: '/real/repo',
            designFile: '',
            generatedAt: '2026-05-24T12:00:00.000Z'
         })
      ).toBe(false);
   });

   it('rejects evidence items missing required file or directory keys', () => {
      const invalid = {
         ...VALID_RAW,
         findings: [
            {
               ...VALID_RAW.findings[0],
               evidence: [{ observation: 'Missing location keys' }]
            }
         ]
      };
      expect(() => validateReviewResult(invalid, '/repo', undefined, false)).toThrow(
         InvalidOperationError
      );
   });
});
