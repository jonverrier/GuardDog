/**
 * @module core/configLoader
 * Loads and merges configuration from defaults, file, and CLI flags.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Loads and resolves GuardDog configuration by combining built-in defaults, an optional repo config file, and CLI flag overrides. The config file is expected at the repository root under the default config filename and is parsed as JSON; missing files produce an empty override, and invalid JSON triggers a parameter error.
// 
// Exports loadConfigFile(repoPath), which reads the config file using a safe file helper and returns a partial config object. Exports loadConfig(repoPath, cliOptions), which merges DEFAULT_CONFIG with file overrides (including a nested merge for the github section), then applies CLI options to override fields such as design/output paths, JSON output toggle, model, finding thresholds, token budgets, and GitHub issue settings. It validates minSeverity and minImpact against the allowed levels.
// 
// Also exports parseSeverity and parseImpact to normalize and validate user-provided threshold strings into FindingSeverity/FindingImpact values.
// 
// Key dependencies include Node path joining, schema constants and types from ../schemas/config and ../schemas/finding, readTextFileIfExists for I/O, and InvalidParameterError for consistent validation failures.
// ===End StrongAI Generated Comment===


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
   if (cliOptions.contextTokenBudget !== undefined) {
      merged.contextTokenBudget = cliOptions.contextTokenBudget;
   }
   if (cliOptions.c4TokenBudget !== undefined) {
      merged.c4TokenBudget = cliOptions.c4TokenBudget;
   }
   if (cliOptions.designTokenBudget !== undefined) {
      merged.designTokenBudget = cliOptions.designTokenBudget;
   }
   if (cliOptions.rankerC4TokenBudget !== undefined) {
      merged.rankerC4TokenBudget = cliOptions.rankerC4TokenBudget;
   }
   if (cliOptions.maxFileTokens !== undefined) {
      merged.maxFileTokens = cliOptions.maxFileTokens;
   }
   if (cliOptions.componentFile) {
      merged.componentFile = cliOptions.componentFile;
   }
   if (cliOptions.contextFile) {
      merged.contextFile = cliOptions.contextFile;
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
