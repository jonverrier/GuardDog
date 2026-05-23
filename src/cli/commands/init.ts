/**
 * @module cli/commands/init
 * `seamguard init` command — scaffolds `.seamguard/` configuration.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import * as fs from 'fs/promises';
import { DEFAULT_CONFIG } from '../../schemas/config';
import { getReviewerConstitutionText } from '../../core/promptFactory';
import { REVIEW_RESULT_JSON_SCHEMA } from '../../schemas/finding';
import { resolveRepoPath, writeTextFile } from '../../utils/fileSystem';
import { defaultLogger } from '../../utils/logger';

const SEAMGUARD_DIR = '.seamguard';

/**
 * Creates `.seamguard/` configuration scaffolding in a repository.
 * @param args - Arguments after `init`
 * @returns Process exit code
 */
export async function runInitCommand(args: string[]): Promise<number> {
   const repoPath = args[0] && !args[0].startsWith('--') ? args[0] : '.';
   const resolved = await resolveRepoPath(repoPath);
   const configDir = path.join(resolved, SEAMGUARD_DIR);

   await fs.mkdir(configDir, { recursive: true });

   const configPath = path.join(configDir, 'seamguard.config.json');
   await writeTextFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');

   const reviewerPath = path.join(configDir, 'reviewer.md');
   await writeTextFile(reviewerPath, getReviewerConstitutionText() + '\n');

   const schemaPath = path.join(configDir, 'finding.schema.json');
   await writeTextFile(schemaPath, JSON.stringify(REVIEW_RESULT_JSON_SCHEMA, null, 2) + '\n');

   defaultLogger.info(`Created ${SEAMGUARD_DIR}/ in ${resolved}`);
   defaultLogger.info(`  - seamguard.config.json`);
   defaultLogger.info(`  - reviewer.md`);
   defaultLogger.info(`  - finding.schema.json`);

   return 0;
}
