// All CPGQL query templates centralized here.
// This is the file to audit when upgrading Joern versions.
// The `query` tool is a raw passthrough and does not use templates.

function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// --- Workspace ---

export function importCode(path: string, name: string): string {
  return `importCode("${escapeString(path)}", "${escapeString(name)}")`;
}

export function listProjects(): string {
  return `workspace.getProjectNames`;
}

export function switchProject(name: string): string {
  return `workspace.setActiveProject("${escapeString(name)}")`;
}

export function closeProject(name: string): string {
  return `workspace.closeProject("${escapeString(name)}")`;
}

// --- Querying ---

export function getMethods(filter?: string): string {
  const base = filter
    ? `cpg.method.name("${escapeString(filter)}")`
    : `cpg.method`;
  return `${base}.map(m => (m.name, m.fullName, m.filename, m.lineNumber.getOrElse(-1))).l`;
}

export function getCalls(methodName?: string): string {
  const base = methodName
    ? `cpg.call.name("${escapeString(methodName)}")`
    : `cpg.call`;
  return `${base}.map(c => (c.name, c.methodFullName, c.code, c.lineNumber.getOrElse(-1))).l`;
}

export function getTypes(filter?: string): string {
  const base = filter
    ? `cpg.typeDecl.name("${escapeString(filter)}")`
    : `cpg.typeDecl`;
  return `${base}.map(t => (t.name, t.fullName, t.filename)).l`;
}

// --- Navigation ---

export function getSource(methodName: string): string {
  return `cpg.method.name("${escapeString(methodName)}").code.l`;
}

export function getCallers(methodName: string): string {
  return `cpg.method.name("${escapeString(methodName)}").caller.map(m => (m.name, m.fullName, m.filename)).l`;
}

export function getCallees(methodName: string): string {
  return `cpg.method.name("${escapeString(methodName)}").callee.map(m => (m.name, m.fullName, m.filename)).l`;
}

export function getParameters(methodName: string): string {
  return `cpg.method.name("${escapeString(methodName)}").parameter.map(p => (p.name, p.typeFullName, p.index)).l`;
}

// --- Security ---
// source and sink are CPGQL expressions like: method.name("gets").parameter

export function taintAnalysis(source: string, sink: string): string {
  return `val source = cpg.${source}; val sink = cpg.${sink}; sink.reachableByFlows(source).p`;
}

export function reachableBy(source: string, sink: string): string {
  return `val source = cpg.${source}; val sink = cpg.${sink}; sink.reachableBy(source).map(m => (m.name, m.fullName)).l`;
}

export function getDataFlows(source: string, sink: string): string {
  return `val source = cpg.${source}; val sink = cpg.${sink}; sink.reachableByFlows(source).p`;
}

export function findVulnerabilities(): string {
  return `run.ossdataflow; val results = cpg.findings.l; results`;
}
