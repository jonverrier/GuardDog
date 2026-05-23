#!/usr/bin/env node
/**
 * @module cli/index
 * GuardDog CLI entry point.
 */
// Copyright (c) 2025 Jon Verrier

import { runReviewCommand } from './commands/review';
import { runInitCommand } from './commands/init';
import { InvalidParameterError, GuardDogError } from '../utils/errors';

const USAGE = `GuardDog — Architecture Review CLI

Usage:
  guarddog review <repoPath> [options]
  guarddog init [repoPath]

Review options:
  --design <path>              Architecture intent / design file
  --out <path>                 Markdown output path
  --json <path>                JSON output path
  --min-severity <level>       low | medium | high | critical
  --min-impact <level>         low | medium | high | critical
  --max-findings <number>      Limit number of findings
  --dry-run                    Do not write external side effects
  --github-issue               Create GitHub issue
  --repo <owner/name>          GitHub repo target
  --issue-mode single|per-finding
  --model <model-name>         LLM model name
  --no-github                  Disable GitHub integration
  --confirm                    Confirm GitHub issue creation

Examples:
  guarddog review . --design DESIGN.md --out review.md --json review.json
  guarddog review . --design DESIGN.md --github-issue --repo owner/repo --confirm
  guarddog init
`;

async function main(): Promise<void> {
   const args = process.argv.slice(2);
   if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      console.log(USAGE);
      process.exit(0);
   }

   const command = args[0];

   try {
      if (command === 'review') {
         const exitCode = await runReviewCommand(args.slice(1));
         process.exit(exitCode);
      }
      if (command === 'init') {
         const exitCode = await runInitCommand(args.slice(1));
         process.exit(exitCode);
      }
      throw new InvalidParameterError(`Unknown command: ${command}`);
   } catch (error) {
      if (error instanceof GuardDogError) {
         console.error(`Error: ${error.message}`);
         process.exit(1);
      }
      throw error;
   }
}

main().catch((error: unknown) => {
   const message = error instanceof Error ? error.message : String(error);
   console.error(`Fatal: ${message}`);
   process.exit(1);
});
