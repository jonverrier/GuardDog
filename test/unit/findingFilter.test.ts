/**
 * @module test/unit/findingFilter.test
 * Tests for severity and impact filtering.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { filterFindings, meetsMinimum, applyFindingFilters } from '../../src/core/findingFilter';
import { IFinding, IReviewResult } from '../../src/schemas/finding';

function makeFinding(overrides: Partial<IFinding>): IFinding {
   return {
      id: 'GD-001',
      title: 'Test finding',
      severity: 'medium',
      impact: 'medium',
      confidence: 'high',
      principle: 'Reduce coupling',
      evidence: [{ observation: 'test' }],
      facts: ['fact'],
      inferences: ['inference'],
      risk: 'risk',
      blastRadius: { rating: 'medium', reasoning: 'reason' },
      recommendation: 'fix',
      possibleFitnessFunction: 'lint rule',
      suggestedLabels: ['architecture'],
      ...overrides
   };
}

describe('findingFilter', () => {
   it('ranks severity levels correctly', () => {
      expect(meetsMinimum('high', 'medium')).toBe(true);
      expect(meetsMinimum('low', 'medium')).toBe(false);
      expect(meetsMinimum('critical', 'high')).toBe(true);
   });

   it('filters by both severity and impact', () => {
      const findings = [
         makeFinding({ id: 'GD-001', severity: 'low', impact: 'low' }),
         makeFinding({ id: 'GD-002', severity: 'high', impact: 'low' }),
         makeFinding({ id: 'GD-003', severity: 'high', impact: 'high' }),
         makeFinding({ id: 'GD-004', severity: 'medium', impact: 'high' })
      ];

      const filtered = filterFindings(findings, 'high', 'high');
      expect(filtered.map((f) => f.id)).toEqual(['GD-003']);
   });

   it('applies max findings limit', () => {
      const result: IReviewResult = {
         tool: 'GuardDog',
         repoPath: '/repo',
         generatedAt: new Date().toISOString(),
         summary: {
            overallRisk: 'high',
            findingCount: 3,
            highSeverityCount: 2,
            criticalSeverityCount: 0,
            mainThemes: []
         },
         findings: [
            makeFinding({ id: 'GD-001', severity: 'high', impact: 'high' }),
            makeFinding({ id: 'GD-002', severity: 'high', impact: 'high' }),
            makeFinding({ id: 'GD-003', severity: 'high', impact: 'high' })
         ]
      };

      const filtered = applyFindingFilters(result, 'medium', 'medium', 2);
      expect(filtered.findings).toHaveLength(2);
      expect(filtered.summary.findingCount).toBe(2);
   });
});
