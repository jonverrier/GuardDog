/**
 * @module test/unit/repositoryPathSecurity.test
 * Tests for repository path confinement and secret redaction.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { loadDesignFile } from '../../src/core/designLoader';
import {
   readContextFile,
   redactSecrets,
   resolveContainedRepoFile,
   writeContainedRepoFile
} from '../../src/utils/fileSystem';
import { InvalidParameterError } from '../../src/utils/errors';

/**
 * Returns false when this host cannot create the requested link type.
 * Windows file symlinks need extra privilege; directory junctions do not.
 */
async function createSymlink(
   target: string,
   linkPath: string,
   type: 'file' | 'dir' | 'junction'
): Promise<boolean> {
   try {
      await fs.symlink(target, linkPath, type);
      return true;
   } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES') {
         return false;
      }
      throw error;
   }
}

const OPENSSH_KEY = [
   '-----BEGIN OPENSSH PRIVATE KEY-----',
   'FAKE_PRIVATE_KEY_MATERIAL',
   '-----END OPENSSH PRIVATE KEY-----'
].join('\n');

describe('repository path confinement', () => {
   let parent: string;
   let repo: string;

   beforeEach(async () => {
      parent = await fs.mkdtemp(path.join(os.tmpdir(), 'guarddog-security-'));
      repo = path.join(parent, 'repo');
      await fs.mkdir(repo);
      await fs.writeFile(path.join(repo, 'DESIGN.md'), 'safe design');
      await fs.writeFile(path.join(parent, 'private.txt'), 'HOST_SECRET');
   });

   afterEach(async () => {
      await fs.rm(parent, { recursive: true, force: true });
   });

   it.each(['../private.txt', '../../private.txt', '/etc/passwd', 'C:\\Users\\secret.txt'])(
      'rejects malicious design path %s',
      async (malicious) => {
         await expect(loadDesignFile(repo, malicious)).rejects.toThrow(InvalidParameterError);
         expect(await fs.readFile(path.join(parent, 'private.txt'), 'utf8')).toBe('HOST_SECRET');
      }
   );

   it('rejects a different Windows drive prefix', async () => {
      if (process.platform !== 'win32') {
         return;
      }
      const drive = path.parse(repo).root.toUpperCase();
      const otherDrivePath = drive.startsWith('C') ? 'D:secret.txt' : 'C:secret.txt';
      await expect(loadDesignFile(repo, otherDrivePath)).rejects.toThrow(InvalidParameterError);
   });

   it('rejects symlinks that leave the repository', async () => {
      const created = await createSymlink(path.join(parent, 'private.txt'), path.join(repo, 'linked.txt'), 'file');
      if (!created) {
         return;
      }
      await expect(loadDesignFile(repo, 'linked.txt')).rejects.toThrow(InvalidParameterError);
      await expect(readContextFile(repo, 'linked.txt')).rejects.toThrow(InvalidParameterError);
      expect(await fs.readFile(path.join(parent, 'private.txt'), 'utf8')).toBe('HOST_SECRET');
   });

   it('rejects context traversal', async () => {
      await expect(readContextFile(repo, '../private.txt')).rejects.toThrow(InvalidParameterError);
   });

   it('redacts private key blocks from explicit and default design files', async () => {
      await fs.writeFile(path.join(repo, 'DESIGN.md'), OPENSSH_KEY);
      const explicit = await loadDesignFile(repo, 'DESIGN.md');
      const fallback = await loadDesignFile(repo, undefined);
      expect(explicit.designContent).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
      expect(fallback.designContent).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
      expect(redactSecrets(OPENSSH_KEY)).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
      expect(await readContextFile(repo, 'DESIGN.md')).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
   });

   it('redacts an unclosed private key block', () => {
      const unclosed = '-----BEGIN OPENSSH PRIVATE KEY-----\nFAKE_PRIVATE_KEY_MATERIAL';
      expect(redactSecrets(unclosed)).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
   });

   it('does not send files that contain NUL bytes', async () => {
      await fs.writeFile(path.join(repo, 'binary.txt'), 'visible\0secret');
      expect(await readContextFile(repo, 'binary.txt')).toBeUndefined();
   });

   it('refuses outside report destinations and replaces an existing report', async () => {
      await expect(resolveContainedRepoFile(repo, '../outside.md')).rejects.toThrow(InvalidParameterError);
      await expect(writeContainedRepoFile(repo, '../outside.md', 'data')).rejects.toThrow(InvalidParameterError);
      expect(await fs.readFile(path.join(parent, 'private.txt'), 'utf8')).toBe('HOST_SECRET');
      await writeContainedRepoFile(repo, 'DESIGN.md', 'updated');
      expect(await fs.readFile(path.join(repo, 'DESIGN.md'), 'utf8')).toBe('updated');
   });

   it('creates a nested report directory inside the repository', async () => {
      await writeContainedRepoFile(repo, 'out/review.md', 'result');
      expect(await fs.readFile(path.join(repo, 'out', 'review.md'), 'utf8')).toBe('result');
   });

   it('does not write through a symlinked report path', async () => {
      const created = await createSymlink(path.join(parent, 'private.txt'), path.join(repo, 'report.md'), 'file');
      if (!created) {
         return;
      }
      await expect(writeContainedRepoFile(repo, 'report.md', 'result')).rejects.toThrow(InvalidParameterError);
      expect(await fs.readFile(path.join(parent, 'private.txt'), 'utf8')).toBe('HOST_SECRET');
   });

   it('does not write through a symlinked parent directory', async () => {
      const outsideDir = path.join(parent, 'outside');
      await fs.mkdir(outsideDir);
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      const created = await createSymlink(outsideDir, path.join(repo, 'linked-dir'), linkType);
      expect(created).toBe(true);
      await expect(writeContainedRepoFile(repo, 'linked-dir/review.md', 'result')).rejects.toThrow(
         InvalidParameterError
      );
      expect(await fs.readdir(outsideDir)).toEqual([]);
   });

   it('writes a new report with owner-only permissions on posix', async () => {
      await writeContainedRepoFile(repo, 'report.md', 'result');
      expect(await fs.readFile(path.join(repo, 'report.md'), 'utf8')).toBe('result');
      if (process.platform !== 'win32') {
         const stat = await fs.stat(path.join(repo, 'report.md'));
         expect(stat.mode & 0o777).toBe(0o600);
      }
   });
});
