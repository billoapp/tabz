// File utility functions for CLI operations

import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeChange, PackageConfiguration, TypeScriptConfiguration } from '../../types/core';

export class FileUtils {
  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find all TypeScript files in a directory recursively
   */
  async findTypeScriptFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common directories that shouldn't be analyzed
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }
          
          const subFiles = await this.findTypeScriptFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.isTypeScriptFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${directory}:`, error);
    }
    
    return files;
  }

  /**
   * Load package.json from a directory
   */
  async loadPackageJson(directory: string): Promise<PackageConfiguration> {
    const packagePath = path.join(directory, 'package.json');
    
    try {
      const content = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      return {
        name: packageJson.name || '',
        version: packageJson.version || '0.0.0',
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        scripts: packageJson.scripts || {},
        workspaces: packageJson.workspaces
      };
    } catch (error) {
      // Return default configuration if package.json doesn't exist
      return {
        name: path.basename(directory),
        version: '0.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      };
    }
  }

  /**
   * Load TypeScript configuration from a directory
   */
  async loadTsConfig(directory: string): Promise<TypeScriptConfiguration> {
    const tsConfigPath = path.join(directory, 'tsconfig.json');
    
    try {
      const content = await fs.readFile(tsConfigPath, 'utf-8');
      // Remove comments from JSON (simple implementation)
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      const tsConfig = JSON.parse(cleanContent);
      
      return {
        compilerOptions: tsConfig.compilerOptions || {},
        include: tsConfig.include || [],
        exclude: tsConfig.exclude || [],
        references: tsConfig.references
      };
    } catch (error) {
      // Return default configuration if tsconfig.json doesn't exist
      return {
        compilerOptions: {},
        include: [],
        exclude: []
      };
    }
  }

  /**
   * Apply a code change to the file system
   */
  async applyCodeChange(change: CodeChange): Promise<void> {
    const filePath = path.resolve(change.filePath);
    
    switch (change.type) {
      case 'create':
        if (change.newContent !== undefined) {
          // Ensure directory exists
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, change.newContent, 'utf-8');
        }
        break;
        
      case 'modify':
        if (change.newContent !== undefined) {
          await fs.writeFile(filePath, change.newContent, 'utf-8');
        }
        break;
        
      case 'delete':
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might not exist, which is fine for delete operations
          console.warn(`Could not delete file ${filePath}:`, error);
        }
        break;
        
      case 'move':
        // For move operations, we'd need additional information about the target path
        // This is a simplified implementation
        throw new Error('Move operations are not yet supported in auto-fix');
        
      default:
        throw new Error(`Unknown change type: ${change.type}`);
    }
  }

  /**
   * Read file content safely
   */
  async readFileContent(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write file content safely
   */
  async writeFileContent(filePath: string, content: string): Promise<boolean> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.warn(`Failed to write file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(filePath: string): Promise<{
    size: number;
    modified: Date;
    isDirectory: boolean;
  } | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Find files matching a pattern
   */
  async findFiles(directory: string, pattern: RegExp): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          if (!this.shouldSkipDirectory(entry.name)) {
            const subFiles = await this.findFiles(fullPath, pattern);
            files.push(...subFiles);
          }
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to search directory ${directory}:`, error);
    }
    
    return files;
  }

  /**
   * Create a backup of a file
   */
  async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      await fs.writeFile(backupPath, content, 'utf-8');
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup of ${filePath}: ${error}`);
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(originalPath: string, backupPath: string): Promise<void> {
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      await fs.writeFile(originalPath, content, 'utf-8');
      
      // Clean up backup file
      await fs.unlink(backupPath);
    } catch (error) {
      throw new Error(`Failed to restore ${originalPath} from backup: ${error}`);
    }
  }

  /**
   * Get relative path from project root
   */
  getRelativePath(filePath: string, projectRoot: string = process.cwd()): string {
    return path.relative(projectRoot, filePath);
  }

  /**
   * Resolve path relative to project root
   */
  resolvePath(relativePath: string, projectRoot: string = process.cwd()): string {
    return path.resolve(projectRoot, relativePath);
  }

  /**
   * Check if a file is a TypeScript file
   */
  private isTypeScriptFile(fileName: string): boolean {
    const tsExtensions = ['.ts', '.tsx', '.d.ts'];
    return tsExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * Check if a directory should be skipped during file discovery
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.next',
      '.turbo',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'tmp',
      'temp',
      '.cache',
      '.vscode',
      '.idea'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Normalize file path for cross-platform compatibility
   */
  normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Check if path is within project boundaries
   */
  isWithinProject(filePath: string, projectRoot: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(projectRoot);
    
    return resolvedPath.startsWith(resolvedRoot);
  }

  /**
   * Get file extension
   */
  getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Get file name without extension
   */
  getFileNameWithoutExtension(filePath: string): string {
    const baseName = path.basename(filePath);
    const extension = path.extname(baseName);
    return baseName.slice(0, -extension.length);
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(targetPath));
      await fs.copyFile(sourcePath, targetPath);
    } catch (error) {
      throw new Error(`Failed to copy file from ${sourcePath} to ${targetPath}: ${error}`);
    }
  }

  /**
   * Move file
   */
  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await this.ensureDirectory(path.dirname(targetPath));
      await fs.rename(sourcePath, targetPath);
    } catch (error) {
      throw new Error(`Failed to move file from ${sourcePath} to ${targetPath}: ${error}`);
    }
  }
}