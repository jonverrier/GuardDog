/**
 * @module test/unit/fileSystem.test
 * Tests for file system helpers and secret redaction.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { redactSecrets } from '../../src/utils/fileSystem';

describe('fileSystem', () => {
   it('preserves process.env reads when redacting token-like assignments', () => {
      const source = "const token = process.env.GITHUB_TOKEN;\nif (!token) { throw new Error('missing'); }";
      expect(redactSecrets(source)).toBe(source);
   });

   it('still redacts literal secret assignments', () => {
      const source = "const token = 'super-secret-value-here';";
      expect(redactSecrets(source)).toContain('[REDACTED]');
      expect(redactSecrets(source)).not.toContain('super-secret-value-here');
   });
});
