/**
 * @module core/c4ArchitectureDocs
 * Detection helpers for C4-Auto generated architecture markdown files.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module provides small helpers for detecting and prioritizing C4-Auto generated architecture markdown files in a repository. It exports the default C4 context and component filenames from the config schema, plus C4_ARCHITECTURE_FILE_SUFFIXES, the basename suffixes used to recognize generated docs. IC4FileOptions lets callers override the expected context and component filenames.
// 
// isC4ArchitectureDoc checks a repo-relative path by comparing its basename to the configured filenames (when provided) or by matching the known suffixes. findC4ArchitectureFiles filters a list of walked file paths down to C4 docs and returns them sorted by priority. sortC4ArchitectureFiles sorts an existing list using the same rules. capC4ArchitectureFilesForContext trims a sorted list to MAX_C4_FILES_IN_CONTEXT (24) to limit prompt/context size.
// 
// Sorting prefers shallower paths first, then prioritizes the context file over the component file, then falls back to alphabetical order. The module relies on Node’s path.basename and on DEFAULT_C4_CONTEXT_FILE / DEFAULT_C4_COMPONENT_FILE for default naming.
// ===End StrongAI Generated Comment===


import * as path from 'path';
import {
   DEFAULT_C4_COMPONENT_FILE,
   DEFAULT_C4_CONTEXT_FILE
} from '../schemas/config';

export { DEFAULT_C4_COMPONENT_FILE, DEFAULT_C4_CONTEXT_FILE };

/** Basename suffixes that identify C4-Auto generated architecture docs. */
export const C4_ARCHITECTURE_FILE_SUFFIXES: readonly string[] = [
   '.StrongAI.Component.md',
   '.StrongAI.Context.md'
];

const MAX_C4_FILES_IN_CONTEXT = 24;

export interface IC4FileOptions {
   componentFile: string;
   contextFile: string;
}

/**
 * Returns true when a relative path is a C4-Auto architecture document.
 * @param relativePath - Path relative to repository root
 * @param options - Optional configured C4 filenames
 */
export function isC4ArchitectureDoc(
   relativePath: string,
   options?: IC4FileOptions
): boolean {
   const base = path.basename(relativePath);
   if (options) {
      if (base === options.componentFile || base === options.contextFile) {
         return true;
      }
   }
   return C4_ARCHITECTURE_FILE_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

/**
 * Filters repository file paths to C4 architecture documents.
 * @param allFiles - Relative file paths from a repository walk
 * @param options - Optional configured C4 filenames
 */
export function findC4ArchitectureFiles(
   allFiles: string[],
   options?: IC4FileOptions
): string[] {
   return allFiles.filter((f) => isC4ArchitectureDoc(f, options)).sort((a, b) =>
      compareC4ArchitectureFilePriority(a, b, options)
   );
}

/**
 * Sorts C4 files with package-root rollups first, then deeper paths alphabetically.
 * @param files - C4 architecture file paths
 * @param options - Optional configured C4 filenames
 */
export function sortC4ArchitectureFiles(
   files: string[],
   options?: IC4FileOptions
): string[] {
   return [...files].sort((a, b) => compareC4ArchitectureFilePriority(a, b, options));
}

/**
 * Returns C4 files capped for prompt context, preserving priority order.
 * @param files - Sorted C4 architecture file paths
 */
export function capC4ArchitectureFilesForContext(files: string[]): string[] {
   return files.slice(0, MAX_C4_FILES_IN_CONTEXT);
}

function compareC4ArchitectureFilePriority(
   a: string,
   b: string,
   options?: IC4FileOptions
): number {
   const depthA = a.split('/').length;
   const depthB = b.split('/').length;
   if (depthA !== depthB) {
      return depthA - depthB;
   }
   const baseA = path.basename(a);
   const baseB = path.basename(b);
   const contextFile = options?.contextFile ?? DEFAULT_C4_CONTEXT_FILE;
   const componentFile = options?.componentFile ?? DEFAULT_C4_COMPONENT_FILE;
   if (baseA === contextFile && baseB !== contextFile) {
      return -1;
   }
   if (baseB === contextFile && baseA !== contextFile) {
      return 1;
   }
   if (baseA === componentFile && baseB !== componentFile) {
      return -1;
   }
   if (baseB === componentFile && baseA !== componentFile) {
      return 1;
   }
   return a.localeCompare(b);
}

export { MAX_C4_FILES_IN_CONTEXT };
