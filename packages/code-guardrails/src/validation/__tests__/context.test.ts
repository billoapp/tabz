// Validation Context Manager tests

import { ValidationContextManager } from '../context';
import {
  ValidationContext,
  ProjectConfiguration
} from '../../types/validation';
import {
  CodeChange,
  ProjectContext
} from '../../types/core';
import {
  DependencyGraph
} from '../../types/static-analysis';
import * as fs from 'fs/promises';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Test data
const mockCodeChange: CodeChange = {
  id: 'test-change-1',
  type: 'modify',
  filePath: 'src/test.ts',
  oldContent: 'const old = "old";',
  newContent: 'const new = "new";',
  author: 'test-user',
  timestamp: new Date(),
  description: 'Test change'
};

const mockProjectContext: ProjectContext = {
  rootPath: '/test/project',
  packageJson: {
    name: 'test-project',
    version: '1.0.0',
    dependencies: {},
    devDependencies: {},
    scripts: {}
  },
  tsConfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs'
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  },
  criticalFiles: [],
  protectedComponents: [],
  businessLogicPaths: []
};

const mockDependencyGraph: DependencyGraph = {
  nodes: [],
  edges: [],
  cycles: [],
  criticalPaths: []
};

const mockProjectConfiguration: ProjectConfiguration = {
  protectionLevels: {
    database: 'strict',
    api: 'moderate',
    sharedTypes: 'strict',
    businessLogic: 'moderate'
  },
  criticalComponents: [
    {
      paths: ['src/critical.ts'],
      patterns: ['.*\\.critical\\.ts$'],
      components: [],
      customRules: []
    }
  ],
  validationRules: [],
  integrationSettings: {
    gitHooks: {
      preCommit: true,
      prePush: true,
      commitMsg: false,
      customHooks: []
    },
    ide: {
      realTimeValidation: true,
      suggestionLevel: 'moderate',
      autoFix: false
    },
    cicd: {
      validateOnPR: true,
      blockOnErrors: true,
      generateReports: true,
      integrationTests: true
    }
  }
};

describe('ValidationContextManager', () => {
  let contextManager: ValidationContextManager;

  beforeEach(() => {
    contextManager = new ValidationContextManager();
    jest.clearAllMocks();
  });

  describe('Context Creation', () => {
    it('should create a basic validation context', async () => {
      mockFs.readFile.mockResolvedValue('file content');
      mockFs.access.mockResolvedValue(undefined);

      const context = await contextManager.createContext(
        mockCodeChange,
        mockDependencyGraph,
        mockProjectContext,
        mockProjectConfiguration
      );

      expect(context).toBeDefined();
      expect(context.change).toBe(mockCodeChange);
      expect(context.projectContext).toBe(mockProjectContext);
      expect(context.dependencies).toBe(mockDependencyGraph);
      expect(context.configuration).toBe(mockProjectConfiguration);
      expect(context.fileContent).toBe('file content');
    });

    it('should use cached project context and configuration', async () => {
      contextManager.setProjectContext(mockProjectContext);
      contextManager.setProjectConfiguration(mockProjectConfiguration);

      mockFs.readFile.mockResolvedValue('cached content');
      mockFs.access.mockResolvedValue(undefined);

      const context = await contextManager.createContext(
        mockCodeChange,
        mockDependencyGraph
      );

      expect(context.projectContext).toBe(mockProjectContext);
      expect(context.configuration).toBe(mockProjectConfiguration);
    });

    it('should throw error when project context is missing', async () => {
      await expect(
        contextManager.createContext(mockCodeChange, mockDependencyGraph)
      ).rejects.toThrow('Project context is required');
    });

    it('should throw error when project configuration is missing', async () => {
      contextManager.setProjectContext(mockProjectContext);

      await expect(
        contextManager.createContext(mockCodeChange, mockDependencyGraph)
      ).rejects.toThrow('Project configuration is required');
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.access.mockRejectedValue(new Error('File not accessible'));

      const context = await contextManager.createContext(
        mockCodeChange,
        mockDependencyGraph,
        mockProjectContext,
        mockProjectConfiguration
      );

      expect(context.fileContent).toBe(mockCodeChange.newContent);
    });

    it('should use new content for create operations', async () => {
      const createChange: CodeChange = {
        ...mockCodeChange,
        type: 'create',
        newContent: 'new file content'
      };

      const context = await contextManager.createContext(
        createChange,
        mockDependencyGraph,
        mockProjectContext,
        mockProjectConfiguration
      );

      expect(context.fileContent).toBe('new file content');
    });
  });

  describe('Enhanced Context Creation', () => {
    it('should create enhanced context for critical components', async () => {
      mockFs.readFile.mockResolvedValue('critical file content');
      mockFs.access.mockResolvedValue(undefined);

      contextManager.setProjectContext(mockProjectContext);
      contextManager.setProjectConfiguration(mockProjectConfiguration);

      const criticalChange: CodeChange = {
        ...mockCodeChange,
        filePath: 'src/critical.ts'
      };

      const context = await contextManager.createEnhancedContext(
        criticalChange,
        mockDependencyGraph
      );

      expect(context).toBeDefined();
      expect(context.change.filePath).toBe('src/critical.ts');
      // Enhanced context should have additional critical files
      expect(context.projectContext.criticalFiles.length).toBeGreaterThanOrEqual(
        mockProjectContext.criticalFiles.length
      );
    });

    it('should return regular context for non-critical components', async () => {
      mockFs.readFile.mockResolvedValue('regular file content');
      mockFs.access.mockResolvedValue(undefined);

      contextManager.setProjectContext(mockProjectContext);
      contextManager.setProjectConfiguration(mockProjectConfiguration);

      const regularChange: CodeChange = {
        ...mockCodeChange,
        filePath: 'src/regular.ts'
      };

      const context = await contextManager.createEnhancedContext(
        regularChange,
        mockDependencyGraph
      );

      expect(context).toBeDefined();
      expect(context.projectContext.criticalFiles).toEqual(mockProjectContext.criticalFiles);
    });
  });

  describe('Batch Context Creation', () => {
    it('should create multiple contexts for batch processing', async () => {
      mockFs.readFile.mockResolvedValue('batch content');
      mockFs.access.mockResolvedValue(undefined);

      contextManager.setProjectContext(mockProjectContext);
      contextManager.setProjectConfiguration(mockProjectConfiguration);

      const changes: CodeChange[] = [
        mockCodeChange,
        { ...mockCodeChange, id: 'change-2', filePath: 'src/test2.ts' },
        { ...mockCodeChange, id: 'change-3', filePath: 'src/test3.ts' }
      ];

      const contexts = await contextManager.createBatchContexts(changes, mockDependencyGraph);

      expect(contexts).toHaveLength(3);
      expect(contexts[0].change.id).toBe('test-change-1');
      expect(contexts[1].change.id).toBe('change-2');
      expect(contexts[2].change.id).toBe('change-3');
    });

    it('should handle errors in batch processing gracefully', async () => {
      // Mock console.warn to avoid test output
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockFs.readFile.mockRejectedValue(new Error('File read error'));
      mockFs.access.mockRejectedValue(new Error('File access error'));

      contextManager.setProjectContext(mockProjectContext);
      contextManager.setProjectConfiguration(mockProjectConfiguration);

      const changes: CodeChange[] = [
        mockCodeChange,
        { ...mockCodeChange, id: 'change-2', filePath: 'src/test2.ts' }
      ];

      const contexts = await contextManager.createBatchContexts(changes, mockDependencyGraph);

      // Should still create contexts despite file errors
      expect(contexts).toHaveLength(2);
      expect(consoleSpy).not.toHaveBeenCalled(); // No errors should occur

      consoleSpy.mockRestore();
    });
  });

  describe('Context Updates', () => {
    it('should update existing context with new information', async () => {
      mockFs.readFile.mockResolvedValue('original content');
      mockFs.access.mockResolvedValue(undefined);

      const originalContext = await contextManager.createContext(
        mockCodeChange,
        mockDependencyGraph,
        mockProjectContext,
        mockProjectConfiguration
      );

      const newChange: CodeChange = {
        ...mockCodeChange,
        id: 'updated-change',
        newContent: 'updated content'
      };

      const updatedContext = await contextManager.updateContext(originalContext, {
        change: newChange,
        fileContent: 'manually updated content'
      });

      expect(updatedContext.change.id).toBe('updated-change');
      expect(updatedContext.fileContent).toBe('manually updated content');
    });

    it('should read new file content when file path changes', async () => {
      mockFs.readFile
        .mockResolvedValueOnce('original content')
        .mockResolvedValueOnce('new file content');
      mockFs.access.mockResolvedValue(undefined);

      const originalContext = await contextManager.createContext(
        mockCodeChange,
        mockDependencyGraph,
        mockProjectContext,
        mockProjectConfiguration
      );

      const newChange: CodeChange = {
        ...mockCodeChange,
        filePath: 'src/newfile.ts'
      };

      const updatedContext = await contextManager.updateContext(originalContext, {
        change: newChange
      });

      expect(updatedContext.change.filePath).toBe('src/newfile.ts');
      expect(updatedContext.fileContent).toBe('new file content');
    });
  });

  describe('Context Validation', () => {
    it('should validate complete context successfully', async () => {
      const context = await contextManager.createContext(
        mockCodeChange,
        mockDependencyGraph,
        mockProjectContext,
        mockProjectConfiguration
      );

      const validation = contextManager.validateContext(context);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const incompleteContext = {
        change: null,
        fileContent: '',
        projectContext: null,
        dependencies: null,
        configuration: null
      } as any;

      const validation = contextManager.validateContext(incompleteContext);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Context missing code change information');
      expect(validation.errors).toContain('Context missing project context');
      expect(validation.errors).toContain('Context missing dependency graph');
      expect(validation.errors).toContain('Context missing project configuration');
    });

    it('should validate code change object', () => {
      const contextWithInvalidChange = {
        change: { id: 'test' }, // Missing required fields
        fileContent: '',
        projectContext: mockProjectContext,
        dependencies: mockDependencyGraph,
        configuration: mockProjectConfiguration
      } as any;

      const validation = contextManager.validateContext(contextWithInvalidChange);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Code change missing file path');
      expect(validation.errors).toContain('Code change missing type');
    });
  });

  describe('Getters and Setters', () => {
    it('should set and get project context', () => {
      contextManager.setProjectContext(mockProjectContext);
      expect(contextManager.getProjectContext()).toBe(mockProjectContext);
    });

    it('should set and get project configuration', () => {
      contextManager.setProjectConfiguration(mockProjectConfiguration);
      expect(contextManager.getProjectConfiguration()).toBe(mockProjectConfiguration);
    });

    it('should return null for unset contexts', () => {
      expect(contextManager.getProjectContext()).toBeNull();
      expect(contextManager.getProjectConfiguration()).toBeNull();
    });
  });
});