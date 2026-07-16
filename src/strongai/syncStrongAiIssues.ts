/**
 * @module strongai/syncStrongAiIssues
 * Invokes StrongAI's local issues → GitHub sync script.
 */
// Copyright (c) 2025 Jon Verrier

import { spawn } from 'child_process';
import * as path from 'path';
import { ConnectionError, InvalidStateError } from '../utils/errors';
import { ILogger, defaultLogger } from '../utils/logger';

export interface ISyncStrongAiIssuesOptions {
   strongAiRoot: string;
   /** When false, only logs the command that would run. */
   confirm: boolean;
}

/**
 * Runs StrongAI tools/build/scripts/sync-issues-to-github.sh.
 * Requires `gh` auth (GITHUB_TOKEN or gh login) in the local environment.
 * @param options - Sync options
 * @param logger - Logger
 */
export async function syncStrongAiIssuesToGitHub(
   options: ISyncStrongAiIssuesOptions,
   logger: ILogger = defaultLogger
): Promise<void> {
   const scriptPath = path.join(
      options.strongAiRoot,
      'tools',
      'build',
      'scripts',
      'sync-issues-to-github.sh'
   );

   if (!options.confirm) {
      logger.info(`[dry-run] Would run: bash "${scriptPath}" (cwd: ${path.join(options.strongAiRoot, 'tools', 'build')})`);
      logger.info(
         'Pass --sync --confirm to create real GitHub issues and backfill **GitHub:** links in issues/*.md.'
      );
      return;
   }

   logger.info(`Syncing StrongAI issues to GitHub via ${scriptPath}`);
   const exitCode = await runBashScript(scriptPath, path.join(options.strongAiRoot, 'tools', 'build'));
   if (exitCode !== 0) {
      throw new ConnectionError(
         `StrongAI issue sync script exited with code ${exitCode}. Ensure gh is installed and authenticated.`
      );
   }
   logger.info('StrongAI issue sync complete.');
}

/**
 * Resolves StrongAI monorepo root from CLI flag or common defaults.
 * @param explicitPath - Optional absolute/relative path from CLI
 * @param guardDogRoot - GuardDog repo root (usually process.cwd())
 */
export function resolveStrongAiRoot(explicitPath: string | undefined, guardDogRoot: string): string {
   if (explicitPath && explicitPath.trim().length > 0) {
      return path.resolve(explicitPath);
   }
   if (process.env.STRONGAI_PATH && process.env.STRONGAI_PATH.trim().length > 0) {
      return path.resolve(process.env.STRONGAI_PATH);
   }
   return path.resolve(guardDogRoot, '..', 'StrongAI');
}

async function runBashScript(scriptPath: string, cwd: string): Promise<number> {
   return new Promise((resolve, reject) => {
      const child = spawn('bash', [scriptPath], {
         cwd,
         env: process.env,
         stdio: 'inherit'
      });
      child.on('error', (error) => {
         reject(
            new InvalidStateError(
               `Failed to start StrongAI sync script (${scriptPath}): ${error.message}`
            )
         );
      });
      child.on('close', (code) => {
         resolve(code ?? 1);
      });
   });
}
