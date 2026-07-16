/**
 * @module strongai/cloudAgentPayload
 * Parses structured GuardDog cloud-agent payloads from assistant text or artifacts.
 */
// Copyright (c) 2025 Jon Verrier

import {
   IStrongAiCloudReviewPayload,
   IStrongAiPlatformTarget
} from '../schemas/strongAiPlatforms';
import { InvalidParameterError } from '../utils/errors';

/**
 * Extracts and validates a cloud review payload from assistant final text.
 * Accepts a fenced ```json block or a raw JSON object in the text.
 * @param text - Final assistant text from the cloud run
 * @param expectedTarget - Package target this agent was asked to review
 */
export function parseCloudReviewPayload(
   text: string,
   expectedTarget: IStrongAiPlatformTarget
): IStrongAiCloudReviewPayload {
   const jsonText = extractJsonText(text);
   let parsed: unknown;
   try {
      parsed = JSON.parse(jsonText);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InvalidParameterError(
         `Cloud agent for ${expectedTarget.id} did not return valid JSON: ${message}`
      );
   }

   return normalizeCloudReviewPayload(parsed, expectedTarget);
}

/**
 * Normalizes an unknown object into a typed cloud review payload.
 * @param value - Parsed JSON value
 * @param expectedTarget - Expected package target
 */
export function normalizeCloudReviewPayload(
   value: unknown,
   expectedTarget: IStrongAiPlatformTarget
): IStrongAiCloudReviewPayload {
   if (!value || typeof value !== 'object') {
      throw new InvalidParameterError(
         `Cloud agent for ${expectedTarget.id} returned a non-object payload.`
      );
   }

   const obj = value as Record<string, unknown>;
   const packageId = asString(obj.packageId, 'packageId');
   if (packageId !== expectedTarget.id) {
      throw new InvalidParameterError(
         `Cloud agent packageId mismatch: expected ${expectedTarget.id}, got ${packageId}`
      );
   }

   const issueSlug = asString(obj.issueSlug, 'issueSlug');
   if (issueSlug !== expectedTarget.issueSlug) {
      throw new InvalidParameterError(
         `Cloud agent issueSlug mismatch: expected ${expectedTarget.issueSlug}, got ${issueSlug}`
      );
   }

   const issueTitle = asString(obj.issueTitle, 'issueTitle');
   const issueMarkdown = asString(obj.issueMarkdown, 'issueMarkdown');
   const reviewSummaryRaw = obj.reviewSummary;
   if (!reviewSummaryRaw || typeof reviewSummaryRaw !== 'object') {
      throw new InvalidParameterError('Cloud agent payload missing reviewSummary object.');
   }

   const summary = reviewSummaryRaw as Record<string, unknown>;
   const mainThemes = Array.isArray(summary.mainThemes)
      ? summary.mainThemes.filter((theme): theme is string => typeof theme === 'string')
      : [];

   return {
      packageId: expectedTarget.id,
      issueSlug,
      issueTitle,
      issueMarkdown,
      reviewSummary: {
         overallRisk: asString(summary.overallRisk, 'reviewSummary.overallRisk'),
         findingCount: asNumber(summary.findingCount, 'reviewSummary.findingCount'),
         highSeverityCount: asNumber(
            summary.highSeverityCount,
            'reviewSummary.highSeverityCount'
         ),
         criticalSeverityCount: asNumber(
            summary.criticalSeverityCount,
            'reviewSummary.criticalSeverityCount'
         ),
         mainThemes
      },
      reviewJson: obj.reviewJson,
      agentNotes: typeof obj.agentNotes === 'string' ? obj.agentNotes : undefined
   };
}

function extractJsonText(text: string): string {
   const trimmed = text.trim();
   if (!trimmed) {
      throw new InvalidParameterError('Cloud agent returned empty final text.');
   }

   const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
   if (fenced && fenced[1]) {
      return fenced[1].trim();
   }

   const firstBrace = trimmed.indexOf('{');
   const lastBrace = trimmed.lastIndexOf('}');
   if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
   }

   throw new InvalidParameterError('Cloud agent final text did not contain a JSON object.');
}

function asString(value: unknown, field: string): string {
   if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidParameterError(`Cloud agent payload field ${field} must be a non-empty string.`);
   }
   return value.trim();
}

function asNumber(value: unknown, field: string): number {
   if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new InvalidParameterError(`Cloud agent payload field ${field} must be a number.`);
   }
   return value;
}
