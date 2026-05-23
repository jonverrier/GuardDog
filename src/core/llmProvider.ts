/**
 * @module core/llmProvider
 * LLM provider abstraction backed by PromptRepository.
 */
// Copyright (c) 2025 Jon Verrier

import {
   ChatDriverFactory,
   EModel,
   EModelProvider,
   EVerbosity,
   IChatDriver,
   IPromptRepository,
   InvalidOperationError as PromptInvalidOperationError
} from '@jonverrier/prompt-repository';
import {
   DEFAULT_REVIEW_RESULT,
   IReviewResult,
   REVIEW_RESULT_JSON_SCHEMA
} from '../schemas/finding';
import { architectureReviewPromptId } from '../PromptIds';
import { createPromptRepository } from './promptFactory';
import { IReviewPromptParams } from './reviewPromptBuilder';
import { InvalidOperationError, InvalidStateError } from '../utils/errors';

/**
 * Simple LLM provider interface for architecture review.
 */
export interface ILlmProvider {
   complete(prompt: string): Promise<string>;
}

/**
 * PromptRepository-backed provider using prompt templates and constrained JSON output.
 */
export class PromptRepositoryLlmProvider implements ILlmProvider {
   private readonly chatDriver: IChatDriver;
   private readonly promptRepo: IPromptRepository;

   constructor(chatDriver?: IChatDriver, promptRepo?: IPromptRepository) {
      this.chatDriver = chatDriver ?? new ChatDriverFactory().create(EModel.kLarge, EModelProvider.kOpenAI);
      this.promptRepo = promptRepo ?? createPromptRepository();
   }

   /**
    * Returns raw JSON string from constrained model response.
    * @param params - Template parameters for the ArchitectureReview prompt
    */
   async completeFromParams(params: IReviewPromptParams): Promise<string> {
      const result = await this.getStructuredReview(params);
      return JSON.stringify(result);
   }

   /**
    * @deprecated Use completeFromParams — retained for interface compatibility.
    */
   async complete(prompt: string): Promise<string> {
      return this.completeFromParams({
         architectureIntent: prompt,
         repoMap: '{}',
         contextFilesSection: '',
         sampledReviewNote: ''
      });
   }

   /**
    * Loads the ArchitectureReview prompt, expands templates, and returns structured JSON.
    * @param params - Runtime values for prompt template placeholders
    */
   async getStructuredReview(params: IReviewPromptParams): Promise<IReviewResult> {
      if (!process.env.OPENAI_API_KEY) {
         throw new InvalidStateError(
            'OPENAI_API_KEY environment variable is required for LLM review.'
         );
      }

      const prompt = this.promptRepo.getPrompt(architectureReviewPromptId);
      if (!prompt) {
         throw new InvalidOperationError(
            `Prompt not found: ${architectureReviewPromptId}. Check Prompts.json.`
         );
      }

      const systemPrompt = this.promptRepo.expandSystemPrompt(prompt, {});
      const userPrompt = this.promptRepo.expandUserPrompt(prompt, {
         architectureIntent: params.architectureIntent,
         repoMap: params.repoMap,
         contextFilesSection: params.contextFilesSection,
         sampledReviewNote: params.sampledReviewNote
      });

      const result = await this.chatDriver.getConstrainedModelResponse<IReviewResult>(
         systemPrompt,
         userPrompt,
         EVerbosity.kMedium,
         REVIEW_RESULT_JSON_SCHEMA,
         { ...DEFAULT_REVIEW_RESULT, generatedAt: new Date(0).toISOString() },
         [],
         []
      );

      if (!result || result.tool !== 'SeamGuard') {
         throw new InvalidOperationError('LLM returned an invalid or empty review result.');
      }

      return result;
   }
}

/**
 * Creates the default production LLM provider.
 */
export function createDefaultLlmProvider(): PromptRepositoryLlmProvider {
   return new PromptRepositoryLlmProvider();
}

export { PromptInvalidOperationError };
