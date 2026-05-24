/**
 * @module test/unit/findingContract.test
 * Tests alignment between finding evidence types, LLM JSON schema, and parser.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { validateReviewResult } from '../../src/core/findingParser';
import {
   evidenceItemToLlmShape,
   IEvidenceItem,
   isLlmEvidenceItem,
   normalizeDesignFileForStorage,
   REVIEW_RESULT_JSON_SCHEMA
} from '../../src/schemas/finding';

const EVIDENCE_REQUIRED_KEYS = ['file', 'directory', 'observation'] as const;

function evidenceSchemaRequiredFields(): readonly string[] {
   const findings = REVIEW_RESULT_JSON_SCHEMA.properties as Record<string, unknown>;
   const findingsSchema = findings.findings as { items: { properties: { evidence: { items: { required: string[] } } } } };
   return findingsSchema.items.properties.evidence.items.required;
}

function reviewSchemaRequiredFields(): string[] {
   const schema = REVIEW_RESULT_JSON_SCHEMA as {
      required: string[];
   };
   return schema.required;
}

describe('findingContract', () => {
   it('requires designFile but not sampledReview in LLM output schema', () => {
      const required = reviewSchemaRequiredFields();
      expect(required).toContain('designFile');
      expect(required).not.toContain('sampledReview');
   });

   it('normalizes absent design file to empty string for LLM shape', () => {
      expect(normalizeDesignFileForStorage(undefined)).toBe('');
      expect(normalizeDesignFileForStorage('DESIGN.md')).toBe('DESIGN.md');
   });

   it('requires file, directory, and observation in LLM evidence schema', () => {
      expect(evidenceSchemaRequiredFields()).toEqual([...EVIDENCE_REQUIRED_KEYS]);
   });

   it('maps parsed evidence without locations to empty strings for LLM output', () => {
      const item: IEvidenceItem = { observation: 'Observed coupling' };
      expect(evidenceItemToLlmShape(item)).toEqual({
         file: '',
         directory: '',
         observation: 'Observed coupling'
      });
      expect(isLlmEvidenceItem(evidenceItemToLlmShape(item))).toBe(true);
   });

   it('round-trips LLM evidence with empty location fields through the parser', () => {
      const raw = {
         tool: 'GuardDog',
         repoPath: '/repo',
         generatedAt: '2025-05-23T12:00:00.000Z',
         summary: {
            overallRisk: 'low',
            findingCount: 1,
            highSeverityCount: 0,
            criticalSeverityCount: 0,
            mainThemes: []
         },
         findings: [
            {
               id: 'GD-001',
               title: 'Test',
               severity: 'low',
               impact: 'low',
               confidence: 'high',
               principle: 'Coupling',
               evidence: [
                  {
                     file: 'src/a.ts',
                     directory: '',
                     observation: 'Import crosses boundary'
                  }
               ],
               facts: ['fact'],
               inferences: [],
               risk: 'risk',
               blastRadius: { rating: 'low', reasoning: 'small' },
               recommendation: 'fix',
               possibleFitnessFunction: 'lint',
               suggestedLabels: []
            }
         ]
      };

      const result = validateReviewResult(raw, '/repo', undefined, false);
      expect(result.findings[0].evidence[0]).toEqual({
         file: 'src/a.ts',
         observation: 'Import crosses boundary'
      });
      expect(result.findings[0].evidence[0].directory).toBeUndefined();
      expect(isLlmEvidenceItem(evidenceItemToLlmShape(result.findings[0].evidence[0]))).toBe(true);
   });
});
