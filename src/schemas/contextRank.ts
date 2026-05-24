/**
 * @module schemas/contextRank
 * Types and JSON schema for LLM context file ranking.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module defines the core types and JSON schema used to represent the output of an LLM-driven context file ranking step. It provides small, stable interfaces that other parts of the system can use to describe candidate files and to exchange ranking results in a predictable shape.
// 
// IFileIndexEntry describes a single file that may be considered for inclusion in context. It captures the file path, its extension, and its size in bytes, which are common inputs for ranking or filtering.
// 
// IContextRankResult describes the ranking result as an ordered list of file paths in rankedPaths. Higher-priority files should appear earlier in the array.
// 
// CONTEXT_RANK_JSON_SCHEMA is a strict JSON Schema object that validates the result payload. It requires rankedPaths, enforces an object root, disallows extra properties, and constrains rankedPaths to an array of strings.
// 
// DEFAULT_CONTEXT_RANK_RESULT provides an empty, safe default result.
// 
// The module has no imported dependencies and relies only on built-in TypeScript and plain JSON schema conventions.
// ===End StrongAI Generated Comment===


export interface IFileIndexEntry {
   path: string;
   extension: string;
   sizeBytes: number;
}

export interface IContextRankResult {
   rankedPaths: string[];
}

export const CONTEXT_RANK_JSON_SCHEMA: Record<string, unknown> = {
   type: 'object',
   additionalProperties: false,
   required: ['rankedPaths'],
   properties: {
      rankedPaths: {
         type: 'array',
         items: { type: 'string' }
      }
   }
};

export const DEFAULT_CONTEXT_RANK_RESULT: IContextRankResult = {
   rankedPaths: []
};
