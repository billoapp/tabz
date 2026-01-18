// Tests for CLI file utilities

import { FileUtils } from '../utils/file-utils';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileUtils', () => {
  let fileUtils: FileUtils;

  beforeEach(() => {
    fileUtils = new FileUtils();
    jest.clearAllMocks();
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await fileUtils.fileExists('/path/to/file.ts');
      
      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/path/to/file.ts');
    });

    it('should return false if file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      const result = await fileUtils.fileExists('/path/to/nonexistent.ts');
      
      expect(result).toBe(false);
    });
  });

  describe('loadPackageJson', () => {
    it('should load and parse package.json', async () => {
      const mockPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: { 'dep1': '^1.0.0' },
        devDependencies: { 'dev-dep1': '^2.0.0' },
        scripts: { 'test': 'jest' }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      
      const result = await fileUtils.loadPackageJson('/project');
      
      expect(result).toEqual({
        name: 'test-package',
        version: '1.0.0',
        dependencies: { 'dep1': '^1.0.0' },
        devDependencies: { 'dev-dep1': '^2.0.0' },
        scripts: { 'test': 'jest' },
        workspaces: undefined
      });
      expect(mockFs.readFile).toHaveBeenCalledWith(path.join('/project', 'package.json'), 'utf-8');
    });

    it('should return default configuration if package.json does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await fileUtils.loadPackageJson('/project');
      
      expect(result).toEqual({
        name: 'project',
        version: '0.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      });
    });
  });

  describe('loadTsConfig', () => {
    it('should load and parse tsconfig.json', async () => {
      const mockTsConfig = {
        compilerOptions: { strict: true },
        include: ['src*'],
        exclude: ['node_modules']
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockTsConfig));
      
      const result = await fileUtils.loadTsConfig('/project');
      
      expect(result).toEqual({
        compilerOptions: { strict: true },
        include: ['src*'],
        exclude: ['node_modules'],
        references: undefined
      });
    });

    it('should handle tsconfig.json with comments', async () => {
      const mockTsConfigWithComments = `{
        // This is a comment
        "compilerOptions": {
          "strict": true /* inline comment */
        },
        "include": ["src/**/*"]
      }`;

      mockFs.readFile.mockResolvedValue(mockTsConfigWithComments);
      
      const result = await fileUtils.loadTsConfig('/project');
      
      expect(result.compilerOptions).toEqual({ strict: true });
      expect(result.include).toEqual(['src*']);
    });

    it('should return default configuration if tsconfig.json does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await fileUtils.loadTsConfig('/project');
      
      expect(result).toEqual({
        compilerOptions: {},
        include: [],
        exclude: []
      });
    });
  });

  describe('readFileContent', () => {
    it('should read file content successfully', async () => {
      const mockContent = 'file content';
      mockFs.readFile.mockResolvedValue(mockContent);
      
      const result = await fileUtils.readFileContent('/path/to/file.ts');
      
      expect(result).toBe(mockContent);
      expect(mockFs.readFile).toHaveBeenCalledWith('/path/to/file.ts', 'utf-8');
    });

    it('should return null if file cannot be read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));
      
      const result = await fileUtils.readFileContent('/path/to/file.ts');
      
      expect(result).toBeNull();
    });
  });

  describe('writeFileContent', () => {
    it('should write file content successfully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const result = await fileUtils.writeFileContent('/path/to/file.ts', 'content');
      
      expect(result).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname('/path/to/file.ts'), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith('/path/to/file.ts', 'content', 'utf-8');
    });

    it('should return false if write fails', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));
      
      const result = await fileUtils.writeFileContent('/path/to/file.ts', 'content');
      
      expect(result).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path from project root', () => {
      const result = fileUtils.getRelativePath('/project/src/file.ts', '/project');
      // Normalize for Windows paths
      expect(result.replace(/\\/g, '/')).toBe('src/file.ts');
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative path from project root', () => {
      const result = fileUtils.resolvePath('src/file.ts', '/project');
      expect(result).toBe(path.resolve('/project', 'src/file.ts'));
    });
  });

  describe('normalizePath', () => {
    it('should normalize path for cross-platform compatibility', () => {
      const result = fileUtils.normalizePath('src\\components\\Button.tsx');
      expect(result).toBe('src/components/Button.tsx');
    });
  });

  describe('getFileExtension', () => {
    it('should return file extension', () => {
      expect(fileUtils.getFileExtension('file.ts')).toBe('.ts');
      expect(fileUtils.getFileExtension('file.test.tsx')).toBe('.tsx');
      expect(fileUtils.getFileExtension('README')).toBe('');
    });
  });

  describe('getFileNameWithoutExtension', () => {
    it('should return filename without extension', () => {
      expect(fileUtils.getFileNameWithoutExtension('/path/to/file.ts')).toBe('file');
      expect(fileUtils.getFileNameWithoutExtension('component.test.tsx')).toBe('component.test');
    });
  });

  describe('isWithinProject', () => {
    it('should return true if path is within project', () => {
      const result = fileUtils.isWithinProject('/project/src/file.ts', '/project');
      expect(result).toBe(true);
    });

    it('should return false if path is outside project', () => {
      const result = fileUtils.isWithinProject('/other/file.ts', '/project');
      expect(result).toBe(false);
    });
  });
});