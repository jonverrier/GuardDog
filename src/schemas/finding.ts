/**
 * @module schemas/finding
 * Types and JSON schema for architecture review findings.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Defines the core types and JSON Schema used to represent architecture review findings and the final review result produced by the GuardDog tool. It standardizes severity, impact, and confidence as string-literal unions, and models evidence, findings, and summary data as interfaces. IEvidenceItem captures an observation plus optional file and directory context. IFinding describes a single finding, including severity/impact/confidence, supporting evidence, facts and inferences, risk description, blast-radius rating and reasoning, a recommendation, an optional fitness-function idea, and suggested labels. IReviewSummary aggregates overall risk, counts, and themes. IReviewResult is the top-level payload with tool name, repo metadata, timestamps, and the list of findings. SEVERITY_ORDER and IMPACT_ORDER provide ordered scales for comparisons or sorting. REVIEW_RESULT_JSON_SCHEMA defines a strict, no-additional-properties schema intended for LLM constrained structured output. DEFAULT_REVIEW_RESULT is a safe empty fallback result. There are no external imports; it relies only on built-in Date for the default timestamp.
// ===End StrongAI Generated Comment===


import { IContextCoverageSummary } from './contextManifest';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FindingImpact = 'low' | 'medium' | 'high' | 'critical';
export type FindingConfidence = 'low' | 'medium' | 'high';

/**
 * Evidence in parsed review results. `file` and `directory` are omitted when not applicable.
 */
export interface IEvidenceItem {
   file?: string;
   directory?: string;
   observation: string;
}

/** Evidence shape required by OpenAI strict JSON schema (all keys present). */
export interface IEvidenceItemLlm {
   file: string;
   directory: string;
   observation: string;
}

/**
 * Maps parsed evidence to LLM JSON output. Use empty strings when file or directory do not apply.
 * @param item - Parsed evidence item
 */
export function evidenceItemToLlmShape(item: IEvidenceItem): IEvidenceItemLlm {
   return {
      file: item.file ?? '',
      directory: item.directory ?? '',
      observation: item.observation
   };
}

/**
 * Returns true when an object satisfies the LLM evidence item contract.
 * @param value - Candidate evidence object from LLM JSON
 */
export function isLlmEvidenceItem(value: unknown): value is IEvidenceItemLlm {
   if (!value || typeof value !== 'object') {
      return false;
   }
   const obj = value as Record<string, unknown>;
   return (
      typeof obj.file === 'string' &&
      typeof obj.directory === 'string' &&
      typeof obj.observation === 'string' &&
      obj.observation.trim().length > 0
   );
}

export interface IFinding {
   id: string;
   title: string;
   severity: FindingSeverity;
   impact: FindingImpact;
   confidence: FindingConfidence;
   principle: string;
   evidence: IEvidenceItem[];
   facts: string[];
   inferences: string[];
   risk: string;
   blastRadius: {
      rating: FindingImpact;
      reasoning: string;
   };
   recommendation: string;
   possibleFitnessFunction: string;
   suggestedLabels: string[];
}

export interface IReviewSummary {
   overallRisk: FindingSeverity;
   findingCount: number;
   highSeverityCount: number;
   criticalSeverityCount: number;
   mainThemes: string[];
}

export interface IReviewResult {
   tool: 'GuardDog';
   repoPath: string;
   /** Relative path to design intent file, or empty string when none was provided. */
   designFile: string;
   generatedAt: string;
   /** Set by the pipeline from source-layer truncation; not supplied by the LLM. */
   sampledReview?: boolean;
   contextCoverage?: IContextCoverageSummary;
   summary: IReviewSummary;
   findings: IFinding[];
}

/**
 * Normalizes design file path for storage and LLM JSON output (empty string when absent).
 * @param designFile - Optional design file path from the repository
 */
export function normalizeDesignFileForStorage(designFile?: string): string {
   const trimmed = designFile?.trim();
   return trimmed && trimmed.length > 0 ? trimmed : '';
}

/** Ordered severity levels for comparison. */
export const SEVERITY_ORDER: readonly FindingSeverity[] = ['low', 'medium', 'high', 'critical'];

/** Ordered impact levels for comparison. */
export const IMPACT_ORDER: readonly FindingImpact[] = ['low', 'medium', 'high', 'critical'];

/**
 * JSON schema passed to the LLM for constrained structured output.
 */
export const REVIEW_RESULT_JSON_SCHEMA: Record<string, unknown> = {
   type: 'object',
   additionalProperties: false,
   required: ['tool', 'repoPath', 'designFile', 'generatedAt', 'summary', 'findings'],
   properties: {
      tool: { type: 'string', enum: ['GuardDog'] },
      repoPath: { type: 'string' },
      designFile: { type: 'string' },
      generatedAt: { type: 'string' },
      summary: {
         type: 'object',
         additionalProperties: false,
         required: [
            'overallRisk',
            'findingCount',
            'highSeverityCount',
            'criticalSeverityCount',
            'mainThemes'
         ],
         properties: {
            overallRisk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            findingCount: { type: 'number' },
            highSeverityCount: { type: 'number' },
            criticalSeverityCount: { type: 'number' },
            mainThemes: { type: 'array', items: { type: 'string' } }
         }
      },
      findings: {
         type: 'array',
         items: {
            type: 'object',
            additionalProperties: false,
            required: [
               'id',
               'title',
               'severity',
               'impact',
               'confidence',
               'principle',
               'evidence',
               'facts',
               'inferences',
               'risk',
               'blastRadius',
               'recommendation',
               'possibleFitnessFunction',
               'suggestedLabels'
            ],
            properties: {
               id: { type: 'string' },
               title: { type: 'string' },
               severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
               impact: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
               confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
               principle: { type: 'string' },
               evidence: {
                  type: 'array',
                  items: {
                     type: 'object',
                     additionalProperties: false,
                     required: ['file', 'directory', 'observation'],
                     properties: {
                        file: { type: 'string' },
                        directory: { type: 'string' },
                        observation: { type: 'string' }
                     }
                  }
               },
               facts: { type: 'array', items: { type: 'string' } },
               inferences: { type: 'array', items: { type: 'string' } },
               risk: { type: 'string' },
               blastRadius: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['rating', 'reasoning'],
                  properties: {
                     rating: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                     reasoning: { type: 'string' }
                  }
               },
               recommendation: { type: 'string' },
               possibleFitnessFunction: { type: 'string' },
               suggestedLabels: { type: 'array', items: { type: 'string' } }
            }
         }
      }
   }
};

/**
 * Default empty review result used as fallback for constrained response.
 */
export const DEFAULT_REVIEW_RESULT: IReviewResult = {
   tool: 'GuardDog',
   repoPath: '',
   designFile: '',
   generatedAt: new Date(0).toISOString(),
   summary: {
      overallRisk: 'low',
      findingCount: 0,
      highSeverityCount: 0,
      criticalSeverityCount: 0,
      mainThemes: []
   },
   findings: []
};
