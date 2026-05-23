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
   IChatDriver
} from '@jonverrier/prompt-repository';
import {
   DEFAULT_REVIEW_RESULT,
   IReviewResult,
   REVIEW_RESULT_JSON_SCHEMA
} from '../schemas/finding';
import { InvalidOperationError, InvalidStateError } from '../utils/errors';

/**
 * Simple LLM provider interface for architecture review.
 */
export interface ILlmProvider {
   complete(prompt: string): Promise<string>;
}

/**
 * PromptRepository-backed provider using constrained JSON schema output.
 */
export class PromptRepositoryLlmProvider implements ILlmProvider {
   private readonly chatDriver: IChatDriver;

   constructor(chatDriver?: IChatDriver) {
      this.chatDriver = chatDriver ?? new ChatDriverFactory().create(EModel.kLarge, EModelProvider.kOpenAI);
   }

   /**
    * Returns raw JSON string from constrained model response.
    * @param prompt - Full user prompt (system prompt passed separately)
    */
   async complete(prompt: string): Promise<string> {
      const result = await this.getStructuredReview('', prompt);
      return JSON.stringify(result);
   }

   /**
    * Gets a structured review result using JSON schema constraint.
    * @param systemPrompt - Reviewer constitution
    * @param userPrompt - Review task with context
    */
   async getStructuredReview(systemPrompt: string, userPrompt: string): Promise<IReviewResult> {
      if (!process.env.OPENAI_API_KEY) {
         throw new InvalidStateError(
            'OPENAI_API_KEY environment variable is required for LLM review.'
         );
      }

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
