/**
 * @module core/llmProvider
 * LLM provider abstraction backed by PromptRepository.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module provides a small LLM provider abstraction used to generate architecture review results. It defines ILlmProvider with a single complete method for returning a model response as a string. The main implementation is PromptRepositoryLlmProvider, which is backed by a PromptRepository and an IChatDriver. It loads the ArchitectureReview prompt by id, expands system and user prompt templates with IReviewPromptParams, and then calls the chat driver for a constrained, schema-validated JSON response. getStructuredReview returns an IReviewResult object and enforces basic validity (including a required tool value). completeFromParams returns the same result as a raw JSON string, while complete is a deprecated compatibility wrapper that maps a plain prompt into minimal params. The provider checks OPENAI_API_KEY and throws InvalidStateError or InvalidOperationError on missing configuration, missing prompts, or invalid output. Key dependencies include ChatDriverFactory, EModel/EModelProvider, EVerbosity, and schema constants like REVIEW_RESULT_JSON_SCHEMA and DEFAULT_REVIEW_RESULT. It also exports createDefaultLlmProvider and re-exports PromptInvalidOperationError.
// ===End StrongAI Generated Comment===


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
         sampledReviewNote: '',
         contextCoverageNote: ''
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
         {
            ...DEFAULT_REVIEW_RESULT,
            generatedAt: new Date(0).toISOString()
         },
         [],
         []
      );

      if (!result || result.tool !== 'GuardDog') {
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
