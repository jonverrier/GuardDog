/**
 * @module utils/errors
 * GuardDog-specific error classes.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module defines the core error types used across GuardDog. It provides a small hierarchy of custom Error subclasses so callers can throw and catch failures consistently and distinguish between common failure categories.
// 
// GuardDogError is the base class for all GuardDog-specific errors. It extends the built-in Error and sets a stable name value so error instances can be identified reliably at runtime and in logs.
// 
// InvalidParameterError represents bad arguments or invalid input values supplied to an API. InvalidOperationError is used when an action is not allowed given the current context or lifecycle step. InvalidStateError indicates missing or inconsistent state, typically due to absent required configuration or initialization. ConnectionError represents failures talking to external services, networks, or remote APIs.
// 
// The module has no external imports. It relies only on JavaScript’s built-in Error behavior, adding a consistent naming convention and typed classes for clearer error handling.
// ===End StrongAI Generated Comment===


/** Base class for GuardDog errors. */
export class GuardDogError extends Error {
   constructor(message: string) {
      super(message);
      this.name = 'GuardDogError';
   }
}

/** Thrown when a parameter or input value is invalid. */
export class InvalidParameterError extends GuardDogError {
   constructor(message: string) {
      super(message);
      this.name = 'InvalidParameterError';
   }
}

/** Thrown when an operation cannot be completed in the current state. */
export class InvalidOperationError extends GuardDogError {
   constructor(message: string) {
      super(message);
      this.name = 'InvalidOperationError';
   }
}

/** Thrown when a required configuration value is missing. */
export class InvalidStateError extends GuardDogError {
   constructor(message: string) {
      super(message);
      this.name = 'InvalidStateError';
   }
}

/** Thrown when an external connection or API call fails. */
export class ConnectionError extends GuardDogError {
   constructor(message: string) {
      super(message);
      this.name = 'ConnectionError';
   }
}
