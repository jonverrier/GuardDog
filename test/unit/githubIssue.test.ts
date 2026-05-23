/**
 * @module test/unit/githubIssue.test
 * Tests for GitHub issue dry-run rendering.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { renderSingleIssue, renderPerFindingIssues } from '../../src/github/issueRenderer';
import { createGitHubIssues } from '../../src/github/githubClient';
import { IReviewResult } from '../../src/schemas/finding';

const SAMPLE_RESULT: IReviewResult = {
   tool: 'SeamGuard',
   repoPath: '/repo',
   generatedAt: '2025-05-23T12:00:00.000Z',
   summary: {
      overallRisk: 'medium',
      findingCount: 2,
      highSeverityCount: 1,
      criticalSeverityCount: 0,
      mainThemes: ['Coupling']
   },
   findings: [
      {
         id: 'SG-001',
         title: 'Finding one',
         severity: 'high',
         impact: 'high',
         confidence: 'high',
         principle: 'Coupling',
         evidence: [],
         facts: [],
         inferences: [],
         risk: 'Risk one',
         blastRadius: { rating: 'high', reasoning: 'Wide' },
         recommendation: 'Fix one',
         possibleFitnessFunction: 'Rule one',
         suggestedLabels: ['coupling']
      },
      {
         id: 'SG-002',
         title: 'Finding two',
         severity: 'medium',
         impact: 'medium',
         confidence: 'medium',
         principle: 'Observability',
         evidence: [],
         facts: [],
         inferences: [],
         risk: 'Risk two',
         blastRadius: { rating: 'medium', reasoning: 'Local' },
         recommendation: 'Fix two',
         possibleFitnessFunction: 'Rule two',
         suggestedLabels: ['observability']
      }
   ]
};

describe('github issue rendering', () => {
   it('renders a single combined issue draft', () => {
      const draft = renderSingleIssue(SAMPLE_RESULT);
      expect(draft.title).toBe('SeamGuard architecture review findings');
      expect(draft.labels).toContain('seamguard');
      expect(draft.body).toContain('SG-001');
      expect(draft.body).toContain('SG-002');
   });

   it('renders per-finding issue drafts', () => {
      const drafts = renderPerFindingIssues(SAMPLE_RESULT);
      expect(drafts).toHaveLength(2);
      expect(drafts[0].title).toContain('SG-001');
      expect(drafts[1].title).toContain('SG-002');
   });

   it('dry-run prints issue content without creating issues', async () => {
      const logs: string[] = [];
      const logger = {
         info: (msg: string) => logs.push(msg),
         warn: () => undefined,
         error: () => undefined,
         debug: () => undefined
      };

      const results = await createGitHubIssues(
         'owner/repo',
         [renderSingleIssue(SAMPLE_RESULT)],
         false,
         logger
      );

      expect(results).toHaveLength(0);
      expect(logs.some((l) => l.includes('dry-run'))).toBe(true);
      expect(logs.some((l) => l.includes('SeamGuard architecture review findings'))).toBe(true);
   });
});
