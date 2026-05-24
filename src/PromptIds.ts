/**
 * @module PromptIds
 * UUID constants identifying each LLM prompt used by GuardDog.
 * These IDs correspond to entries in Prompts.json.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module centralizes the stable identifiers for the LLM prompts used by GuardDog. It defines UUID constants that are used to select the correct prompt template from Prompts.json at runtime. Keeping these IDs in one place avoids duplication, prevents mismatches across the codebase, and makes prompt updates easier to manage and review.
// 
// Exports:
// - architectureReviewPromptId: The UUID for the prompt that performs an evolutionary architecture review and returns structured GuardDog findings. Use this when invoking the model for architecture assessment output that the rest of the system can parse consistently.
// - contextRankerPromptId: The UUID for the prompt that ranks source files by architectural importance, using C4 documentation as context. Use this when you need the model to prioritize files for analysis or review.
// 
// This module has no imported dependencies and provides only constants. The primary external dependency is the presence of matching entries in Prompts.json.
// ===End StrongAI Generated Comment===


/** Prompt for evolutionary architecture review with structured GuardDog findings. */
export const architectureReviewPromptId = 'f1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6071';

/** Prompt for ranking source files by architectural importance using C4 docs. */
export const contextRankerPromptId = 'a2b3c4d5-6e7f-8091-a2b3-4c5d6e7f8092';
