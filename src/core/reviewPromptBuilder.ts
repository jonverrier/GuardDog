/**
 * @module core/reviewPromptBuilder
 * Builds prompt template parameters from repository scan data.
 * Prompt wording lives in Prompts.json — this module only assembles runtime values.
 */
// Copyright (c) 2025 Jon Verrier

import { IContextFile } from './contextSelector';
import {
   buildContextCoverageSummary,
   formatContextCoveragePromptNote
} from './contextCoverageNotes';
import { IContextSelectionMeta } from '../schemas/contextManifest';

const NO_DESIGN_PLACEHOLDER =
   '*No architecture intent file was provided. Report general evolutionary architecture findings only.*';

export interface IReviewPromptParams {
   architectureIntent: string;
   repoMap: string;
   contextFilesSection: string;
   /** @deprecated Use contextCoverageNote — kept for Prompts.json placeholder name */
   sampledReviewNote: string;
   contextCoverageNote: string;
}

/**
 * Builds parameter values for the ArchitectureReview user prompt template.
 * @param repoMapJson - Serialized repository map
 * @param designContent - Architecture intent content, if available
 * @param contextFiles - Selected file contents
 * @param contextSelection - Context selection metadata from the pipeline
 */
export function buildReviewPromptParams(
   repoMapJson: string,
   designContent: string | undefined,
   contextFiles: IContextFile[],
   contextSelection: IContextSelectionMeta
): IReviewPromptParams {
   const coverageNote = formatContextCoveragePromptNote(
      buildContextCoverageSummary(contextSelection)
   );

   return {
      architectureIntent: designContent ?? NO_DESIGN_PLACEHOLDER,
      repoMap: repoMapJson,
      contextFilesSection: buildContextFilesSection(contextFiles),
      sampledReviewNote: coverageNote,
      contextCoverageNote: coverageNote
   };
}

function buildContextFilesSection(contextFiles: IContextFile[]): string {
   if (contextFiles.length === 0) {
      return '*No context files were selected.*';
   }

   const sections: string[] = [];
   for (const file of contextFiles) {
      sections.push(`### File: ${file.relativePath}`);
      sections.push('<file-content>');
      sections.push(file.content);
      sections.push('</file-content>');
      sections.push('');
   }
   return sections.join('\n');
}
