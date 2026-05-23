/**
 * @module test/unit/c4ArchitectureDocs.test
 * Tests for C4-Auto architecture document detection.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import {
   findC4ArchitectureFiles,
   isC4ArchitectureDoc,
   sortC4ArchitectureFiles
} from '../../src/core/c4ArchitectureDocs';

describe('c4ArchitectureDocs', () => {
   it('detects default C4-Auto filenames', () => {
      expect(isC4ArchitectureDoc('README.StrongAI.Context.md')).toBe(true);
      expect(isC4ArchitectureDoc('src/README.StrongAI.Component.md')).toBe(true);
      expect(isC4ArchitectureDoc('DESIGN.md')).toBe(false);
      expect(isC4ArchitectureDoc('README.md')).toBe(false);
   });

   it('sorts package-root C4 files before nested paths', () => {
      const sorted = sortC4ArchitectureFiles([
         'src/README.StrongAI.Component.md',
         'README.StrongAI.Context.md'
      ]);
      expect(sorted[0]).toBe('README.StrongAI.Context.md');
   });

   it('finds C4 files in a path list', () => {
      const found = findC4ArchitectureFiles([
         'package.json',
         'README.StrongAI.Context.md',
         'src/api/users.ts',
         'src/README.StrongAI.Component.md'
      ]);
      expect(found).toEqual([
         'README.StrongAI.Context.md',
         'src/README.StrongAI.Component.md'
      ]);
   });
});
