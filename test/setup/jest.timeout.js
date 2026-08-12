/**
 * Raise the default Jest timeout for GuardDog suites.
 * Node16 + ts-jest hybrid mode can push cold review-pipeline tests past 5s.
 */
// Copyright (c) 2026 Jon Verrier

jest.setTimeout(30000);
