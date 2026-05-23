/**
 * @module core/findingParser
 * Parses and validates LLM review output.
 */
// Copyright (c) 2025 Jon Verrier

import {
   DEFAULT_REVIEW_RESULT,
   FindingConfidence,
   FindingImpact,
   FindingSeverity,
   IFinding,
   IEvidenceItem,
   IReviewResult
} from '../schemas/finding';
import { InvalidOperationError } from '../utils/errors';
import { writeTextFile } from '../utils/fileSystem';

const VALID_SEVERITIES = new Set<string>(['low', 'medium', 'high', 'critical']);
const VALID_CONFIDENCE = new Set<string>(['low', 'medium', 'high']);

/**
 * Validates and normalizes a review result from the LLM.
 * @param raw - Parsed JSON object from LLM
 * @param repoPath - Repository path for metadata
 * @param designFile - Optional design file path
 * @param sampledReview - Whether context was sampled
 */
export function validateReviewResult(
   raw: unknown,
   repoPath: string,
   designFile: string | undefined,
   sampledReview: boolean
): IReviewResult {
   if (!raw || typeof raw !== 'object') {
      throw new InvalidOperationError('LLM response is not a valid JSON object.');
   }

   const obj = raw as Record<string, unknown>;
   const findingsRaw = obj.findings;
   if (!Array.isArray(findingsRaw)) {
      throw new InvalidOperationError('LLM response missing findings array.');
   }

   const findings = findingsRaw.map((item, index) => validateFinding(item, index));
   const summaryRaw = obj.summary;
   if (!summaryRaw || typeof summaryRaw !== 'object') {
      throw new InvalidOperationError('LLM response missing summary object.');
   }

   const summaryObj = summaryRaw as Record<string, unknown>;
   const overallRisk = validateSeverity(summaryObj.overallRisk, 'summary.overallRisk');
   const mainThemes = Array.isArray(summaryObj.mainThemes)
      ? summaryObj.mainThemes.filter((t): t is string => typeof t === 'string')
      : [];

   const highSeverityCount = findings.filter((f) => f.severity === 'high').length;
   const criticalSeverityCount = findings.filter((f) => f.severity === 'critical').length;

   return {
      tool: 'SeamGuard',
      repoPath,
      designFile,
      generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
      sampledReview: sampledReview || obj.sampledReview === true,
      summary: {
         overallRisk,
         findingCount: findings.length,
         highSeverityCount,
         criticalSeverityCount,
         mainThemes
      },
      findings
   };
}

function validateFinding(raw: unknown, index: number): IFinding {
   if (!raw || typeof raw !== 'object') {
      throw new InvalidOperationError(`Finding at index ${index} is not an object.`);
   }
   const obj = raw as Record<string, unknown>;

   const requiredStrings = [
      'id',
      'title',
      'principle',
      'risk',
      'recommendation',
      'possibleFitnessFunction'
   ] as const;
   for (const field of requiredStrings) {
      if (typeof obj[field] !== 'string' || (obj[field] as string).trim().length === 0) {
         throw new InvalidOperationError(`Finding ${index}: missing or invalid ${field}.`);
      }
   }

   const severity = validateSeverity(obj.severity, `findings[${index}].severity`);
   const impact = validateImpact(obj.impact, `findings[${index}].impact`);
   const confidence = validateConfidence(obj.confidence, `findings[${index}].confidence`);

   const blastRadiusRaw = obj.blastRadius;
   if (!blastRadiusRaw || typeof blastRadiusRaw !== 'object') {
      throw new InvalidOperationError(`Finding ${index}: missing blastRadius.`);
   }
   const blastObj = blastRadiusRaw as Record<string, unknown>;

   return {
      id: obj.id as string,
      title: obj.title as string,
      severity,
      impact,
      confidence,
      principle: obj.principle as string,
      evidence: validateEvidenceArray(obj.evidence, index),
      facts: validateStringArray(obj.facts, `findings[${index}].facts`),
      inferences: validateStringArray(obj.inferences, `findings[${index}].inferences`),
      risk: obj.risk as string,
      blastRadius: {
         rating: validateImpact(blastObj.rating, `findings[${index}].blastRadius.rating`),
         reasoning: typeof blastObj.reasoning === 'string' ? blastObj.reasoning : ''
      },
      recommendation: obj.recommendation as string,
      possibleFitnessFunction: obj.possibleFitnessFunction as string,
      suggestedLabels: validateStringArray(obj.suggestedLabels, `findings[${index}].suggestedLabels`)
   };
}

function validateEvidenceArray(raw: unknown, findingIndex: number): IEvidenceItem[] {
   if (!Array.isArray(raw)) {
      throw new InvalidOperationError(`Finding ${findingIndex}: evidence must be an array.`);
   }
   return raw.map((item, i) => {
      if (!item || typeof item !== 'object') {
         throw new InvalidOperationError(`Finding ${findingIndex}: evidence[${i}] invalid.`);
      }
      const obj = item as Record<string, unknown>;
      if (typeof obj.observation !== 'string') {
         throw new InvalidOperationError(`Finding ${findingIndex}: evidence[${i}].observation required.`);
      }
      return {
         file: typeof obj.file === 'string' ? obj.file : undefined,
         directory: typeof obj.directory === 'string' ? obj.directory : undefined,
         observation: obj.observation
      };
   });
}

function validateStringArray(raw: unknown, fieldName: string): string[] {
   if (!Array.isArray(raw)) {
      throw new InvalidOperationError(`${fieldName} must be an array.`);
   }
   return raw.filter((item): item is string => typeof item === 'string');
}

function validateSeverity(value: unknown, fieldName: string): FindingSeverity {
   if (typeof value !== 'string' || !VALID_SEVERITIES.has(value)) {
      throw new InvalidOperationError(`Invalid severity in ${fieldName}: ${String(value)}`);
   }
   return value as FindingSeverity;
}

function validateImpact(value: unknown, fieldName: string): FindingImpact {
   return validateSeverity(value, fieldName) as FindingImpact;
}

function validateConfidence(value: unknown, fieldName: string): FindingConfidence {
   if (typeof value !== 'string' || !VALID_CONFIDENCE.has(value)) {
      throw new InvalidOperationError(`Invalid confidence in ${fieldName}: ${String(value)}`);
   }
   return value as FindingConfidence;
}

/**
 * Detects whether a review result appears to be the empty default fallback.
 * @param result - Parsed review result
 */
export function isEmptyDefaultResult(result: IReviewResult): boolean {
   return (
      result.findings.length === 0 &&
      result.generatedAt === DEFAULT_REVIEW_RESULT.generatedAt
   );
}

/**
 * Saves raw LLM response for debugging when parsing fails.
 * @param repoPath - Repository root
 * @param rawContent - Raw response text
 */
export async function saveDebugResponse(repoPath: string, rawContent: string): Promise<string> {
   const debugPath = `${repoPath}/.seamguard/seamguard-debug-${Date.now()}.json`;
   await writeTextFile(debugPath, rawContent);
   return debugPath;
}
