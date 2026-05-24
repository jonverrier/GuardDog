/**
 * @module utils/logger
 * Simple stderr/stdout logger for CLI output.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module provides a small, console-backed logger intended for CLI tools. It standardizes four log levels and routes output to stdout or stderr using the built-in Node.js console APIs. LogLevel is a string union of 'info', 'warn', 'error', and 'debug' for consistent level naming. ILogger defines the contract that any logger implementation must follow, with one method per level and a single message string argument. ConsoleLogger implements ILogger and writes info messages via console.log, warnings via console.warn with a "Warning:" prefix, and errors via console.error with an "Error:" prefix. Debug messages are optional and are written to stderr with a "[debug]" prefix only when the GUARDDOG_DEBUG environment variable is set to '1'. The module also exports defaultLogger, a ready-to-use ConsoleLogger instance for simple consumers. Key dependencies are Node’s global console and process.env for debug gating.
// ===End StrongAI Generated Comment===


export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface ILogger {
   info(message: string): void;
   warn(message: string): void;
   error(message: string): void;
   debug(message: string): void;
}

/**
 * Console-backed logger implementation.
 */
export class ConsoleLogger implements ILogger {
   info(message: string): void {
      console.log(message);
   }

   warn(message: string): void {
      console.warn(`Warning: ${message}`);
   }

   error(message: string): void {
      console.error(`Error: ${message}`);
   }

   debug(message: string): void {
      if (process.env.GUARDDOG_DEBUG === '1') {
         console.error(`[debug] ${message}`);
      }
   }
}

export const defaultLogger = new ConsoleLogger();
