/**
 * @module github/githubClient
 * GitHub REST API client for creating architecture review issues.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module provides a small GitHub REST API client for turning rendered issue drafts into real GitHub issues, aimed at creating architecture review issues in a repository. The main export is createGitHubIssues(repo, drafts, confirm, logger), which validates the repo string is in owner/name form, supports a dry-run mode that logs each draft’s title, labels, and body, and otherwise creates issues via the GitHub Issues API. When creating issues, it requires a GITHUB_TOKEN environment variable and logs the created issue number and URL, returning an array of results containing number, htmlUrl, and title. Drafts are defined by IIssueDraft from the issueRenderer module (title, body, labels). Logging uses ILogger and defaultLogger from the logger utility. Error handling relies on custom error types from utils/errors: InvalidParameterError for bad input, InvalidStateError for missing token, and ConnectionError for network/API failures, including a fallback that retries without labels when GitHub rejects unknown labels.
// ===End StrongAI Generated Comment===


import { ConnectionError, InvalidParameterError, InvalidStateError } from '../utils/errors';
import { IIssueDraft } from './issueRenderer';
import { ILogger, defaultLogger } from '../utils/logger';

const GITHUB_API_BASE = 'https://api.github.com';

export interface IGitHubIssueResult {
   number: number;
   htmlUrl: string;
   title: string;
}

/**
 * Creates GitHub issues from drafts.
 * @param repo - owner/name format
 * @param drafts - Issue drafts to create
 * @param confirm - When false, only prints drafts (dry-run)
 * @param logger - Logger instance
 */
export async function createGitHubIssues(
   repo: string,
   drafts: IIssueDraft[],
   confirm: boolean,
   logger: ILogger = defaultLogger
): Promise<IGitHubIssueResult[]> {
   if (!repo || !repo.includes('/')) {
      throw new InvalidParameterError('--repo must be in owner/name format.');
   }

   if (!confirm) {
      for (const draft of drafts) {
         logger.info('--- GitHub Issue (dry-run) ---');
         logger.info(`Title: ${draft.title}`);
         logger.info(`Labels: ${draft.labels.join(', ')}`);
         logger.info('Body:');
         logger.info(draft.body);
         logger.info('---');
      }
      return [];
   }

   const token = process.env.GITHUB_TOKEN;
   if (!token) {
      throw new InvalidStateError(
         'GITHUB_TOKEN environment variable is required to create GitHub issues.'
      );
   }

   const results: IGitHubIssueResult[] = [];
   for (const draft of drafts) {
      const created = await createIssue(repo, draft, token);
      results.push(created);
      logger.info(`Created issue #${created.number}: ${created.htmlUrl}`);
   }
   return results;
}

async function createIssue(
   repo: string,
   draft: IIssueDraft,
   token: string
): Promise<IGitHubIssueResult> {
   const url = `${GITHUB_API_BASE}/repos/${repo}/issues`;
   let response: Response;
   try {
      response = await fetch(url, {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
         },
         body: JSON.stringify({
            title: draft.title,
            body: draft.body,
            labels: draft.labels
         })
      });
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ConnectionError(`Failed to connect to GitHub API: ${message}`);
   }

   if (!response.ok) {
      const body = await response.text();
      if (response.status === 422 && body.includes('label')) {
         return createIssueWithoutLabels(repo, draft, token);
      }
      throw new ConnectionError(`GitHub API error (${response.status}): ${body}`);
   }

   const data = (await response.json()) as { number: number; html_url: string; title: string };
   return { number: data.number, htmlUrl: data.html_url, title: data.title };
}

async function createIssueWithoutLabels(
   repo: string,
   draft: IIssueDraft,
   token: string
): Promise<IGitHubIssueResult> {
   const url = `${GITHUB_API_BASE}/repos/${repo}/issues`;
   const response = await fetch(url, {
      method: 'POST',
      headers: {
         Authorization: `Bearer ${token}`,
         Accept: 'application/vnd.github+json',
         'Content-Type': 'application/json',
         'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
         title: draft.title,
         body: draft.body
      })
   });

   if (!response.ok) {
      const body = await response.text();
      throw new ConnectionError(`GitHub API error (${response.status}): ${body}`);
   }

   const data = (await response.json()) as { number: number; html_url: string; title: string };
   return { number: data.number, htmlUrl: data.html_url, title: data.title };
}
