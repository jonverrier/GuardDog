/**
 * @module core/findingParser
 * Parses and validates LLM review output.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Parses, validates, and normalizes structured review output produced by an LLM into a consistent GuardDog review result. The main entry point is validateReviewResult, which checks that the input is a JSON object with a findings array and summary object, validates required fields, enforces allowed severity/impact/confidence values, and computes summary counts for high and critical findings. It also fills in metadata such as repoPath, optional designFile, generatedAt, and sampledReview. isEmptyDefaultResult detects when a result looks like the predefined empty fallback by comparing against DEFAULT_REVIEW_RESULT and requiring zero findings. saveDebugResponse persists the raw LLM response to a timestamped JSON file under .guarddog for troubleshooting failed parses, and returns the path. The module relies on schema types and defaults from ../schemas/finding, raises InvalidOperationError from ../utils/errors for all validation failures, and uses writeTextFile from ../utils/fileSystem to save debug output.
// ===End StrongAI Generated Comment===


import {
   DEFAULT_REVIEW_RESULT,
   FindingConfidence,
   FindingImpact,
   FindingSeverity,
   IFinding,
   IEvidenceItem,
   IReviewResult,
   isLlmEvidenceItem,
   normalizeDesignFileForStorage
} from '../schemas/finding';
import { IContextCoverageSummary } from '../schemas/contextManifest';
import { InvalidOperationError } from '../utils/errors';
import { writeTextFile } from '../utils/fileSystem';

const VALID_SEVERITIES = new Set<string>(['low', 'medium', 'high', 'critical']);
const VALID_CONFIDENCE = new Set<string>(['low', 'medium', 'high']);

/**
 * Validates and normalizes a review result from the LLM.
 * @param raw - Parsed JSON object from LLM
 * @param repoPath - Repository path for metadata
 * @param designFile - Optional design file path
 * @param sampledReview - Whether ranked source context was truncated by budget
 * @param contextCoverage - Optional context selection summary for the report
 */
export function validateReviewResult(
   raw: unknown,
   repoPath: string,
   designFile: string | undefined,
   sampledReview: boolean,
   contextCoverage?: IContextCoverageSummary
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
      tool: 'GuardDog',
      repoPath,
      designFile: normalizeDesignFileForStorage(designFile),
      generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
      sampledReview,
      contextCoverage,
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
      if (!isLlmEvidenceItem(item)) {
         throw new InvalidOperationError(
            `Finding ${findingIndex}: evidence[${i}] must include string file, directory, and observation fields.`
         );
      }
      const file = item.file.trim().length > 0 ? item.file : undefined;
      const directory = item.directory.trim().length > 0 ? item.directory : undefined;
      return {
         file,
         directory,
         observation: item.observation
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
 * Detects whether a review result appears to be an empty LLM fallback or otherwise unusable.
 * Legitimate zero-finding reviews (real repoPath and timestamp) are not treated as empty.
 * @param result - Parsed review result from the LLM
 */
export function isEmptyDefaultResult(result: IReviewResult): boolean {
   if (result.findings.length > 0) {
      return false;
   }
   const emptyRepoPath = !result.repoPath || result.repoPath.trim() === '';
   const sentinelGeneratedAt = result.generatedAt === DEFAULT_REVIEW_RESULT.generatedAt;
   return emptyRepoPath || sentinelGeneratedAt;
}

/**
 * Saves raw LLM response for debugging when parsing fails.
 * @param repoPath - Repository root
 * @param rawContent - Raw response text
 */
export async function saveDebugResponse(repoPath: string, rawContent: string): Promise<string> {
   const debugPath = `${repoPath}/.guarddog/guarddog-debug-${Date.now()}.json`;
   await writeTextFile(debugPath, rawContent);
   return debugPath;
}
