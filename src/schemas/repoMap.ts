/**
 * @module schemas/repoMap
 * Types for lightweight factual repository maps.
 */
// Copyright (c) 2025 Jon Verrier

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
}
