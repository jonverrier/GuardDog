/**
 * @module core/c4ArchitectureDocs
 * Detection helpers for C4-Auto generated architecture markdown files.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';

/** Default C4-Auto component diagram filename (Strong AI convention). */
export const DEFAULT_C4_COMPONENT_FILE = 'README.StrongAI.Component.md';

/** Default C4-Auto context diagram filename (Strong AI convention). */
export const DEFAULT_C4_CONTEXT_FILE = 'README.StrongAI.Context.md';

/** Basename suffixes that identify C4-Auto generated architecture docs. */
export const C4_ARCHITECTURE_FILE_SUFFIXES: readonly string[] = [
   '.StrongAI.Component.md',
   '.StrongAI.Context.md'
];

const MAX_C4_FILES_IN_CONTEXT = 24;

/**
 * Returns true when a relative path is a C4-Auto architecture document.
 * Matches default filenames and custom basenames using the StrongAI suffix convention.
 * @param relativePath - Path relative to repository root
 */
export function isC4ArchitectureDoc(relativePath: string): boolean {
   const base = path.basename(relativePath);
   return C4_ARCHITECTURE_FILE_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

/**
 * Filters repository file paths to C4 architecture documents.
 * @param allFiles - Relative file paths from a repository walk
 */
export function findC4ArchitectureFiles(allFiles: string[]): string[] {
   return allFiles.filter(isC4ArchitectureDoc).sort(compareC4ArchitectureFilePriority);
}

/**
 * Sorts C4 files with package-root rollups first, then deeper paths alphabetically.
 * @param files - C4 architecture file paths
 */
export function sortC4ArchitectureFiles(files: string[]): string[] {
   return [...files].sort(compareC4ArchitectureFilePriority);
}

/**
 * Returns C4 files capped for prompt context, preserving priority order.
 * @param files - Sorted C4 architecture file paths
 */
export function capC4ArchitectureFilesForContext(files: string[]): string[] {
   return files.slice(0, MAX_C4_FILES_IN_CONTEXT);
}

function compareC4ArchitectureFilePriority(a: string, b: string): number {
   const depthA = a.split('/').length;
   const depthB = b.split('/').length;
   if (depthA !== depthB) {
      return depthA - depthB;
   }
   const baseA = path.basename(a);
   const baseB = path.basename(b);
   if (baseA === DEFAULT_C4_CONTEXT_FILE && baseB !== DEFAULT_C4_CONTEXT_FILE) {
      return -1;
   }
   if (baseB === DEFAULT_C4_CONTEXT_FILE && baseA !== DEFAULT_C4_CONTEXT_FILE) {
      return 1;
   }
   return a.localeCompare(b);
}

export { MAX_C4_FILES_IN_CONTEXT };
