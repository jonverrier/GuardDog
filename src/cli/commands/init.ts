/**
 * @module cli/commands/init
 * `guarddog init` command — scaffolds `.guarddog/` configuration.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module implements the `guarddog init` CLI command. It scaffolds a standard `.guarddog/` directory inside a target repository and writes the initial configuration files needed to run Guarddog. The main export is `runInitCommand(args)`, an async function that determines the repo path (first non-flag argument, defaulting to `.`), resolves it to an absolute repository root, and then creates `.guarddog/` if it does not exist. It writes three files: `guarddog.config.json` containing `DEFAULT_CONFIG`, `reviewer.md` containing the reviewer “constitution” text from `getReviewerConstitutionText`, and `finding.schema.json` containing `REVIEW_RESULT_JSON_SCHEMA` for findings validation. It uses Node’s `path` for joining paths and `fs/promises` for directory creation. File writing and repository resolution are delegated to `writeTextFile` and `resolveRepoPath` utilities. Progress and created filenames are reported via `defaultLogger`. The function returns exit code 0 on success.
// ===End StrongAI Generated Comment===


import * as path from 'path';
import * as fs from 'fs/promises';
import { DEFAULT_CONFIG } from '../../schemas/config';
import { getReviewerConstitutionText } from '../../core/promptFactory';
import { REVIEW_RESULT_JSON_SCHEMA } from '../../schemas/finding';
import { resolveRepoPath, writeTextFile } from '../../utils/fileSystem';
import { defaultLogger } from '../../utils/logger';

const GUARDDOG_DIR = '.guarddog';

/**
 * Creates `.guarddog/` configuration scaffolding in a repository.
 * @param args - Arguments after `init`
 * @returns Process exit code
 */
export async function runInitCommand(args: string[]): Promise<number> {
   const repoPath = args[0] && !args[0].startsWith('--') ? args[0] : '.';
   const resolved = await resolveRepoPath(repoPath);
   const configDir = path.join(resolved, GUARDDOG_DIR);

   await fs.mkdir(configDir, { recursive: true });

   const configPath = path.join(configDir, 'guarddog.config.json');
   await writeTextFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n');

   const reviewerPath = path.join(configDir, 'reviewer.md');
   await writeTextFile(reviewerPath, getReviewerConstitutionText() + '\n');

   const schemaPath = path.join(configDir, 'finding.schema.json');
   await writeTextFile(schemaPath, JSON.stringify(REVIEW_RESULT_JSON_SCHEMA, null, 2) + '\n');

   defaultLogger.info(`Created ${GUARDDOG_DIR}/ in ${resolved}`);
   defaultLogger.info(`  - guarddog.config.json`);
   defaultLogger.info(`  - reviewer.md`);
   defaultLogger.info(`  - finding.schema.json`);

   return 0;
}
