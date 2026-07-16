/**
 * @module strongai/strongAiIssueValidator
 * Validates StrongAI issue markdown headers and required sections.
 */
// Copyright (c) 2025 Jon Verrier

import { InvalidParameterError } from '../utils/errors';

const REQUIRED_HEADER_KEYS = ['Status', 'Type', 'GitHub', 'Superseded by'] as const;

export interface IStrongAiIssueValidationResult {
   valid: boolean;
   missingHeaders: string[];
   hasTitle: boolean;
   errors: string[];
}

/**
 * Validates that markdown matches the StrongAI issues/ header contract.
 * @param markdown - Issue markdown body
 */
export function validateStrongAiIssueMarkdown(markdown: string): IStrongAiIssueValidationResult {
   const missingHeaders: string[] = [];
   for (const key of REQUIRED_HEADER_KEYS) {
      const pattern = new RegExp(`^\\*\\*${escapeRegExp(key)}:\\*\\*\\s*.+$`, 'm');
      if (!pattern.test(markdown)) {
         missingHeaders.push(key);
      }
   }

   const hasTitle = /^# .+/m.test(markdown);
   const errors: string[] = [];
   if (missingHeaders.length > 0) {
      errors.push(`Missing required header(s): ${missingHeaders.join(', ')}`);
   }
   if (!hasTitle) {
      errors.push('Missing markdown H1 title (# ...)');
   }

   return {
      valid: errors.length === 0,
      missingHeaders,
      hasTitle,
      errors
   };
}

/**
 * Throws when markdown is not a valid StrongAI issue draft.
 * @param markdown - Issue markdown body
 * @param context - Optional context for the error message
 */
export function assertValidStrongAiIssueMarkdown(markdown: string, context?: string): void {
   const result = validateStrongAiIssueMarkdown(markdown);
   if (!result.valid) {
      const prefix = context ? `${context}: ` : '';
      throw new InvalidParameterError(`${prefix}${result.errors.join('; ')}`);
   }
}

function escapeRegExp(value: string): string {
   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
