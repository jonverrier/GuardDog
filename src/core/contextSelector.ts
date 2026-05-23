/**
 * @module core/contextSelector
 * Selects a bounded set of files for LLM review context.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import { capC4ArchitectureFilesForContext, sortC4ArchitectureFiles } from './c4ArchitectureDocs';
import { IRepoMap } from '../schemas/repoMap';
import { loadGitignorePatterns, readContextFile, walkFiles } from '../utils/fileSystem';
import { ILogger, defaultLogger } from '../utils/logger';

const MAX_CONTEXT_FILES = 40;
const MAX_TOTAL_CONTEXT_CHARS = 120_000;
const CONTEXT_EXTENSIONS = new Set([
   '.ts',
   '.tsx',
   '.js',
   '.jsx',
   '.json',
   '.md',
   '.yml',
   '.yaml',
   '.toml',
   '.tf',
   '.sh',
   '.ps1',
   '.py',
   '.go',
   '.rs'
]);

export interface IContextFile {
   relativePath: string;
   content: string;
}

export interface IContextSelectionResult {
   files: IContextFile[];
   sampledReview: boolean;
   totalFilesAvailable: number;
}

/**
 * Selects bounded context files for the architecture review prompt.
 * @param rootPath - Repository root
 * @param repoMap - Generated repository map
 * @param designFile - Optional design file path to include
 * @param logger - Logger for warnings
 */
export async function selectContextFiles(
   rootPath: string,
   repoMap: IRepoMap,
   designFile: string | undefined,
   logger: ILogger = defaultLogger
): Promise<IContextSelectionResult> {
   const gitignorePatterns = await loadGitignorePatterns(path.join(rootPath, '.gitignore'));
   const allFiles = await walkFiles(rootPath, gitignorePatterns);

   const priorityPaths: string[] = [];
   const prioritySet = new Set<string>();

   const addPriority = (relativePath: string): void => {
      if (!prioritySet.has(relativePath) && allFiles.includes(relativePath)) {
         prioritySet.add(relativePath);
         priorityPaths.push(relativePath);
      }
   };

   if (designFile) {
      addPriority(designFile);
   }

   for (const file of capC4ArchitectureFilesForContext(sortC4ArchitectureFiles(repoMap.c4ArchitectureFiles))) {
      addPriority(file);
   }

   for (const file of repoMap.importantFiles) {
      addPriority(file);
   }
   for (const file of repoMap.configFiles) {
      addPriority(file);
   }
   for (const file of repoMap.ciFiles) {
      addPriority(file);
   }
   for (const file of repoMap.deploymentFiles) {
      addPriority(file);
   }
   for (const file of repoMap.dependencyFiles) {
      if (file.endsWith('package.json')) {
         addPriority(file);
      }
   }

   for (const dir of repoMap.sourceDirectories) {
      const dirFiles = allFiles.filter(
         (f) => f.startsWith(`${dir}/`) && isContextCandidate(f)
      );
      for (const file of dirFiles.slice(0, 8)) {
         addPriority(file);
      }
   }

   for (const dir of repoMap.testDirectories) {
      const setupFiles = allFiles.filter(
         (f) =>
            f.startsWith(`${dir}/`) &&
            (f.includes('setup') || f.includes('jest') || f.includes('config'))
      );
      for (const file of setupFiles.slice(0, 3)) {
         addPriority(file);
      }
   }

   const candidatePaths = priorityPaths;
   const sampledReview = candidatePaths.length < allFiles.filter(isContextCandidate).length;

   if (sampledReview) {
      logger.warn(
         `Repository is large; using sampled context (${candidatePaths.length} of ${allFiles.length} files).`
      );
   }

   const files: IContextFile[] = [];
   let totalChars = 0;

   for (const relativePath of candidatePaths.slice(0, MAX_CONTEXT_FILES)) {
      const content = await readContextFile(rootPath, relativePath);
      if (!content) {
         continue;
      }
      if (totalChars + content.length > MAX_TOTAL_CONTEXT_CHARS) {
         logger.warn('Context size limit reached; truncating remaining files.');
         break;
      }
      files.push({ relativePath, content });
      totalChars += content.length;
   }

   return {
      files,
      sampledReview,
      totalFilesAvailable: allFiles.length
   };
}

function isContextCandidate(relativePath: string): boolean {
   const ext = path.extname(relativePath).toLowerCase();
   if (!CONTEXT_EXTENSIONS.has(ext)) {
      return false;
   }
   const base = path.basename(relativePath).toLowerCase();
   if (base.endsWith('.lock') || base.includes('.min.')) {
      return false;
   }
   return true;
}
