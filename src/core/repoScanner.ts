/**
 * @module core/repoScanner
 * Generates a lightweight factual repository map.
 */
// Copyright (c) 2025 Jon Verrier

import * as path from 'path';
import { IPackageInfo, IRepoMap, PackageManager } from '../schemas/repoMap';
import { loadGitignorePatterns, readTextFileIfExists, walkFiles } from '../utils/fileSystem';

const SOURCE_DIR_NAMES = ['src', 'lib', 'app', 'packages', 'server', 'client'];
const TEST_DIR_NAMES = ['test', 'tests', '__tests__', 'spec', 'specs'];
const CONFIG_FILE_NAMES = [
   'tsconfig.json',
   'jsconfig.json',
   'package.json',
   'pnpm-workspace.yaml',
   'lerna.json',
   'nx.json',
   'turbo.json',
   'Makefile',
   'Dockerfile',
   'docker-compose.yml',
   'docker-compose.yaml'
];
const CI_PATTERNS = ['.github/workflows/', '.gitlab-ci.yml', 'azure-pipelines.yml', 'Jenkinsfile'];
const DEPLOYMENT_PATTERNS = ['Dockerfile', 'docker-compose', 'k8s/', 'kubernetes/', 'terraform/', '.tf'];
const LANGUAGE_EXTENSIONS: Record<string, string> = {
   '.ts': 'TypeScript',
   '.tsx': 'TypeScript',
   '.js': 'JavaScript',
   '.jsx': 'JavaScript',
   '.py': 'Python',
   '.go': 'Go',
   '.rs': 'Rust',
   '.java': 'Java',
   '.cs': 'C#',
   '.rb': 'Ruby',
   '.php': 'PHP',
   '.sql': 'SQL',
   '.yaml': 'YAML',
   '.yml': 'YAML',
   '.tf': 'Terraform',
   '.md': 'Markdown'
};

/**
 * Scans a repository and returns a factual map of its structure.
 * @param rootPath - Absolute repository root path
 */
export async function generateRepoMap(rootPath: string): Promise<IRepoMap> {
   const gitignorePatterns = await loadGitignorePatterns(path.join(rootPath, '.gitignore'));
   const allFiles = await walkFiles(rootPath, gitignorePatterns);

   const packageManager = detectPackageManager(allFiles);
   const packages = await detectPackages(rootPath, allFiles);
   const detectedLanguages = detectLanguages(allFiles);
   const sourceDirectories = detectNamedDirectories(allFiles, SOURCE_DIR_NAMES);
   const testDirectories = detectNamedDirectories(allFiles, TEST_DIR_NAMES);
   const configFiles = allFiles.filter((file) =>
      CONFIG_FILE_NAMES.some((name) => file === name || file.endsWith(`/${name}`))
   );
   const ciFiles = allFiles.filter((file) =>
      CI_PATTERNS.some((pattern) => file.includes(pattern) || file === pattern)
   );
   const deploymentFiles = allFiles.filter((file) =>
      DEPLOYMENT_PATTERNS.some((pattern) => file.includes(pattern))
   );
   const dependencyFiles = allFiles.filter((file) =>
      ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'requirements.txt', 'go.mod', 'Cargo.toml'].some(
         (name) => file === name || file.endsWith(`/${name}`)
      )
   );
   const importantFiles = allFiles.filter((file) => {
      const base = path.basename(file).toLowerCase();
      return (
         base === 'readme.md' ||
         base === 'design.md' ||
         base === 'architecture.md' ||
         file.includes('architecture/')
      );
   });

   return {
      rootPath,
      packageManager,
      detectedLanguages,
      packages,
      importantFiles: unique(importantFiles).slice(0, 50),
      sourceDirectories: unique(sourceDirectories),
      testDirectories: unique(testDirectories),
      configFiles: unique(configFiles).slice(0, 40),
      ciFiles: unique(ciFiles).slice(0, 20),
      deploymentFiles: unique(deploymentFiles).slice(0, 20),
      dependencyFiles: unique(dependencyFiles).slice(0, 20)
   };
}

function detectPackageManager(files: string[]): PackageManager {
   if (files.some((f) => f.endsWith('pnpm-lock.yaml') || f === 'pnpm-workspace.yaml')) {
      return 'pnpm';
   }
   if (files.some((f) => f.endsWith('yarn.lock'))) {
      return 'yarn';
   }
   if (files.some((f) => f.endsWith('package.json'))) {
      return 'npm';
   }
   return 'unknown';
}

async function detectPackages(rootPath: string, files: string[]): Promise<IPackageInfo[]> {
   const packageJsonFiles = files.filter((f) => f.endsWith('package.json'));
   const packages: IPackageInfo[] = [];

   for (const relativePath of packageJsonFiles.slice(0, 30)) {
      const content = await readTextFileIfExists(path.join(rootPath, relativePath));
      if (!content) {
         continue;
      }
      try {
         const parsed = JSON.parse(content) as {
            name?: string;
            version?: string;
            private?: boolean;
            workspaces?: unknown;
         };
         packages.push({
            name: parsed.name,
            path: path.dirname(relativePath) || '.',
            version: parsed.version,
            private: parsed.private
         });
      } catch {
         packages.push({ path: path.dirname(relativePath) || '.' });
      }
   }

   return packages;
}

function detectLanguages(files: string[]): string[] {
   const languages = new Set<string>();
   for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const language = LANGUAGE_EXTENSIONS[ext];
      if (language) {
         languages.add(language);
      }
   }
   return [...languages].sort();
}

function detectNamedDirectories(files: string[], dirNames: string[]): string[] {
   const found = new Set<string>();
   for (const file of files) {
      const parts = file.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
         if (dirNames.includes(parts[i])) {
            found.add(parts.slice(0, i + 1).join('/'));
         }
      }
   }
   return [...found].sort();
}

function unique(values: string[]): string[] {
   return [...new Set(values)];
}
