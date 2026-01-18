import { ValidationRuleEngineImpl } from '../validation/engine';
import { StaticAnalysisEngineImpl } from '../static-analysis/engine';
import { ChangeImpactAnalyzerImpl } from '../change-impact/analyzer';
import { GitHookResult } from '../types/integration';
import { ValidationResult } from '../types/validation';
import { CodeChange, ProjectContext } from '../types/core';
import { ValidationContext } from '../types/validation';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export class GitHooksIntegration {
  constructor(
    private validationEngine: ValidationRuleEngineImpl,
    private staticAnalysis: StaticAnalysisEngineImpl,
    private impactAnalyzer: ChangeImpactAnalyzerImpl,
    private projectContext: ProjectContext
  ) {}

  /**
   * Pre-commit hook validation
   * Validates staged changes before commit
   */
  async validatePreCommit(): Promise<GitHookResult> {
    try {
      const stagedFiles = this.getStagedFiles();
      const changes = await this.buildChangesFromStaged(stagedFiles);
      
      const validationResults: ValidationResult[] = [];
      const blockers: string[] = [];
      const warnings: string[] = [];

      // Validate each change
      for (const change of changes) {
        const context: ValidationContext = {
          change,
          fileContent: change.newContent || '',
          projectContext: this.projectContext,
          dependencies: await this.staticAnalysis.analyzeDependencies(change.filePath),
          configuration: {
            protectionLevels: {
              database: 'strict',
              api: 'strict',
              sharedTypes: 'moderate',
              businessLogic: 'strict'
            },
            criticalComponents: [],
            validationRules: [],
            integrationSettings: {
              gitHooks: { preCommit: true, prePush: true, commitMsg: true, customHooks: [] },
              ide: { realTimeValidation: true, suggestionLevel: 'moderate', autoFix: false },
              cicd: { validateOnPR: true, blockOnErrors: true, generateReports: true, integrationTests: true }
            }
          }
        };

        const results = await this.validationEngine.executeRules(context);
        validationResults.push(...results);

        // Categorize results
        for (const result of results) {
          if (result.severity === 'error') {
            blockers.push(`${result.filePath}: ${result.message}`);
          } else if (result.severity === 'warning') {
            warnings.push(`${result.filePath}: ${result.message}`);
          }
        }
      }

      // Check for critical component changes
      const criticalChanges = changes.filter(change => 
        this.isCriticalComponent(change.filePath)
      );

      if (criticalChanges.length > 0) {
        for (const change of criticalChanges) {
          const impact = await this.impactAnalyzer.analyzeChange(change);
          if (impact.riskLevel === 'critical' || impact.riskLevel === 'high') {
            blockers.push(`Critical component change detected: ${change.filePath} - requires additional review`);
          }
        }
      }

      return {
        success: blockers.length === 0,
        validationResults,
        blockers,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        validationResults: [],
        blockers: [`Pre-commit validation failed: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Pre-push hook validation
   * Validates commits before pushing to remote
   */
  async validatePrePush(remoteName: string, remoteUrl: string): Promise<GitHookResult> {
    try {
      const commits = this.getCommitsSinceRemote(remoteName);
      const allChanges: CodeChange[] = [];
      
      // Collect all changes from commits
      for (const commit of commits) {
        const changes = await this.getChangesFromCommit(commit);
        allChanges.push(...changes);
      }

      const validationResults: ValidationResult[] = [];
      const blockers: string[] = [];
      const warnings: string[] = [];

      // Perform comprehensive validation
      const impactMap = await this.impactAnalyzer.buildImpactMap(allChanges);
      
      // Check for breaking changes across commits
      const breakingChanges = await Promise.all(
        allChanges.map(change => this.impactAnalyzer.identifyBreakingChanges(change))
      );

      const allBreakingChanges = breakingChanges.flat();
      
      if (allBreakingChanges.length > 0) {
        for (const breakingChange of allBreakingChanges) {
          if (breakingChange.severity === 'critical' || breakingChange.severity === 'major') {
            blockers.push(`Breaking change detected: ${breakingChange.description}`);
          } else {
            warnings.push(`Minor breaking change: ${breakingChange.description}`);
          }
        }
      }

      // Validate commit messages
      const invalidCommits = this.validateCommitMessages(commits);
      if (invalidCommits.length > 0) {
        warnings.push(...invalidCommits.map(commit => 
          `Invalid commit message format: ${commit.substring(0, 50)}...`
        ));
      }

      // Check for missing tests on critical changes
      const criticalChanges = allChanges.filter(change => 
        this.isCriticalComponent(change.filePath)
      );

      if (criticalChanges.length > 0) {
        const missingTests = await this.checkForMissingTests(criticalChanges);
        if (missingTests.length > 0) {
          blockers.push(...missingTests.map(file => 
            `Missing tests for critical component: ${file}`
          ));
        }
      }

      return {
        success: blockers.length === 0,
        validationResults,
        blockers,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        validationResults: [],
        blockers: [`Pre-push validation failed: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate commit message format
   */
  validateCommitMessage(message: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check basic format: type(scope): description
    const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}/;
    
    if (!conventionalCommitRegex.test(message)) {
      errors.push('Commit message must follow conventional commit format: type(scope): description');
    }

    // Check for minimum description length
    const descriptionMatch = message.match(/^[^:]+: (.+)/);
    if (descriptionMatch && descriptionMatch[1].length < 10) {
      errors.push('Commit description must be at least 10 characters long');
    }

    // Check for prohibited patterns
    const prohibitedPatterns = [
      /^(wip|temp|tmp|debug)/i,
      /^(fix|update|change)\s*$/i,
      /\bfuck\b|\bshit\b|\bdamn\b/i
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(message)) {
        errors.push('Commit message contains prohibited content or is too generic');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Install Git hooks in the repository
   */
  async installHooks(hooksPath?: string): Promise<void> {
    const gitDir = this.findGitDirectory();
    const hooksDirPath = hooksPath || path.join(gitDir, 'hooks');

    // Ensure hooks directory exists
    if (!fs.existsSync(hooksDirPath)) {
      fs.mkdirSync(hooksDirPath, { recursive: true });
    }

    // Install pre-commit hook
    const preCommitHook = this.generatePreCommitHook();
    const preCommitPath = path.join(hooksDirPath, 'pre-commit');
    fs.writeFileSync(preCommitPath, preCommitHook, { mode: 0o755 });

    // Install pre-push hook
    const prePushHook = this.generatePrePushHook();
    const prePushPath = path.join(hooksDirPath, 'pre-push');
    fs.writeFileSync(prePushPath, prePushHook, { mode: 0o755 });

    // Install commit-msg hook
    const commitMsgHook = this.generateCommitMsgHook();
    const commitMsgPath = path.join(hooksDirPath, 'commit-msg');
    fs.writeFileSync(commitMsgPath, commitMsgHook, { mode: 0o755 });
  }

  private getStagedFiles(): string[] {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      return output.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  private async buildChangesFromStaged(files: string[]): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];
    
    for (const file of files) {
      try {
        // Get old content
        let oldContent: string | undefined;
        try {
          oldContent = execSync(`git show HEAD:${file}`, { encoding: 'utf8' });
        } catch {
          // File is new
          oldContent = undefined;
        }

        // Get new content (staged)
        let newContent: string | undefined;
        try {
          newContent = fs.readFileSync(file, 'utf8');
        } catch {
          // File is deleted
          newContent = undefined;
        }

        const changeType = oldContent === undefined ? 'create' : 
                          newContent === undefined ? 'delete' : 'modify';

        changes.push({
          id: `staged-${file}`,
          type: changeType,
          filePath: file,
          oldContent,
          newContent,
          author: this.getGitUser(),
          timestamp: new Date(),
          description: `Staged change to ${file}`
        });
      } catch (error) {
        console.warn(`Failed to process staged file ${file}:`, (error as Error).message);
      }
    }

    return changes;
  }

  private getCommitsSinceRemote(remoteName: string): string[] {
    try {
      const output = execSync(`git rev-list HEAD ^${remoteName}/HEAD`, { encoding: 'utf8' });
      return output.trim().split('\n').filter(commit => commit.length > 0);
    } catch (error) {
      return [];
    }
  }

  private async getChangesFromCommit(commitHash: string): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];
    
    try {
      const filesOutput = execSync(`git diff-tree --no-commit-id --name-status -r ${commitHash}`, { encoding: 'utf8' });
      const lines = filesOutput.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        const [status, filePath] = line.split('\t');
        
        let oldContent: string | undefined;
        let newContent: string | undefined;
        let changeType: 'create' | 'modify' | 'delete';

        if (status === 'A') {
          changeType = 'create';
          newContent = execSync(`git show ${commitHash}:${filePath}`, { encoding: 'utf8' });
        } else if (status === 'D') {
          changeType = 'delete';
          oldContent = execSync(`git show ${commitHash}^:${filePath}`, { encoding: 'utf8' });
        } else {
          changeType = 'modify';
          oldContent = execSync(`git show ${commitHash}^:${filePath}`, { encoding: 'utf8' });
          newContent = execSync(`git show ${commitHash}:${filePath}`, { encoding: 'utf8' });
        }

        changes.push({
          id: `${commitHash}-${filePath}`,
          type: changeType,
          filePath,
          oldContent,
          newContent,
          author: this.getCommitAuthor(commitHash),
          timestamp: this.getCommitDate(commitHash),
          description: this.getCommitMessage(commitHash)
        });
      }
    } catch (error) {
      console.warn(`Failed to get changes from commit ${commitHash}:`, (error as Error).message);
    }

    return changes;
  }

  private validateCommitMessages(commits: string[]): string[] {
    const invalidCommits: string[] = [];
    
    for (const commit of commits) {
      const message = this.getCommitMessage(commit);
      const validation = this.validateCommitMessage(message);
      
      if (!validation.valid) {
        invalidCommits.push(message);
      }
    }

    return invalidCommits;
  }

  private async checkForMissingTests(changes: CodeChange[]): Promise<string[]> {
    const missingTests: string[] = [];
    
    for (const change of changes) {
      if (change.type === 'delete') continue;
      
      // Check if this is a source file that should have tests
      if (this.shouldHaveTests(change.filePath)) {
        const testFile = this.getExpectedTestFile(change.filePath);
        
        if (!fs.existsSync(testFile)) {
          missingTests.push(change.filePath);
        }
      }
    }

    return missingTests;
  }

  private isCriticalComponent(filePath: string): boolean {
    const criticalPaths = [
      'src/validation/',
      'src/static-analysis/',
      'src/change-impact/',
      'src/progressive-development/',
      'src/ai-integration/',
      'database/',
      'api/',
      'lib/supabase',
      'lib/businessHours'
    ];

    return criticalPaths.some(path => filePath.includes(path));
  }

  private shouldHaveTests(filePath: string): boolean {
    return filePath.endsWith('.ts') && 
           !filePath.endsWith('.test.ts') && 
           !filePath.endsWith('.d.ts') &&
           !filePath.includes('node_modules') &&
           this.isCriticalComponent(filePath);
  }

  private getExpectedTestFile(filePath: string): string {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, '.ts');
    return path.join(dir, '__tests__', `${name}.test.ts`);
  }

  private findGitDirectory(): string {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const gitDir = path.join(currentDir, '.git');
      if (fs.existsSync(gitDir)) {
        return gitDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    throw new Error('Git repository not found');
  }

  private getGitUser(): string {
    try {
      const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
      const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
      return `${name} <${email}>`;
    } catch {
      return 'Unknown User';
    }
  }

  private getCommitAuthor(commitHash: string): string {
    try {
      return execSync(`git show -s --format='%an <%ae>' ${commitHash}`, { encoding: 'utf8' }).trim();
    } catch {
      return 'Unknown Author';
    }
  }

  private getCommitDate(commitHash: string): Date {
    try {
      const timestamp = execSync(`git show -s --format='%ct' ${commitHash}`, { encoding: 'utf8' }).trim();
      return new Date(parseInt(timestamp) * 1000);
    } catch {
      return new Date();
    }
  }

  private getCommitMessage(commitHash: string): string {
    try {
      return execSync(`git show -s --format='%s' ${commitHash}`, { encoding: 'utf8' }).trim();
    } catch {
      return 'Unknown commit message';
    }
  }

  private generatePreCommitHook(): string {
    return `#!/bin/sh
# Code Guardrails Pre-commit Hook
# This hook validates staged changes before commit

# Check if guardrails CLI is available
if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx not found. Please install Node.js and npm."
    exit 1
fi

# Run pre-commit validation
echo "Running code guardrails pre-commit validation..."
npx code-guardrails validate --pre-commit

if [ $? -ne 0 ]; then
    echo "Pre-commit validation failed. Commit blocked."
    echo "Run 'npx code-guardrails validate --pre-commit --verbose' for details."
    exit 1
fi

echo "Pre-commit validation passed."
exit 0
`;
  }

  private generatePrePushHook(): string {
    return `#!/bin/sh
# Code Guardrails Pre-push Hook
# This hook validates commits before pushing to remote

remote="$1"
url="$2"

# Check if guardrails CLI is available
if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx not found. Please install Node.js and npm."
    exit 1
fi

# Run pre-push validation
echo "Running code guardrails pre-push validation..."
npx code-guardrails validate --pre-push --remote="$remote" --url="$url"

if [ $? -ne 0 ]; then
    echo "Pre-push validation failed. Push blocked."
    echo "Run 'npx code-guardrails validate --pre-push --verbose' for details."
    exit 1
fi

echo "Pre-push validation passed."
exit 0
`;
  }

  private generateCommitMsgHook(): string {
    return `#!/bin/sh
# Code Guardrails Commit Message Hook
# This hook validates commit message format

commit_msg_file="$1"

# Check if guardrails CLI is available
if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx not found. Please install Node.js and npm."
    exit 1
fi

# Run commit message validation
echo "Validating commit message format..."
npx code-guardrails validate --commit-msg="$commit_msg_file"

if [ $? -ne 0 ]; then
    echo "Commit message validation failed."
    echo "Please follow conventional commit format: type(scope): description"
    exit 1
fi

exit 0
`;
  }
}