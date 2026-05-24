/**
 * @module schemas/repoMap
 * Types for lightweight factual repository maps.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// Defines lightweight schema types used to describe a repository in a factual, tool-friendly way. The module is intended for building “repo maps” that summarize structure, packages, and notable files without embedding full file contents.
// 
// Exports PackageManager, a string-union type that normalizes the detected package manager to 'npm', 'pnpm', 'yarn', or 'unknown'. Exports IPackageInfo, which represents a single package within a monorepo or standalone repo, including its required filesystem path plus optional name, version, and private flag.
// 
// Exports IRepoMap, the main shape for a repository summary. It captures the repository rootPath, optional packageManager, detectedLanguages, and a list of packages. It also categorizes file and directory paths into important files, source and test directories, configuration, CI, deployment, dependency-related files, and generated C4 architecture documentation files. It optionally carries contextSelection metadata used later when assembling review prompts.
// 
// Relies on IContextSelectionMeta imported from contextManifest to type the optional contextSelection field.
// ===End StrongAI Generated Comment===


import { IContextSelectionMeta } from './contextManifest';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'unknown';

export interface IPackageInfo {
   name?: string;
   path: string;
   version?: string;
   private?: boolean;
}

export interface IRepoMap {
   rootPath: string;
   packageManager?: PackageManager;
   detectedLanguages: string[];
   packages: IPackageInfo[];
   importantFiles: string[];
   sourceDirectories: string[];
   testDirectories: string[];
   configFiles: string[];
   ciFiles: string[];
   deploymentFiles: string[];
   dependencyFiles: string[];
   /** C4-Auto generated architecture docs (Component / Context README files). */
   c4ArchitectureFiles: string[];
   /** Context selection metadata attached before review prompt assembly. */
   contextSelection?: IContextSelectionMeta;
}
