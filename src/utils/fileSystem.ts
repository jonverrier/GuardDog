/**
 * @module utils/fileSystem
 * File system helpers for repository scanning and config loading.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// File system utilities used to scan a repository and safely load file content for tooling and LLM context. The module relies on Node’s fs/promises for async I/O and path for normalization and relative path handling. It also uses minimatch to apply gitignore-style glob patterns, and throws InvalidParameterError when a provided repository path is invalid.
// 
// resolveRepoPath normalizes a path, verifies it exists, and ensures it is a directory. readTextFileIfExists reads UTF-8 text and returns undefined when the file is missing, while readTextFile always reads or fails. writeTextFile writes UTF-8 content and creates parent directories automatically.
// 
// loadGitignorePatterns parses a .gitignore-like file into patterns, skipping blank lines and comments. isIgnoredPath checks a relative path against built-in ignored directories and provided patterns.
// 
// walkFiles recursively collects relative file paths under a root, excluding ignored paths, and returns a sorted list.
// 
// readContextFile reads only small, non-binary files and redacts common secret formats via redactSecrets. MAX_FILE_SIZE_BYTES and DEFAULT_IGNORED_DIRS are exported for configuration and reuse.
// ===End StrongAI Generated Comment===


import { randomBytes } from 'crypto';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { InvalidParameterError } from './errors';

const MAX_FILE_SIZE_BYTES = 256 * 1024;
const REPORT_FILE_MODE = 0o600;
const TEMP_FILE_RANDOM_BYTES = 12;
const SECRET_PATTERNS: readonly RegExp[] = [
   /(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*(?!process\.env)['"]?[A-Za-z0-9_\-./+=]{8,}/gi,
   /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
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
 * Resolves a repository-controlled path.
 * Rejects absolute paths, parent traversal, NUL bytes, and symlinks, including symlinked parents.
 * @param rootPath - Repository root
 * @param relativePath - Path relative to the repository root
 * @returns Absolute path inside the repository
 */
export async function resolveContainedRepoFile(rootPath: string, relativePath: string): Promise<string> {
   if (!relativePath || relativePath.includes('\0') || isAbsoluteInputPath(relativePath)) {
      throw new InvalidParameterError('Repository file path must be relative');
   }
   const root = await fs.realpath(rootPath);
   const candidate = path.resolve(root, relativePath);
   const rel = path.relative(root, candidate);
   if (rel.length === 0 || relativeEscapesRoot(rel)) {
      throw new InvalidParameterError('Repository file path escapes the repository');
   }
   let current = root;
   for (const part of rel.split(path.sep)) {
      current = path.join(current, part);
      try {
         const stat = await fs.lstat(current);
         if (stat.isSymbolicLink()) {
            throw new InvalidParameterError('Symlink in repository file path is forbidden');
         }
      } catch (error) {
         if (isEnoent(error)) {
            break;
         }
         throw error;
      }
   }
   return candidate;
}

/**
 * Converts an absolute path to a POSIX path relative to the real repository root.
 * @param rootPath - Repository root
 * @param absolutePath - Absolute path already resolved inside the repository
 */
export async function toRepoRelativePath(rootPath: string, absolutePath: string): Promise<string> {
   const root = await fs.realpath(rootPath);
   const relative = path.relative(root, absolutePath).replace(/\\/g, '/');
   if (relative.length === 0 || relativeEscapesRoot(relative)) {
      throw new InvalidParameterError('Repository file path escapes the repository');
   }
   return relative;
}

/**
 * Reads an existing repository file with a size limit.
 * Returns undefined when the file is missing, too large, or contains NUL bytes.
 * Symlinks are rejected.
 * @param rootPath - Repository root
 * @param relativePath - Path relative to the repository root
 */
export async function readContainedRepoFile(
   rootPath: string,
   relativePath: string
): Promise<string | undefined> {
   const filename = await resolveContainedRepoFile(rootPath, relativePath);
   try {
      const handle = await fs.open(filename, constants.O_RDONLY | noFollowFlag());
      try {
         const stat = await handle.stat();
         if (!stat.isFile() || stat.size > MAX_FILE_SIZE_BYTES) {
            return undefined;
         }
         const content = await handle.readFile({ encoding: 'utf8' });
         if (content.includes('\0')) {
            return undefined;
         }
         return content;
      } finally {
         await handle.close();
      }
   } catch (error) {
      if (isEnoent(error)) {
         return undefined;
      }
      throw error;
   }
}

/**
 * Atomically replaces a report inside the repository.
 * The temporary file is created in a validated directory. Rename replaces the destination name.
 * Missing parent directories are created only when every segment stays inside the repository.
 * @param rootPath - Repository root
 * @param relativePath - Path relative to the repository root
 * @param content - File content
 */
export async function writeContainedRepoFile(
   rootPath: string,
   relativePath: string,
   content: string
): Promise<void> {
   const filename = await resolveContainedRepoFile(rootPath, relativePath);
   const realParent = await ensureContainedParentDirectory(rootPath, filename);
   const temporary = path.join(
      realParent,
      `.${path.basename(filename)}.${randomBytes(TEMP_FILE_RANDOM_BYTES).toString('hex')}.tmp`
   );
   let created = false;
   try {
      const handle = await fs.open(
         temporary,
         constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowFlag(),
         REPORT_FILE_MODE
      );
      created = true;
      try {
         await handle.writeFile(content, 'utf8');
         await handle.sync();
      } finally {
         await handle.close();
      }
      // Re-check immediately before replacement. This is not a substitute for an
      // OS-level sandbox if an attacker can mutate the tree concurrently.
      await resolveContainedRepoFile(rootPath, relativePath);
      await fs.rename(temporary, filename);
      created = false;
   } finally {
      if (created) {
         await fs.unlink(temporary).catch(() => undefined);
      }
   }
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
   const content = await readContainedRepoFile(rootPath, relativePath);
   if (content === undefined || content.length === 0 || content.includes('\0')) {
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
      pattern.lastIndex = 0;
      redacted = redacted.replace(pattern, '[REDACTED]');
   }
   return redacted;
}

function isAbsoluteInputPath(relativePath: string): boolean {
   return path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) || path.posix.isAbsolute(relativePath);
}

function relativeEscapesRoot(relative: string): boolean {
   const normalized = relative.replace(/\\/g, '/');
   return normalized === '..' || normalized.startsWith('../') || path.win32.isAbsolute(normalized) || path.posix.isAbsolute(normalized);
}

function isEnoent(error: unknown): boolean {
   return Boolean(error) && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function noFollowFlag(): number {
   return constants.O_NOFOLLOW ?? 0;
}

/**
 * Creates missing parent directories without following a symlink out of the repository.
 * @param rootPath - Repository root
 * @param filename - Absolute destination file path inside the repository
 * @returns Real path of the parent directory
 */
async function ensureContainedParentDirectory(rootPath: string, filename: string): Promise<string> {
   const realRoot = await fs.realpath(rootPath);
   const parent = path.dirname(filename);
   const parentRel = path.relative(realRoot, parent);
   if (relativeEscapesRoot(parentRel)) {
      throw new InvalidParameterError('Report destination escapes repository');
   }
   if (parentRel.length === 0) {
      return realRoot;
   }

   let current = realRoot;
   for (const part of parentRel.split(path.sep)) {
      current = path.join(current, part);
      try {
         const stat = await fs.lstat(current);
         if (stat.isSymbolicLink()) {
            throw new InvalidParameterError('Symlink in repository file path is forbidden');
         }
         if (!stat.isDirectory()) {
            throw new InvalidParameterError('Report destination parent is not a directory');
         }
      } catch (error) {
         if (!isEnoent(error)) {
            throw error;
         }
         await fs.mkdir(current);
      }
   }

   const realParent = await fs.realpath(current);
   if (relativeEscapesRoot(path.relative(realRoot, realParent))) {
      throw new InvalidParameterError('Report destination escapes repository');
   }
   return realParent;
}

export { MAX_FILE_SIZE_BYTES, DEFAULT_IGNORED_DIRS };
