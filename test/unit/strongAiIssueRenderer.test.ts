/**
 * @module test/unit/strongAiIssueRenderer.test
 * Tests for StrongAI issue markdown rendering and validation.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { IReviewResult } from '../../src/schemas/finding';
import { STRONGAI_PLATFORM_TARGETS } from '../../src/schemas/strongAiPlatforms';
import { renderStrongAiIssue } from '../../src/strongai/strongAiIssueRenderer';
import {
   assertValidStrongAiIssueMarkdown,
   validateStrongAiIssueMarkdown
} from '../../src/strongai/strongAiIssueValidator';
import { InvalidParameterError } from '../../src/utils/errors';

const SAMPLE_RESULT: IReviewResult = {
   tool: 'GuardDog',
   repoPath: 'packages/platform',
   designFile: 'DESIGN.md',
   generatedAt: '2026-07-16T12:00:00.000Z',
   sampledReview: true,
   summary: {
      overallRisk: 'medium',
      findingCount: 1,
      highSeverityCount: 0,
      criticalSeverityCount: 0,
      mainThemes: ['Boundary drift']
   },
   findings: [
      {
         id: 'GD-001',
         title: 'API contract leakage',
         severity: 'medium',
         impact: 'medium',
         confidence: 'high',
         principle: 'Encapsulation',
         evidence: [{ file: 'src/index.ts', observation: 'Exports internal helper' }],
         facts: ['Public index re-exports internal module'],
         inferences: ['Consumers may couple to internals'],
         risk: 'Harder package evolution',
         blastRadius: { rating: 'medium', reasoning: 'All platform consumers' },
         recommendation: 'Keep internals out of public export surface',
         possibleFitnessFunction: 'eslint no-restricted-exports on internal paths',
         suggestedLabels: ['architecture']
      }
   ]
};

describe('strongAiIssueRenderer', () => {
   it('renders a StrongAI inbox issue with required headers and stable filename', () => {
      const target = STRONGAI_PLATFORM_TARGETS[0];
      const rendered = renderStrongAiIssue(target, SAMPLE_RESULT);

      expect(rendered.fileName).toBe('guarddog-platform-architecture-review.md');
      expect(rendered.title).toContain('platform');
      expect(rendered.markdown).toContain('**Status:** open');
      expect(rendered.markdown).toContain('**Type:** proposal');
      expect(rendered.markdown).toContain('**GitHub:**');
      expect(rendered.markdown).toContain('**Superseded by:**');
      expect(rendered.markdown).toContain('# GuardDog architecture review: platform');
      expect(rendered.markdown).toContain('GD-001');
      expect(rendered.markdown).toContain('packages/platform');
      expect(rendered.markdown).toContain('sampled');

      const validation = validateStrongAiIssueMarkdown(rendered.markdown);
      expect(validation.valid).toBe(true);
      expect(() => assertValidStrongAiIssueMarkdown(rendered.markdown)).not.toThrow();
   });

   it('rejects markdown missing StrongAI headers', () => {
      const validation = validateStrongAiIssueMarkdown('# Title only\n\nBody\n');
      expect(validation.valid).toBe(false);
      expect(validation.missingHeaders).toEqual(
         expect.arrayContaining(['Status', 'Type', 'GitHub', 'Superseded by'])
      );
      expect(() => assertValidStrongAiIssueMarkdown('# Title only\n')).toThrow(InvalidParameterError);
   });
});
