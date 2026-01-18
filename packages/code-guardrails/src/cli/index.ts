#!/usr/bin/env node

// CLI entry point for Code Guardrails system

import { Command } from 'commander';
import { ValidateCommand } from './commands/validate';
import { ConfigCommand } from './commands/config';
import { AnalyzeCommand } from './commands/analyze';
import { ReportCommand } from './commands/report';
import promptCommand from './commands/prompt';

const program = new Command();

program
  .name('guardrails')
  .description('Code Guardrails and Change Management System CLI')
  .version('1.0.0');

// Register commands
program.addCommand(ValidateCommand);
program.addCommand(ConfigCommand);
program.addCommand(AnalyzeCommand);
program.addCommand(ReportCommand);
program.addCommand(promptCommand);

// Parse command line arguments
program.parse();