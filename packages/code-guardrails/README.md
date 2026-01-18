# Code Guardrails and Change Management System

A comprehensive code guardrails system for the Tabeza project that prevents destructive development patterns while supporting AI-assisted development workflows.

## Features

- **Breaking Change Prevention**: Validates database schema, API contracts, shared types, and business logic changes
- **Code Duplication Detection**: Identifies similar code patterns and suggests reuse opportunities
- **Dependency Analysis**: Analyzes function dependencies before allowing removal or modification
- **Assumption Validation**: Flags assumption-based changes and requires clarification
- **Progressive Development**: Guides developers through structured change processes
- **AI Assistant Integration**: Provides specialized guardrails for AI-powered development tools

## Installation

```bash
cd packages/code-guardrails
pnpm install
```

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Usage

```typescript
import { GuardrailsSystem } from '@tabeza/code-guardrails';

// Initialize the system
const system = new GuardrailsSystem(configuration);
await system.initialize();

// Validate a code change
const results = await system.validateChange(change);

// Analyze change impact
const impact = await system.analyzeImpact(change);
```

## Architecture

The system consists of five core components:

1. **Static Analysis Engine**: Analyzes code structure, dependencies, and relationships
2. **Change Impact Analyzer**: Evaluates ripple effects of proposed changes
3. **Validation Rule Engine**: Executes configurable rules to prevent destructive patterns
4. **Progressive Development Orchestrator**: Guides structured change processes
5. **AI Assistant Integration Layer**: Provides AI-specific guardrails and context

## Testing

The system uses a dual testing approach:

- **Unit Tests**: Test specific scenarios and edge cases using Jest
- **Property-Based Tests**: Test universal properties using fast-check

Property-based tests validate correctness properties across all valid inputs, ensuring comprehensive coverage of the system's behavior.

## Configuration

The system supports extensive configuration through the `GuardrailConfiguration` interface:

- Protection levels for different component types
- Custom validation rules and severity levels
- Critical component definitions
- Integration settings for Git hooks, IDE, and CI/CD
- AI assistant settings and risk thresholds
- Reporting and analytics configuration
- Emergency override settings

## Integration

The system integrates with:

- **Git Hooks**: Pre-commit and pre-push validation
- **IDE Extensions**: Real-time validation and suggestions
- **CI/CD Pipelines**: Automated validation in continuous integration
- **AI Development Tools**: Enhanced context and guardrails for AI assistants

## Requirements Traceability

This implementation addresses requirements:
- **10.1**: Configuration and customization of protection levels
- **10.6**: Plugin architecture for extensions and integrations