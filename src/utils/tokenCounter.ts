/**
 * @module utils/tokenCounter
 * Tiktoken-based token counting for context budget packing.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module provides token counting utilities built on the tiktoken library. It is intended for estimating prompt and context sizes so callers can pack content within a token budget. It defines ITokenEncoder as a small abstraction over tiktoken encoders, which makes it easy to inject a fake encoder in tests while keeping the same encode and free surface.
// 
// resolveEncodingModel picks an encoding model name to use. If no model is provided, it prefers the OPENAI_MODEL environment variable and otherwise falls back to a default. It normalizes common OpenAI model families (gpt-4, gpt-5, o1, o3) to the nearest supported encoding model.
// 
// createTokenEncoder constructs an encoder using tiktoken’s encoding_for_model, and falls back to get_encoding('cl100k_base') when the requested model is not supported.
// 
// countTokens returns the number of tokens for a string using a provided encoder. freeTokenEncoder releases encoder resources. The module also re-exports the Tiktoken type.
// ===End StrongAI Generated Comment===


import { encoding_for_model, get_encoding, Tiktoken } from 'tiktoken';

/** Default encoding model when none is specified. */
const DEFAULT_ENCODING_MODEL = 'gpt-4o';

/**
 * Token encoder interface for test injection.
 */
export interface ITokenEncoder {
   encode(text: string): Uint32Array;
   free(): void;
}

/**
 * Maps a model name to the nearest tiktoken-supported encoding model.
 * @param model - Optional model name from config or environment
 */
export function resolveEncodingModel(model?: string): string {
   if (!model) {
      return process.env.OPENAI_MODEL ?? DEFAULT_ENCODING_MODEL;
   }
   const normalized = model.toLowerCase();
   if (normalized.includes('gpt-4') || normalized.includes('gpt-5') || normalized.includes('o1') || normalized.includes('o3')) {
      return 'gpt-4o';
   }
   return DEFAULT_ENCODING_MODEL;
}

/**
 * Creates a tiktoken encoder for the given model.
 * @param model - Optional model name
 */
export function createTokenEncoder(model?: string): ITokenEncoder {
   const encodingModel = resolveEncodingModel(model);
   try {
      return encoding_for_model(encodingModel as Parameters<typeof encoding_for_model>[0]);
   } catch {
      return get_encoding('cl100k_base');
   }
}

/**
 * Counts tokens in a text string.
 * @param text - Text to count
 * @param encoder - Token encoder instance
 */
export function countTokens(text: string, encoder: ITokenEncoder): number {
   return encoder.encode(text).length;
}

/**
 * Releases tiktoken encoder resources.
 * @param encoder - Token encoder to free
 */
export function freeTokenEncoder(encoder: ITokenEncoder): void {
   encoder.free();
}

export type { Tiktoken };
