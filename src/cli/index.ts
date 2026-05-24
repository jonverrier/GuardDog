#!/usr/bin/env node
/**
 * @module cli/index
 * GuardDog CLI entry point.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// GuardDog CLI entry point. This module is the executable that parses command-line arguments, prints usage help, and dispatches to subcommands. It reads process.argv, supports --help/-h, and exits with explicit status codes for success or failure.
// 
// The main runtime behavior is implemented in the internal async main() function, which selects the first argument as the command name. For the review command, it forwards remaining arguments to runReviewCommand and exits with its returned exit code. For the init command, it forwards arguments to runInitCommand and exits similarly. If the command is unrecognized, it throws an InvalidParameterError.
// 
// Error handling is centralized. Known GuardDogError instances are rendered as a user-friendly “Error:” message and terminate with exit code 1. Unexpected errors are rethrown and ultimately caught by the final main().catch handler, which prints a “Fatal:” message and exits 1.
// 
// Key dependencies are runReviewCommand and runInitCommand for command implementations, and InvalidParameterError/GuardDogError for consistent error typing and messaging.
// ===End StrongAI Generated Comment===


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
  --context-token-budget <n>   Source file token budget (default: 32000)
  --c4-token-budget <n>        C4 doc token budget for review (default: 12000)
  --design-token-budget <n>    Design file token budget (default: 4000)
  --ranker-c4-token-budget <n> C4 doc budget for ContextRanker (default: same as c4)
  --max-file-tokens <n>        Per-file token cap (default: 4096)
  --component-file <name>      C4 component doc basename
  --context-file <name>        C4 context doc basename
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
