/**
 * @module schemas/finding
 * Types and JSON schema for architecture review findings.
 */
// Copyright (c) 2025 Jon Verrier

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FindingImpact = 'low' | 'medium' | 'high' | 'critical';
export type FindingConfidence = 'low' | 'medium' | 'high';

export interface IEvidenceItem {
   file?: string;
   directory?: string;
   observation: string;
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
   designFile?: string;
   generatedAt: string;
   sampledReview?: boolean;
   summary: IReviewSummary;
   findings: IFinding[];
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
   required: ['tool', 'repoPath', 'generatedAt', 'summary', 'findings'],
   properties: {
      tool: { type: 'string', enum: ['GuardDog'] },
      repoPath: { type: 'string' },
      designFile: { type: 'string' },
      generatedAt: { type: 'string' },
      sampledReview: { type: 'boolean' },
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
                     required: ['observation'],
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
