/**
 * @module test/unit/markdownRenderer.test
 * Tests for Markdown output rendering.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { renderMarkdownReview } from '../../src/core/markdownRenderer';
import { IReviewResult } from '../../src/schemas/finding';

const SAMPLE_RESULT: IReviewResult = {
   tool: 'GuardDog',
   repoPath: '/tmp/sample-repo',
   designFile: 'DESIGN.md',
   generatedAt: '2025-05-23T12:00:00.000Z',
   summary: {
      overallRisk: 'high',
      findingCount: 1,
      highSeverityCount: 1,
      criticalSeverityCount: 0,
      mainThemes: ['Boundary drift', 'Missing fitness functions']
   },
   findings: [
      {
         id: 'GD-001',
         title: 'Persistence imported into API layer',
         severity: 'high',
         impact: 'high',
         confidence: 'medium',
         principle: 'Reduce coupling / preserve optionality',
         evidence: [{ file: 'src/api/users.ts', observation: 'Direct database import' }],
         facts: ['API module imports persistence layer'],
         inferences: ['Boundary between API and persistence is weak'],
         risk: 'Changes to persistence ripple into API handlers.',
         blastRadius: { rating: 'high', reasoning: 'Shared data access path' },
         recommendation: 'Introduce a domain service boundary.',
         possibleFitnessFunction: 'ESLint import boundary rule',
         suggestedLabels: ['architecture', 'coupling']
      }
   ]
};

describe('markdownRenderer', () => {
   it('renders GitHub-ready markdown with summary and findings', () => {
      const markdown = renderMarkdownReview(SAMPLE_RESULT);
      expect(markdown).toContain('# GuardDog Architecture Review');
      expect(markdown).toContain('Overall risk: High');
      expect(markdown).toContain('Boundary drift');
      expect(markdown).toContain('### GD-001 — Persistence imported into API layer');
      expect(markdown).toContain('`src/api/users.ts`');
      expect(markdown).toContain('#### Possible Fitness Function');
   });

   it('renders context coverage section when provided', () => {
      const markdown = renderMarkdownReview({
         ...SAMPLE_RESULT,
         contextCoverage: {
            rankingMode: 'c4-llm',
            c4DocsDiscovered: 10,
            c4DocsInReview: 4,
            rankedSourcePaths: 20,
            sourcePathsInReview: 18,
            discardedTotal: 2,
            discardedByLayer: { design: 0, c4: 2, source: 0 },
            layerTruncation: { design: false, c4: true, source: false },
            sampledSourceReview: false
         }
      });
      expect(markdown).toContain('## Context coverage');
      expect(markdown).toContain('C4-guided');
      expect(markdown).not.toContain('sampled review');
   });
});
