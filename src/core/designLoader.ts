/**
 * @module core/designLoader
 * Locates and loads architecture intent / design files.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module locates and loads an “architecture intent” or design document for a repository. It supports an explicit design file path or a set of default candidate filenames, and returns either the loaded content or a warning describing what was checked.
// 
// The main export is loadDesignFile(repoPath, designPath, logger). When designPath is provided, it resolves the path relative to the repo root (or uses it as-is if absolute), attempts to read it, and returns the content plus a normalized repo-relative filename. If the file is missing, it logs a warning and returns only the warning. When designPath is not provided, it iterates through DEFAULT_DESIGN_CANDIDATES under the repo root and returns the first file that exists.
// 
// It returns an IDesignLoadResult containing designFile, designContent, and/or warning.
// 
// Key dependencies include Node’s path for path resolution and normalization, readTextFileIfExists for safe file reads, DEFAULT_DESIGN_CANDIDATES for fallback search, and ILogger/defaultLogger for warning output.
// ===End StrongAI Generated Comment===


import * as path from 'path';
import { DEFAULT_DESIGN_CANDIDATES } from '../schemas/config';
import { readTextFileIfExists } from '../utils/fileSystem';
import { ILogger, defaultLogger } from '../utils/logger';

export interface IDesignLoadResult {
   designFile?: string;
   designContent?: string;
   warning?: string;
}

/**
 * Loads the architecture design file from an explicit path or default candidates.
 * @param repoPath - Repository root
 * @param designPath - Optional explicit design file path
 * @param logger - Logger for warnings
 */
export async function loadDesignFile(
   repoPath: string,
   designPath: string | undefined,
   logger: ILogger = defaultLogger
): Promise<IDesignLoadResult> {
   if (designPath) {
      const resolved = path.isAbsolute(designPath)
         ? designPath
         : path.join(repoPath, designPath);
      const content = await readTextFileIfExists(resolved);
      if (!content) {
         const warning =
            `Design file not found at ${designPath}. Continuing without architecture intent.`;
         logger.warn(warning);
         return { warning };
      }
      const relative = path.relative(repoPath, resolved).replace(/\\/g, '/');
      return { designFile: relative, designContent: content };
   }

   for (const candidate of DEFAULT_DESIGN_CANDIDATES) {
      const fullPath = path.join(repoPath, candidate);
      const content = await readTextFileIfExists(fullPath);
      if (content) {
         return { designFile: candidate, designContent: content };
      }
   }

   const warning =
      'No design file found. Checked: ' +
      DEFAULT_DESIGN_CANDIDATES.join(', ') +
      '. Continuing without architecture intent — findings will be general evolutionary architecture observations only.';
   logger.warn(warning);
   return { warning };
}
