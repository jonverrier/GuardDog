/**
 * @module core/markdownRenderer
 * Renders review results as GitHub-ready Markdown.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Renders GuardDog architecture review results into GitHub-ready Markdown. The module takes a structured review result and produces a single Markdown string with a consistent report layout: header metadata (repository, optional design file, generation time, and a sampled-review note), a summary section (overall risk, main themes, and finding counts), and a findings section.
// 
// renderMarkdownReview is the only export. It builds the report line by line, handles the empty-findings case with a short message, and ensures the final output ends with a trailing newline. Each finding is formatted with an H3 heading and subsections for evidence, facts, inferences, risk, blast radius, recommendation, and a possible fitness function.
// 
// The module relies on IFinding and IReviewResult from ../schemas/finding to define the expected shape of the input data. Internal helpers renderFinding formats a single finding, and capitalize normalizes enum-like strings for display.
// ===End StrongAI Generated Comment===


import { formatContextCoverageMarkdown } from './contextCoverageNotes';
import { IFinding, IReviewResult } from '../schemas/finding';

/**
 * Renders a full architecture review as Markdown.
 * @param result - Filtered review result
 */
export function renderMarkdownReview(result: IReviewResult): string {
   const lines: string[] = [];

   lines.push('# GuardDog Architecture Review');
   lines.push('');
   lines.push(`Repository: \`${result.repoPath}\``);
   if (result.designFile) {
      lines.push(`Design file: \`${result.designFile}\``);
   } else {
      lines.push('Design file: *(none — general evolutionary architecture review)*');
   }
   lines.push(`Generated: \`${result.generatedAt}\``);
   lines.push('');
   if (result.contextCoverage) {
      lines.push(...formatContextCoverageMarkdown(result.contextCoverage));
   } else if (result.sampledReview) {
      lines.push(
         '> **Note:** Some ranked source files were omitted from the review context due to token budgets.'
      );
      lines.push('');
   }
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
