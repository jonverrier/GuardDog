import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { loadDesignFile } from '../../src/core/designLoader';
import { readContextFile, redactSecrets, resolveContainedRepoFile, writeContainedRepoFile } from '../../src/utils/fileSystem';

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
   afterEach(async () => { await fs.rm(parent, { recursive: true, force: true }); });

   test.each(['../private.txt', '../../private.txt', '/etc/passwd', 'C:\\Users\\secret.txt'])(
      'rejects malicious design path %s', async (malicious) => {
         await expect(loadDesignFile(repo, malicious)).rejects.toThrow();
      }
   );

   test('rejects symlinks escaping the repo', async () => {
      await fs.symlink(path.join(parent, 'private.txt'), path.join(repo, 'linked.txt'));
      await expect(loadDesignFile(repo, 'linked.txt')).rejects.toThrow();
      await expect(readContextFile(repo, 'linked.txt')).rejects.toThrow();
   });

   test('rejects context traversal', async () => {
      await expect(readContextFile(repo, '../private.txt')).rejects.toThrow();
   });

   test('redacts private key blocks in design and context', async () => {
      const key = '-----BEGIN OPENSSH PRIVATE KEY-----\\nFAKE_PRIVATE_KEY_MATERIAL\\n-----END OPENSSH PRIVATE KEY-----';
      await fs.writeFile(path.join(repo, 'DESIGN.md'), key);
      const design = await loadDesignFile(repo, 'DESIGN.md');
      expect(design.designContent).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
      expect(redactSecrets(key)).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
      expect(await readContextFile(repo, 'DESIGN.md')).not.toContain('FAKE_PRIVATE_KEY_MATERIAL');
   });

   test('refuses outside and existing report destinations', async () => {
      await expect(resolveContainedRepoFile(repo, '../outside.md')).rejects.toThrow();
      await expect(writeContainedRepoFile(repo, '../outside.md', 'data')).rejects.toThrow();
      await expect(writeContainedRepoFile(repo, 'DESIGN.md', 'data')).rejects.toThrow();
      expect(await fs.readFile(path.join(repo, 'DESIGN.md'), 'utf8')).toBe('safe design');
   });

   test('writes new reports with restrictive permissions', async () => {
      await writeContainedRepoFile(repo, 'report.md', 'result');
      expect(await fs.readFile(path.join(repo, 'report.md'), 'utf8')).toBe('result');
   });
});
