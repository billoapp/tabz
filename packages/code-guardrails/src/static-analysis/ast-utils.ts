// AST Utility functions for code structure extraction

import * as ts from 'typescript';
import { SourceLocation } from '../types/core';

/**
 * Extract all identifiers from a node
 */
export function extractIdentifiers(node: ts.Node): string[] {
  const identifiers: string[] = [];
  
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      identifiers.push(n.text);
    }
    ts.forEachChild(n, visit);
  };
  
  visit(node);
  return identifiers;
}

/**
 * Extract all string literals from a node
 */
export function extractStringLiterals(node: ts.Node): string[] {
  const literals: string[] = [];
  
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n)) {
      literals.push(n.text);
    }
    ts.forEachChild(n, visit);
  };
  
  visit(node);
  return literals;
}

/**
 * Check if a node has a specific modifier
 */
export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return !!(node as any).modifiers?.some((mod: ts.Modifier) => mod.kind === kind);
}

/**
 * Get the text content of a node without leading/trailing trivia
 */
export function getCleanText(node: ts.Node): string {
  return node.getText().trim();
}

/**
 * Convert TypeScript position to SourceLocation
 */
export function getSourceLocation(node: ts.Node): SourceLocation {
  const sourceFile = node.getSourceFile();
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  
  return {
    line: start.line + 1, // Convert to 1-based
    column: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1
  };
}

/**
 * Check if a node is exported
 */
export function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

/**
 * Check if a node is async
 */
export function isAsync(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.AsyncKeyword);
}

/**
 * Check if a node is readonly
 */
export function isReadonly(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ReadonlyKeyword);
}

/**
 * Extract JSDoc comments from a node
 */
export function extractJSDocComments(node: ts.Node): string[] {
  const comments: string[] = [];
  const jsDocTags = (node as any).jsDoc;
  
  if (jsDocTags) {
    for (const tag of jsDocTags) {
      if (tag.comment) {
        comments.push(tag.comment);
      }
    }
  }
  
  return comments;
}

/**
 * Get all call expressions in a node
 */
export function getCallExpressions(node: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      calls.push(n);
    }
    ts.forEachChild(n, visit);
  };
  
  visit(node);
  return calls;
}

/**
 * Get all property access expressions in a node
 */
export function getPropertyAccesses(node: ts.Node): ts.PropertyAccessExpression[] {
  const accesses: ts.PropertyAccessExpression[] = [];
  
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n)) {
      accesses.push(n);
    }
    ts.forEachChild(n, visit);
  };
  
  visit(node);
  return accesses;
}

/**
 * Check if a function has a specific parameter
 */
export function hasParameter(func: ts.FunctionDeclaration | ts.MethodDeclaration, paramName: string): boolean {
  return func.parameters.some(param => 
    ts.isIdentifier(param.name) && param.name.text === paramName
  );
}

/**
 * Get the complexity of a node (simplified cyclomatic complexity)
 */
export function getNodeComplexity(node: ts.Node): number {
  let complexity = 1; // Base complexity
  
  const visit = (n: ts.Node) => {
    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.SwitchStatement:
      case ts.SyntaxKind.CaseClause:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.CatchClause:
        complexity++;
        break;
      case ts.SyntaxKind.BinaryExpression:
        const binaryExpr = n as ts.BinaryExpression;
        if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
          complexity++;
        }
        break;
    }
    
    ts.forEachChild(n, visit);
  };
  
  visit(node);
  return complexity;
}

/**
 * Extract type parameters from a generic declaration
 */
export function extractTypeParameters(node: ts.DeclarationWithTypeParameters): string[] {
  // Handle different types of declarations with type parameters
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isFunctionDeclaration(node)) {
    if (node.typeParameters) {
      return node.typeParameters.map(param => param.name.text);
    }
  }
  return [];
}

/**
 * Check if a type is a union type
 */
export function isUnionType(node: ts.TypeNode): boolean {
  return ts.isUnionTypeNode(node);
}

/**
 * Check if a type is an intersection type
 */
export function isIntersectionType(node: ts.TypeNode): boolean {
  return ts.isIntersectionTypeNode(node);
}

/**
 * Extract all type references from a type node
 */
export function extractTypeReferences(node: ts.TypeNode): string[] {
  const references: string[] = [];
  
  const visit = (n: ts.Node) => {
    if (ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName)) {
      references.push(n.typeName.text);
    }
    ts.forEachChild(n, visit);
  };
  
  visit(node);
  return references;
}