/**
 * @module cli/commands/review
 * `guarddog review` command implementation.
 */
// Copyright (c) 2025 Jon Verrier

import { runReview } from '../../core/reviewer';
import { loadConfig } from '../../core/configLoader';
import { parseImpact, parseSeverity } from '../../core/configLoader';
import { createGitHubIssues } from '../../github/githubClient';
import { renderPerFindingIssues, renderSingleIssue } from '../../github/issueRenderer';
import { IReviewCliOptions, IssueMode } from '../../schemas/config';
import { resolveRepoPath } from '../../utils/fileSystem';
import { defaultLogger } from '../../utils/logger';
import { InvalidParameterError } from '../../utils/errors';

/**
 * Parses CLI arguments and runs the review command.
 * @param args - Arguments after `review`
 * @returns Process exit code
 */
export async function runReviewCommand(args: string[]): Promise<number> {
   const { repoPath, options } = parseReviewArgs(args);
   await resolveRepoPath(repoPath);

   const reviewResult = await runReview({ ...options, repoPath }, defaultLogger);
   const config = await loadConfig(repoPath, { ...options, repoPath });

   if (config.github.enabled) {
      const confirm = options.confirm === true;
      const repo = config.github.repo;
      if (!repo) {
         throw new InvalidParameterError('--repo owner/name is required with --github-issue.');
      }

      const drafts =
         config.github.issueMode === 'per-finding'
            ? renderPerFindingIssues(reviewResult.result)
            : [renderSingleIssue(reviewResult.result)];

      await createGitHubIssues(repo, drafts, confirm, defaultLogger);
   }

   defaultLogger.info(
      `Review complete: ${reviewResult.result.summary.findingCount} finding(s), overall risk ${reviewResult.result.summary.overallRisk}.`
   );
   return 0;
}

function parseReviewArgs(args: string[]): { repoPath: string; options: IReviewCliOptions } {
   if (args.length === 0 || args[0].startsWith('--')) {
      throw new InvalidParameterError('review requires a <repoPath> argument.');
   }

   const repoPath = args[0];
   const options: IReviewCliOptions = { repoPath };

   for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
         case '--design':
            options.design = requireNext(args, ++i, '--design');
            break;
         case '--out':
            options.out = requireNext(args, ++i, '--out');
            break;
         case '--json':
            options.json = requireNext(args, ++i, '--json');
            break;
         case '--min-severity':
            options.minSeverity = parseSeverity(requireNext(args, ++i, '--min-severity'));
            break;
         case '--min-impact':
            options.minImpact = parseImpact(requireNext(args, ++i, '--min-impact'));
            break;
         case '--max-findings':
            options.maxFindings = parseInt(requireNext(args, ++i, '--max-findings'), 10);
            break;
         case '--repo':
            options.repo = requireNext(args, ++i, '--repo');
            break;
         case '--issue-mode':
            options.issueMode = parseIssueMode(requireNext(args, ++i, '--issue-mode'));
            break;
         case '--model':
            options.model = requireNext(args, ++i, '--model');
            break;
         case '--dry-run':
            options.dryRun = true;
            break;
         case '--github-issue':
            options.githubIssue = true;
            break;
         case '--no-github':
            options.noGithub = true;
            break;
         case '--confirm':
            options.confirm = true;
            break;
         default:
            throw new InvalidParameterError(`Unknown option: ${arg}`);
      }
   }

   return { repoPath, options };
}

function requireNext(args: string[], index: number, flag: string): string {
   const value = args[index];
   if (!value || value.startsWith('--')) {
      throw new InvalidParameterError(`${flag} requires a value.`);
   }
   return value;
}

function parseIssueMode(value: string): IssueMode {
   if (value === 'single' || value === 'per-finding') {
      return value;
   }
   throw new InvalidParameterError(`Invalid issue mode: ${value}. Expected single or per-finding.`);
}
