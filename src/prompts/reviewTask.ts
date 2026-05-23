/**
 * @module prompts/reviewTask
 * Review task instructions and output schema description for the LLM.
 */
// Copyright (c) 2025 Jon Verrier

export const REVIEW_TASK_INSTRUCTIONS = `Perform an evolutionary architecture review of the repository described below.

Distinguish between:
1. Findings that violate or drift from the declared architectural intent (when a design file is provided)
2. General evolutionary architecture findings (coupling, boundaries, deployability, observability, etc.)

Return JSON matching the required schema with tool set to "SeamGuard".

Requirements:
- Assign each finding a unique id (e.g. SG-001, SG-002)
- Include concrete evidence with file or directory references where possible
- Separate facts (directly observed) from inferences (reasoned conclusions)
- Rate severity, impact, confidence, and blast radius honestly
- Propose incremental remediation — avoid rewrite recommendations unless unavoidable
- Suggest executable fitness functions (CI rules, contract tests, lint rules, metrics)
- Include suggestedLabels for GitHub issues (e.g. architecture, coupling, observability)

In summary.mainThemes, list 3-5 cross-cutting themes.
In summary.overallRisk, reflect the highest meaningful systemic risk after review.

If architecture intent is absent, focus on general evolutionary architecture risks and note that findings are not measured against declared intent.`;

/**
 * Builds the user prompt sections for context files.
 * @param repoMapJson - Serialized repository map
 * @param designContent - Architecture intent content or placeholder
 * @param contextFiles - Selected file contents
 * @param sampledReview - Whether context was sampled
 */
export function buildReviewUserPrompt(
   repoMapJson: string,
   designContent: string | undefined,
   contextFiles: Array<{ relativePath: string; content: string }>,
   sampledReview: boolean
): string {
   const sections: string[] = [];

   sections.push('## Architecture Intent');
   sections.push('');
   if (designContent) {
      sections.push('<architecture-intent>');
      sections.push(designContent);
      sections.push('</architecture-intent>');
   } else {
      sections.push(
         '*No architecture intent file was provided. Report general evolutionary architecture findings only.*'
      );
   }

   sections.push('');
   sections.push('## Repository Map');
   sections.push('');
   sections.push('<repo-map>');
   sections.push(repoMapJson);
   sections.push('</repo-map>');

   sections.push('');
   sections.push('## Selected Context Files');
   sections.push('');
   if (sampledReview) {
      sections.push(
         '*Note: This is a sampled review — not all files in the repository were included.*'
      );
      sections.push('');
   }

   for (const file of contextFiles) {
      sections.push(`### File: ${file.relativePath}`);
      sections.push('<file-content>');
      sections.push(file.content);
      sections.push('</file-content>');
      sections.push('');
   }

   sections.push('## Review Task');
   sections.push('');
   sections.push(REVIEW_TASK_INSTRUCTIONS);

   return sections.join('\n');
}
