/**
 * @module core/promptFactory
 * Production wiring for PromptRepository prompt storage.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module wires up production prompt storage for GuardDog by creating a prompt repository backed by the bundled Prompts.json file. It provides a simple factory so the rest of the app can access prompts through a common IPromptRepository interface without knowing the storage details.
// 
// createPromptRepository constructs a PromptInMemoryRepository from @jonverrier/prompt-repository and seeds it with the typedPrompts loaded from Prompts.json (cast to IPrompt[]). This is the default repository used by other functions when no repository is supplied.
// 
// getReviewerConstitutionText reads the system prompt text for the architecture review prompt. It looks up the prompt by architectureReviewPromptId and returns its systemPrompt field. This value is used by the guarddog init command to scaffold .guarddog/reviewer.md. If the prompt is missing or does not contain a systemPrompt, the function throws InvalidOperationError to clearly signal a misconfigured or incomplete Prompts.json bundle.
// ===End StrongAI Generated Comment===


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
