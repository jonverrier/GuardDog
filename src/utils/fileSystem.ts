/**
 * @module utils/fileSystem
 * File system helpers for repository scanning and config loading.
 */
// Copyright (c) 2025 Jon Verrier

import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { InvalidParameterError } from './errors';

const MAX_FILE_SIZE_BYTES = 256 * 1024;
const SECRET_PATTERNS: readonly RegExp[] = [
   /(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}/gi,
   /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
   /sk-[A-Za-z0-9]{20,}/g
];

const DEFAULT_IGNORED_DIRS = new Set([
   'node_modules',
   '.git',
   'dist',
   'build',
   'coverage',
   '.next',
   'out',
   '.turbo',
   '.cache',
   'vendor',
   '__pycache__'
]);

/**
 * Resolves and validates that a path exists and is a directory.
 * @param repoPath - Path to validate
 * @returns Absolute normalized path
 */
export async function resolveRepoPath(repoPath: string): Promise<string> {
   const resolved = path.resolve(repoPath);
   let stat;
   try {
      stat = await fs.stat(resolved);
   } catch {
      throw new InvalidParameterError(`Repository path does not exist: ${resolved}`);
   }
   if (!stat.isDirectory()) {
      throw new InvalidParameterError(`Repository path is not a directory: ${resolved}`);
   }
   return resolved;
}

/**
 * Reads a UTF-8 text file, returning undefined if missing.
 * @param filePath - Absolute or relative file path
 */
export async function readTextFileIfExists(filePath: string): Promise<string | undefined> {
   try {
      return await fs.readFile(filePath, 'utf8');
   } catch {
      return undefined;
   }
}

/**
 * Reads a UTF-8 text file.
 * @param filePath - File path to read
 */
export async function readTextFile(filePath: string): Promise<string> {
   return fs.readFile(filePath, 'utf8');
}

/**
 * Writes a UTF-8 text file, creating parent directories as needed.
 * @param filePath - Destination path
 * @param content - File content
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
   await fs.mkdir(path.dirname(filePath), { recursive: true });
   await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Parses simple gitignore-style patterns from a file.
 * @param gitignorePath - Path to .gitignore
 */
export async function loadGitignorePatterns(gitignorePath: string): Promise<string[]> {
   const content = await readTextFileIfExists(gitignorePath);
   if (!content) {
      return [];
   }
   return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Determines whether a relative path should be ignored.
 * @param relativePath - Path relative to repo root
 * @param gitignorePatterns - Parsed gitignore patterns
 */
export function isIgnoredPath(relativePath: string, gitignorePatterns: string[]): boolean {
   const normalized = relativePath.replace(/\\/g, '/');
   const segments = normalized.split('/');
   if (segments.some((segment) => DEFAULT_IGNORED_DIRS.has(segment))) {
      return true;
   }
   for (const pattern of gitignorePatterns) {
      if (minimatch(normalized, pattern, { dot: true, nocase: true })) {
         return true;
      }
      if (minimatch(path.basename(normalized), pattern, { dot: true, nocase: true })) {
         return true;
      }
   }
   return false;
}

/**
 * Walks a directory tree and returns relative file paths.
 * @param rootPath - Repository root
 * @param gitignorePatterns - Patterns to exclude
 */
export async function walkFiles(rootPath: string, gitignorePatterns: string[]): Promise<string[]> {
   const results: string[] = [];

   async function walk(currentDir: string): Promise<void> {
      let entries;
      try {
         entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
         return;
      }
      for (const entry of entries) {
         const fullPath = path.join(currentDir, entry.name);
         const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
         if (entry.isDirectory()) {
            if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
               continue;
            }
            if (isIgnoredPath(relativePath, gitignorePatterns)) {
               continue;
            }
            await walk(fullPath);
         } else if (entry.isFile()) {
            if (!isIgnoredPath(relativePath, gitignorePatterns)) {
               results.push(relativePath);
            }
         }
      }
   }

   await walk(rootPath);
   return results.sort();
}

/**
 * Reads a bounded text file for LLM context, redacting obvious secrets.
 * @param rootPath - Repository root
 * @param relativePath - Relative file path
 */
export async function readContextFile(
   rootPath: string,
   relativePath: string
): Promise<string | undefined> {
   const fullPath = path.join(rootPath, relativePath);
   let stat;
   try {
      stat = await fs.stat(fullPath);
   } catch {
      return undefined;
   }
   if (!stat.isFile() || stat.size > MAX_FILE_SIZE_BYTES) {
      return undefined;
   }
   const content = await readTextFileIfExists(fullPath);
   if (!content) {
      return undefined;
   }
   if (content.includes('\0')) {
      return undefined;
   }
   return redactSecrets(content);
}

/**
 * Redacts obvious secret patterns from text.
 * @param content - Raw text content
 */
export function redactSecrets(content: string): string {
   let redacted = content;
   for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
   }
   return redacted;
}

export { MAX_FILE_SIZE_BYTES, DEFAULT_IGNORED_DIRS };
