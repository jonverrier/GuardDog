/**
 * @module github/issueRenderer
 * Renders GitHub issue bodies from review results.
 */
// Copyright (c) 2025 Jon Verrier

import { DEFAULT_ISSUE_TITLE } from '../schemas/config';
import { IFinding, IReviewResult } from '../schemas/finding';
import { renderMarkdownReview } from '../core/markdownRenderer';

export interface IIssueDraft {
   title: string;
   body: string;
   labels: string[];
}

/**
 * Renders a single issue containing all findings.
 * @param result - Filtered review result
 */
export function renderSingleIssue(result: IReviewResult): IIssueDraft {
   return {
      title: DEFAULT_ISSUE_TITLE,
      body: renderMarkdownReview(result),
      labels: ['architecture', 'guarddog', 'technical-debt']
   };
}

/**
 * Renders one issue per finding.
 * @param result - Filtered review result
 */
export function renderPerFindingIssues(result: IReviewResult): IIssueDraft[] {
   return result.findings.map((finding) => ({
      title: `[GuardDog] ${finding.id}: ${finding.title}`,
      body: renderFindingIssueBody(finding, result),
      labels: uniqueLabels(['architecture', 'guarddog', ...finding.suggestedLabels])
   }));
}

function renderFindingIssueBody(finding: IFinding, result: IReviewResult): string {
   const lines: string[] = [];
   lines.push(`**Repository:** \`${result.repoPath}\``);
   if (result.designFile) {
      lines.push(`**Design file:** \`${result.designFile}\``);
   }
   lines.push('');
   lines.push(`**Severity:** ${finding.severity}`);
   lines.push(`**Impact:** ${finding.impact}`);
   lines.push(`**Confidence:** ${finding.confidence}`);
   lines.push('');
   lines.push('## Risk');
   lines.push(finding.risk);
   lines.push('');
   lines.push('## Recommendation');
   lines.push(finding.recommendation);
   lines.push('');
   lines.push('## Possible Fitness Function');
   lines.push(finding.possibleFitnessFunction);
   return lines.join('\n');
}

function uniqueLabels(labels: string[]): string[] {
   return [...new Set(labels.map((l) => l.toLowerCase()))];
}
