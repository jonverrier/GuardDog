/**
 * @module core/configLoader
 * Loads and merges configuration from defaults, file, and CLI flags.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import {
   DEFAULT_CONFIG,
   DEFAULT_CONFIG_FILE,
   IGuardDogConfig,
   IReviewCliOptions
} from '../schemas/config';
import { FindingImpact, FindingSeverity } from '../schemas/finding';
import { readTextFileIfExists } from '../utils/fileSystem';
import { InvalidParameterError } from '../utils/errors';

/**
 * Loads configuration from `.guarddog/guarddog.config.json` if present.
 * @param repoPath - Repository root path
 */
export async function loadConfigFile(repoPath: string): Promise<Partial<IGuardDogConfig>> {
   const configPath = path.join(repoPath, DEFAULT_CONFIG_FILE);
   const content = await readTextFileIfExists(configPath);
   if (!content) {
      return {};
   }
   try {
      return JSON.parse(content) as Partial<IGuardDogConfig>;
   } catch {
      throw new InvalidParameterError(`Invalid JSON in config file: ${configPath}`);
   }
}

/**
 * Merges defaults, config file, and CLI options into a resolved config.
 * @param repoPath - Repository root path
 * @param cliOptions - CLI flag overrides
 */
export async function loadConfig(
   repoPath: string,
   cliOptions: IReviewCliOptions
): Promise<IGuardDogConfig> {
   const fileConfig = await loadConfigFile(repoPath);
   const merged: IGuardDogConfig = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      github: {
         ...DEFAULT_CONFIG.github,
         ...fileConfig.github
      }
   };

   if (cliOptions.design) {
      merged.designFile = cliOptions.design;
   }
   if (cliOptions.out) {
      merged.outputMarkdown = cliOptions.out;
   }
   if (cliOptions.json !== undefined) {
      merged.outputJson = cliOptions.json;
   }
   if (cliOptions.minSeverity) {
      merged.minSeverity = cliOptions.minSeverity;
   }
   if (cliOptions.minImpact) {
      merged.minImpact = cliOptions.minImpact;
   }
   if (cliOptions.maxFindings !== undefined) {
      merged.maxFindings = cliOptions.maxFindings;
   }
   if (cliOptions.model) {
      merged.model = cliOptions.model;
   }
   if (cliOptions.issueMode) {
      merged.github.issueMode = cliOptions.issueMode;
   }
   if (cliOptions.repo) {
      merged.github.repo = cliOptions.repo;
   }
   if (cliOptions.githubIssue) {
      merged.github.enabled = true;
   }
   if (cliOptions.noGithub) {
      merged.github.enabled = false;
   }

   validateSeverity(merged.minSeverity, 'minSeverity');
   validateSeverity(merged.minImpact, 'minImpact');

   return merged;
}

function validateSeverity(value: string, fieldName: string): void {
   const allowed = ['low', 'medium', 'high', 'critical'];
   if (!allowed.includes(value)) {
      throw new InvalidParameterError(
         `Invalid ${fieldName}: ${value}. Expected one of: ${allowed.join(', ')}`
      );
   }
}

export function parseSeverity(value: string | undefined): FindingSeverity | undefined {
   if (!value) {
      return undefined;
   }
   const normalized = value.toLowerCase();
   if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
      return normalized as FindingSeverity;
   }
   throw new InvalidParameterError(`Invalid severity level: ${value}`);
}

export function parseImpact(value: string | undefined): FindingImpact | undefined {
   return parseSeverity(value) as FindingImpact | undefined;
}
