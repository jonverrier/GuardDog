/**
 * @module core/c4DocsPacker
 * Budget-aware assembly of C4 architecture markdown for LLM prompts.
 */
// Copyright (c) 2025 Jon Verrier

import { IContextManifestEntry } from '../schemas/contextManifest';
import { packFilesToTokenBudget } from './tokenBudgetPacker';
import { ITokenEncoder } from '../utils/tokenCounter';

const C4_SECTION_SEPARATOR = '\n\n';

export interface IPackC4DocsForPromptOptions {
   rootPath: string;
   orderedPaths: string[];
   tokenBudget: number;
   maxFileTokens: number;
   encoder: ITokenEncoder;
   readFile: (rootPath: string, relativePath: string) => Promise<string | undefined>;
   startRank?: number;
}

export interface IPackC4DocsForPromptResult {
   docsSection: string;
   tokensUsed: number;
   manifest: IContextManifestEntry[];
   truncated: boolean;
}

/**
 * Packs C4 docs in depth order into a token budget and formats them for prompt injection.
 * @param options - Root path, ordered C4 paths, budgets, and encoder
 */
export async function packC4DocsForPrompt(
   options: IPackC4DocsForPromptOptions
): Promise<IPackC4DocsForPromptResult> {
   const pack = await packFilesToTokenBudget({
      rootPath: options.rootPath,
      orderedPaths: options.orderedPaths,
      tokenBudget: options.tokenBudget,
      maxFileTokens: options.maxFileTokens,
      encoder: options.encoder,
      readFile: options.readFile,
      startRank: options.startRank
   });

   const parts: string[] = [];
   for (const file of pack.files) {
      parts.push(`### ${file.relativePath}`);
      parts.push(file.content);
   }

   const truncated = pack.manifest.some(
      (m) => !m.included && (m.reason === 'budget_exhausted' || m.reason === 'file_too_large')
   );

   return {
      docsSection: parts.join(C4_SECTION_SEPARATOR),
      tokensUsed: pack.tokensUsed,
      manifest: pack.manifest,
      truncated
   };
}
