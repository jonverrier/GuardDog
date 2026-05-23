/**
 * @module core/markdownRenderer
 * Renders review results as GitHub-ready Markdown.
 */
// Copyright (c) 2025 Jon Verrier

import { IFinding, IReviewResult } from '../schemas/finding';

/**
 * Renders a full architecture review as Markdown.
 * @param result - Filtered review result
 */
export function renderMarkdownReview(result: IReviewResult): string {
   const lines: string[] = [];

   lines.push('# SeamGuard Architecture Review');
   lines.push('');
   lines.push(`Repository: \`${result.repoPath}\``);
   if (result.designFile) {
      lines.push(`Design file: \`${result.designFile}\``);
   } else {
      lines.push('Design file: *(none — general evolutionary architecture review)*');
   }
   lines.push(`Generated: \`${result.generatedAt}\``);
   if (result.sampledReview) {
      lines.push('');
      lines.push(
         '> **Note:** This is a sampled review — not all repository files were included in the analysis context.'
      );
   }
   lines.push('');
   lines.push('## Summary');
   lines.push('');
   lines.push(`Overall risk: ${capitalize(result.summary.overallRisk)}`);
   lines.push('');
   if (result.summary.mainThemes.length > 0) {
      lines.push('Main themes:');
      for (const theme of result.summary.mainThemes) {
         lines.push(`- ${theme}`);
      }
      lines.push('');
   }
   lines.push(
      `Findings: ${result.summary.findingCount} (high: ${result.summary.highSeverityCount}, critical: ${result.summary.criticalSeverityCount})`
   );
   lines.push('');
   lines.push('## Findings');
   lines.push('');

   if (result.findings.length === 0) {
      lines.push('*No findings matched the configured severity and impact filters.*');
      return lines.join('\n');
   }

   for (const finding of result.findings) {
      lines.push(...renderFinding(finding));
      lines.push('');
   }

   return lines.join('\n').trimEnd() + '\n';
}

function renderFinding(finding: IFinding): string[] {
   const lines: string[] = [];
   lines.push(`### ${finding.id} — ${finding.title}`);
   lines.push('');
   lines.push(`Severity: ${capitalize(finding.severity)}  `);
   lines.push(`Impact: ${capitalize(finding.impact)}  `);
   lines.push(`Confidence: ${capitalize(finding.confidence)}  `);
   lines.push(`Principle: ${finding.principle}`);
   lines.push('');
   lines.push('#### Evidence');
   lines.push('');
   if (finding.evidence.length === 0) {
      lines.push('- *(no evidence items)*');
   } else {
      for (const item of finding.evidence) {
         const location = item.file
            ? `\`${item.file}\``
            : item.directory
              ? `\`${item.directory}/\``
              : '*(location unspecified)*';
         lines.push(`- ${location}: ${item.observation}`);
      }
   }
   lines.push('');
   lines.push('#### Facts');
   lines.push('');
   for (const fact of finding.facts) {
      lines.push(`- ${fact}`);
   }
   lines.push('');
   lines.push('#### Inferences');
   lines.push('');
   for (const inference of finding.inferences) {
      lines.push(`- ${inference}`);
   }
   lines.push('');
   lines.push('#### Risk');
   lines.push('');
   lines.push(finding.risk);
   lines.push('');
   lines.push('#### Blast Radius');
   lines.push('');
   lines.push(`${capitalize(finding.blastRadius.rating)} — ${finding.blastRadius.reasoning}`);
   lines.push('');
   lines.push('#### Recommendation');
   lines.push('');
   lines.push(finding.recommendation);
   lines.push('');
   lines.push('#### Possible Fitness Function');
   lines.push('');
   lines.push(finding.possibleFitnessFunction);
   return lines;
}

function capitalize(value: string): string {
   if (!value) {
      return value;
   }
   return value.charAt(0).toUpperCase() + value.slice(1);
}
