/**
 * @module core/promptFactory
 * Production wiring for PromptRepository prompt storage.
 */
// Copyright (c) 2025 Jon Verrier

import { IPrompt, IPromptRepository, PromptInMemoryRepository } from '@jonverrier/prompt-repository';
import typedPrompts from '../Prompts.json';
import { architectureReviewPromptId } from '../PromptIds';
import { InvalidOperationError } from '../utils/errors';

/**
 * Creates a PromptInMemoryRepository seeded with GuardDog prompts.
 */
export function createPromptRepository(): IPromptRepository {
   return new PromptInMemoryRepository(typedPrompts as IPrompt[]);
}

/**
 * Returns the reviewer constitution (system prompt) from Prompts.json.
 * Used by `guarddog init` to scaffold `.guarddog/reviewer.md`.
 */
export function getReviewerConstitutionText(promptRepo: IPromptRepository = createPromptRepository()): string {
   const prompt = promptRepo.getPrompt(architectureReviewPromptId);
   if (!prompt?.systemPrompt) {
      throw new InvalidOperationError('ArchitectureReview prompt systemPrompt not found in Prompts.json');
   }
   return prompt.systemPrompt;
}
