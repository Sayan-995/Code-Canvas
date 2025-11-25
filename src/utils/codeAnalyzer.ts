import * as ts from 'typescript';

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  calls: CallInfo[];
  returns: number[];
}

export interface EndpointInfo {
  method: string;
  path: string;
  handler: string;
  line: number;
}

export interface CallInfo {
  name: string;
  line: number;
}

export interface FileAnalysis {
  path: string;
  functions: FunctionInfo[];
  imports: ImportInfo[];
  endpoints: EndpointInfo[];
}

export interface ImportInfo {
  moduleSpecifier: string;
  defaultImport?: string;
  namedImports: string[];
}

export const analyzeCode = (path: string, content: string): FileAnalysis => {
  const sourceFile = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const functions: FunctionInfo[] = [];
  const imports: ImportInfo[] = [];

  const visit = (node: ts.Node) => {
    // Check for Function Declaration: function foo() {}
    if (ts.isFunctionDeclaration(node) && node.name) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      const calls = findCalls(node, sourceFile);
      const returns = findReturns(node, sourceFile);
      functions.push({
        name: node.name.text,
        startLine: start,
        endLine: end,
        calls,
        returns,
      });
    }
    // Check for Variable Declaration with Arrow Function: const foo = () => {}
    else if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((declaration) => {
        if (
          declaration.name &&
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
          const start = sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1;
          const end = sourceFile.getLineAndCharacterOfPosition(declaration.getEnd()).line + 1;
          const calls = findCalls(declaration.initializer, sourceFile);
          const returns = findReturns(declaration.initializer, sourceFile);
          functions.push({
            name: declaration.name.text,
            startLine: start,
            endLine: end,
            calls,
            returns,
          });
        }
      });
    }
    // Check for Imports
    else if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const namedImports: string[] = [];
      let defaultImport: string | undefined;

      if (node.importClause) {
        if (node.importClause.name) {
          defaultImport = node.importClause.name.text;
        }
        if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach((element) => {
            namedImports.push(element.name.text);
          });
        }
      }
      imports.push({ moduleSpecifier, defaultImport, namedImports });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  
  const endpoints = findEndpoints(sourceFile);

  return { path, functions, imports, endpoints };
};

const findEndpoints = (sourceFile: ts.SourceFile): EndpointInfo[] => {
  const endpoints: EndpointInfo[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text;
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        if (n.arguments.length >= 2) {
           const pathArg = n.arguments[0];
           const handlerArg = n.arguments[1]; // Simplified: assuming 2nd arg is handler
           
           if (ts.isStringLiteral(pathArg) && ts.isIdentifier(handlerArg)) {
             const line = sourceFile.getLineAndCharacterOfPosition(n.getStart()).line + 1;
             endpoints.push({
               method,
               path: pathArg.text,
               handler: handlerArg.text,
               line
             });
           }
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sourceFile);
  return endpoints;
}

const findCalls = (node: ts.Node, sourceFile: ts.SourceFile): CallInfo[] => {
  const calls: CallInfo[] = [];

  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      if (ts.isIdentifier(n.expression)) {
        const line = sourceFile.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        calls.push({ name: n.expression.text, line });
      } else if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.name)) {
         // Handle obj.method() - store 'method' or 'obj.method'?
         // For now, let's store the method name if it might be imported
         const line = sourceFile.getLineAndCharacterOfPosition(n.getStart()).line + 1;
         calls.push({ name: n.expression.name.text, line });
      }
    }
    // Also check for JSX Elements as "calls" to components
    else if (ts.isJsxSelfClosingElement(n) && ts.isIdentifier(n.tagName)) {
        const line = sourceFile.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        calls.push({ name: n.tagName.text, line });
    }
    else if (ts.isJsxOpeningElement(n) && ts.isIdentifier(n.tagName)) {
        const line = sourceFile.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        calls.push({ name: n.tagName.text, line });
    }

    ts.forEachChild(n, visit);
  };

  visit(node);
  return calls;
};

const findReturns = (node: ts.Node, sourceFile: ts.SourceFile): number[] => {
  const returns: number[] = [];

  // Handle concise arrow function body: const foo = () => 5;
  if (ts.isArrowFunction(node) && node.body && !ts.isBlock(node.body)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.body.getStart()).line + 1;
      returns.push(line);
      return returns;
  }

  const visit = (n: ts.Node) => {
    if (ts.isReturnStatement(n)) {
      const line = sourceFile.getLineAndCharacterOfPosition(n.getStart()).line + 1;
      returns.push(line);
    }
    
    // If it's a function boundary (and not the root node we started with), don't go inside
    if ((ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n !== node) {
      return;
    }

    ts.forEachChild(n, visit);
  };
  
  ts.forEachChild(node, visit);
  return returns;
};
