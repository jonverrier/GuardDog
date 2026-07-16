/**
 * @module test/unit/cloudAgentPayload.test
 * Tests for cloud agent payload parsing.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { STRONGAI_PLATFORM_TARGETS } from '../../src/schemas/strongAiPlatforms';
import { parseCloudReviewPayload } from '../../src/strongai/cloudAgentPayload';
import { InvalidParameterError } from '../../src/utils/errors';

describe('cloudAgentPayload', () => {
   const target = STRONGAI_PLATFORM_TARGETS[1];

   it('parses a fenced JSON payload', () => {
      const payload = {
         packageId: target.id,
         issueSlug: target.issueSlug,
         issueTitle: 'GuardDog architecture review: platform-client',
         issueMarkdown:
            '**Status:** open\n**Type:** proposal\n**GitHub:** x\n**Superseded by:**\n\n# Title\n',
         reviewSummary: {
            overallRisk: 'low',
            findingCount: 0,
            highSeverityCount: 0,
            criticalSeverityCount: 0,
            mainThemes: []
         }
      };

      const parsed = parseCloudReviewPayload(`Here you go:\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`, target);
      expect(parsed.packageId).toBe('platform-client');
      expect(parsed.issueSlug).toBe(target.issueSlug);
      expect(parsed.reviewSummary.findingCount).toBe(0);
   });

   it('rejects packageId mismatches', () => {
      const payload = {
         packageId: 'platform',
         issueSlug: target.issueSlug,
         issueTitle: 'wrong',
         issueMarkdown: '**Status:** open\n**Type:** proposal\n**GitHub:** x\n**Superseded by:**\n\n# Title\n',
         reviewSummary: {
            overallRisk: 'low',
            findingCount: 0,
            highSeverityCount: 0,
            criticalSeverityCount: 0,
            mainThemes: []
         }
      };

      expect(() => parseCloudReviewPayload(JSON.stringify(payload), target)).toThrow(
         InvalidParameterError
      );
   });
});
