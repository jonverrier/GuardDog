/**
 * @module utils/logger
 * Simple stderr/stdout logger for CLI output.
 */
// Copyright (c) 2025 Jon Verrier

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
