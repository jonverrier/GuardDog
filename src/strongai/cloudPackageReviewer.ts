/**
 * @module strongai/cloudPackageReviewer
 * Launches Cursor cloud agents to GuardDog-review StrongAI platform packages.
 */
// Copyright (c) 2025 Jon Verrier

import {
   DEFAULT_CURSOR_MODEL,
   DEFAULT_GUARDDOG_REPO_URL,
   DEFAULT_GUARDDOG_STARTING_REF,
   DEFAULT_STRONGAI_REPO_URL,
   DEFAULT_STRONGAI_STARTING_REF,
   IStrongAiCloudReviewPayload,
   IStrongAiIssueDraft,
   IStrongAiPlatformTarget
} from '../schemas/strongAiPlatforms';
import { IReviewResult } from '../schemas/finding';
import { ConnectionError, InvalidStateError } from '../utils/errors';
import { ILogger, defaultLogger } from '../utils/logger';
import { parseCloudReviewPayload } from './cloudAgentPayload';
import { renderStrongAiIssue } from './strongAiIssueRenderer';
import { assertValidStrongAiIssueMarkdown } from './strongAiIssueValidator';

export interface ICloudPackageReviewerOptions {
   targets: readonly IStrongAiPlatformTarget[];
   apiKey: string;
   openAiApiKey: string;
   model?: string;
   strongAiRepoUrl?: string;
   guardDogRepoUrl?: string;
   strongAiStartingRef?: string;
   guardDogStartingRef?: string;
   nodeAuthToken?: string;
   /** When true, prefer local re-render from reviewJson over agent issueMarkdown. */
   preferLocalIssueRender?: boolean;
}

export interface ICloudPackageReviewRunResult {
   drafts: IStrongAiIssueDraft[];
   payloads: IStrongAiCloudReviewPayload[];
}

/**
 * Runs one cloud agent per platform package target and collects issue drafts.
 * @param options - Cloud review options
 * @param logger - Logger
 */
export async function reviewStrongAiPackagesWithCloudAgents(
   options: ICloudPackageReviewerOptions,
   logger: ILogger = defaultLogger
): Promise<ICloudPackageReviewRunResult> {
   if (!options.apiKey) {
      throw new InvalidStateError('CURSOR_API_KEY is required to launch cloud agents.');
   }
   if (!options.openAiApiKey) {
      throw new InvalidStateError(
         'OPENAI_API_KEY is required so cloud agents can run GuardDog LLM reviews.'
      );
   }
   if (options.targets.length === 0) {
      throw new InvalidStateError('At least one StrongAI platform target is required.');
   }

   const { Agent, CursorAgentError } = await import('@cursor/sdk');
   const drafts: IStrongAiIssueDraft[] = [];
   const payloads: IStrongAiCloudReviewPayload[] = [];

   for (const target of options.targets) {
      logger.info(`Launching cloud agent for ${target.id} (${target.packagePath})...`);
      const envVars: Record<string, string> = {
         OPENAI_API_KEY: options.openAiApiKey
      };
      if (options.nodeAuthToken) {
         envVars.NODE_AUTH_TOKEN = options.nodeAuthToken;
      }

      let agent: { agentId: string; close: () => void; [Symbol.asyncDispose]?: () => PromiseLike<void> } | undefined;
      try {
         agent = await Agent.create({
            apiKey: options.apiKey,
            model: { id: options.model ?? DEFAULT_CURSOR_MODEL },
            cloud: {
               repos: [
                  {
                     url: options.strongAiRepoUrl ?? DEFAULT_STRONGAI_REPO_URL,
                     startingRef: options.strongAiStartingRef ?? DEFAULT_STRONGAI_STARTING_REF
                  },
                  {
                     url: options.guardDogRepoUrl ?? DEFAULT_GUARDDOG_REPO_URL,
                     startingRef: options.guardDogStartingRef ?? DEFAULT_GUARDDOG_STARTING_REF
                  }
               ],
               envVars,
               autoCreatePR: false,
               skipReviewerRequest: true
            }
         });

         logger.info(`Cloud agent started: ${agent.agentId} (${target.id})`);
         const run = await (
            agent as unknown as {
               send: (prompt: string) => Promise<{
                  id: string;
                  wait: () => Promise<{
                     status: string;
                     result?: string;
                     error?: { message?: string };
                     id: string;
                  }>;
               }>;
            }
         ).send(buildCloudAgentPrompt(target));

         logger.info(`Cloud run started: ${run.id} (${target.id})`);
         const result = await run.wait();
         if (result.status === 'error') {
            throw new ConnectionError(
               `Cloud run failed for ${target.id} (${run.id}): ${result.error?.message ?? 'unknown error'}`
            );
         }
         if (result.status === 'cancelled') {
            throw new ConnectionError(`Cloud run cancelled for ${target.id} (${run.id}).`);
         }

         const finalText = result.result ?? '';
         let payload = parseCloudReviewPayload(finalText, target);

         // Prefer artifact JSON if the agent also wrote a known payload file.
         const artifactPayload = await tryLoadArtifactPayload(
            agent as unknown as {
               listArtifacts?: () => Promise<Array<{ path: string }>>;
               downloadArtifact?: (path: string) => Promise<Buffer>;
            },
            target,
            logger
         );
         if (artifactPayload) {
            payload = artifactPayload;
         }

         const draft = buildIssueDraft(target, payload, options.preferLocalIssueRender === true, {
            agentId: agent.agentId,
            runId: run.id
         });
         assertValidStrongAiIssueMarkdown(draft.markdown, draft.fileName);
         drafts.push(draft);
         payloads.push(payload);
         logger.info(
            `Cloud review complete for ${target.id}: ${payload.reviewSummary.findingCount} finding(s), risk ${payload.reviewSummary.overallRisk}.`
         );
      } catch (error) {
         if (error instanceof CursorAgentError) {
            throw new ConnectionError(
               `Failed to start cloud agent for ${target.id}: ${error.message}`
            );
         }
         throw error;
      } finally {
         if (agent) {
            await disposeAgent(agent);
         }
      }
   }

   return { drafts, payloads };
}

function buildCloudAgentPrompt(target: IStrongAiPlatformTarget): string {
   return [
      'You are running an unattended GuardDog architecture review for one StrongAI package.',
      'Do not open a pull request. Do not create GitHub issues yourself.',
      '',
      '## Workspace',
      '- The VM contains clones of StrongAI and GuardDog (sibling directories; names may vary).',
      '- Locate both repositories first (look for package.json name "strongai" and "@jonverrier/guard-dog").',
      '',
      '## Task',
      `1. In the GuardDog clone: npm install && npm run build`,
      '   - If private @jonverrier packages need auth, NODE_AUTH_TOKEN / OPENAI_API_KEY are already in the environment.',
      `2. Run GuardDog against ONLY this package path inside StrongAI:`,
      '```bash',
      `node <guarddog>/dist/cli/index.js review <strongai>/${target.packagePath} \\`,
      `  --design ${target.designFile} \\`,
      `  --out ./guarddog-review-${target.id}.md \\`,
      `  --json ./guarddog-review-${target.id}.json \\`,
      '  --no-github',
      '```',
      '3. Read the JSON review output.',
      '4. Produce a StrongAI inbox issue markdown body using this exact header shape:',
      '```markdown',
      '**Status:** open',
      '**Type:** proposal',
      '**GitHub:** _(added by `tools/build/scripts/sync-issues-to-github.sh` after first sync)_',
      '**Superseded by:** _(leave empty until promoted to `features/NNNN-...`; then set path and change **Status** to `superseded`, **Type** to `pointer`)_',
      '',
      `# GuardDog architecture review: ${target.id}`,
      '',
      '## Summary',
      '...',
      '## Scope',
      `- **Packages:** \`${target.packagePath}\` (${target.displayName})`,
      '## Proposed improvements',
      '... one subsection per finding ...',
      '## Acceptance criteria',
      '- [ ] Triage each finding',
      '- [ ] Follow up with PRs or promote to features/ as needed',
      '- [ ] Re-run GuardDog after remediations',
      '## Notes',
      '...',
      '```',
      '5. Write the structured payload JSON to `guarddog-strongai-payload.json` in the workspace.',
      '6. End your final message with ONLY a single fenced ```json block containing that same payload.',
      '',
      '## Required JSON schema',
      '```json',
      JSON.stringify(
         {
            packageId: target.id,
            issueSlug: target.issueSlug,
            issueTitle: `GuardDog architecture review: ${target.id}`,
            issueMarkdown: '...full StrongAI issue markdown...',
            reviewSummary: {
               overallRisk: 'medium',
               findingCount: 0,
               highSeverityCount: 0,
               criticalSeverityCount: 0,
               mainThemes: []
            },
            reviewJson: { tool: 'GuardDog', summary: {}, findings: [] },
            agentNotes: 'optional'
         },
         null,
         2
      ),
      '```',
      '',
      'Constraints:',
      `- packageId MUST be "${target.id}"`,
      `- issueSlug MUST be "${target.issueSlug}"`,
      '- issueMarkdown MUST include Status/Type/GitHub/Superseded by headers and an H1 title',
      '- One issue for this package only; do not review other packages'
   ].join('\n');
}

async function tryLoadArtifactPayload(
   agent: {
      listArtifacts?: () => Promise<Array<{ path: string }>>;
      downloadArtifact?: (path: string) => Promise<Buffer>;
   },
   target: IStrongAiPlatformTarget,
   logger: ILogger
): Promise<IStrongAiCloudReviewPayload | undefined> {
   if (!agent.listArtifacts || !agent.downloadArtifact) {
      return undefined;
   }
   try {
      const artifacts = await agent.listArtifacts();
      const match = artifacts.find(
         (artifact) =>
            artifact.path.endsWith('guarddog-strongai-payload.json') ||
            artifact.path.includes('guarddog-strongai-payload')
      );
      if (!match) {
         return undefined;
      }
      const buffer = await agent.downloadArtifact(match.path);
      const text = buffer.toString('utf8');
      return parseCloudReviewPayload(text, target);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.info(`Artifact payload unavailable for ${target.id}: ${message}`);
      return undefined;
   }
}

function buildIssueDraft(
   target: IStrongAiPlatformTarget,
   payload: IStrongAiCloudReviewPayload,
   preferLocalIssueRender: boolean,
   ids: { agentId: string; runId: string }
): IStrongAiIssueDraft {
   if (preferLocalIssueRender && isReviewResult(payload.reviewJson)) {
      const rendered = renderStrongAiIssue(target, payload.reviewJson);
      return {
         target,
         fileName: rendered.fileName,
         markdown: rendered.markdown,
         title: rendered.title,
         agentId: ids.agentId,
         runId: ids.runId
      };
   }

   return {
      target,
      fileName: `${target.issueSlug}.md`,
      markdown: ensureTrailingNewline(payload.issueMarkdown),
      title: payload.issueTitle,
      agentId: ids.agentId,
      runId: ids.runId
   };
}

function isReviewResult(value: unknown): value is IReviewResult {
   if (!value || typeof value !== 'object') {
      return false;
   }
   const obj = value as Record<string, unknown>;
   return obj.tool === 'GuardDog' && Array.isArray(obj.findings) && typeof obj.summary === 'object';
}

function ensureTrailingNewline(markdown: string): string {
   return markdown.endsWith('\n') ? markdown : `${markdown}\n`;
}

async function disposeAgent(agent: {
   close: () => void;
   [Symbol.asyncDispose]?: () => PromiseLike<void>;
}): Promise<void> {
   if (typeof agent[Symbol.asyncDispose] === 'function') {
      await agent[Symbol.asyncDispose]!();
      return;
   }
   agent.close();
}
