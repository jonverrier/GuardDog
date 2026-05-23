/**
 * @module utils/errors
 * GuardDog-specific error classes.
 */
// Copyright (c) 2025 Jon Verrier

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
