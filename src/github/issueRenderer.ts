/**
 * @module github/issueRenderer
 * Renders GitHub issue bodies from review results.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module turns GuardDog review results into GitHub issue drafts. It produces ready-to-submit issue data with a title, a Markdown body, and a set of labels.
// 
// IIssueDraft defines the shape of an issue draft object with title, body, and labels fields.
// 
// renderSingleIssue creates one consolidated issue for an entire filtered review result. It uses DEFAULT_ISSUE_TITLE for the issue title, renders the full result with renderMarkdownReview, and applies a fixed set of labels.
// 
// renderPerFindingIssues creates multiple issues, one per finding in the result. Each issue title includes the finding id and title, the body is built from repository context plus the finding’s severity, impact, confidence, risk, recommendation, and possible fitness function, and labels combine standard tags with any finding-suggested labels. Labels are normalized to lowercase and deduplicated.
// 
// Key dependencies include DEFAULT_ISSUE_TITLE from the config schema, IFinding and IReviewResult types from the finding schema, and renderMarkdownReview for generating the consolidated Markdown content.
// ===End StrongAI Generated Comment===


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
