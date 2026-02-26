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

// --- Class Hierarchy ---

export function getBaseClasses(className: string): string {
  return `cpg.typeDecl.name("${escapeString(className)}").baseTypeDecl.map(t => (t.name, t.fullName, t.filename)).l`;
}

export function getDerivedClasses(className: string): string {
  return `cpg.typeDecl.name("${escapeString(className)}").derivedTypeDecl.map(t => (t.name, t.fullName, t.filename)).l`;
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

// --- Vulnerability Detection ---

export interface VulnCategory {
  key: string;
  label: string;
  query: string;
}

const CALL_PROJECTION =
  ".map(c => (c.name, c.methodFullName, c.code, c.lineNumber.getOrElse(-1))).l";

export const VULN_CATEGORIES: VulnCategory[] = [
  {
    key: "dangerous_calls",
    label: "Dangerous Function Calls",
    query: `cpg.call.name("eval|exec|system|popen|spawn|passthru|shell_exec|proc_open|Runtime.exec|os.system|subprocess.call|subprocess.Popen")${CALL_PROJECTION}`,
  },
  {
    key: "sql_construction",
    label: "SQL Query Construction",
    query: `cpg.call.name("query|execute|executeQuery|executeUpdate|rawQuery|prepare|raw").where(_.argument.isCall.name("<operator>.addition|<operator>.formatString"))${CALL_PROJECTION}`,
  },
  {
    key: "hardcoded_credentials",
    label: "Hardcoded Credentials",
    query: `cpg.call.name("<operator>.assignment").where(_.argument.order(1).isIdentifier.name("(?i).*(password|passwd|secret|api_?key|token|credential).*")).where(_.argument.order(2).isLiteral)${CALL_PROJECTION}`,
  },
  {
    key: "unsafe_deserialization",
    label: "Unsafe Deserialization",
    query: `cpg.call.name("deserialize|readObject|unserialize|pickle.loads|yaml.load|unmarshal|ObjectInputStream.readObject")${CALL_PROJECTION}`,
  },
  {
    key: "path_traversal",
    label: "Path Traversal Indicators",
    query: `cpg.call.name("readFile|writeFile|readFileSync|writeFileSync|createReadStream|createWriteStream|open|fopen|unlink|rename|mkdir|rmdir")${CALL_PROJECTION}`,
  },
  {
    key: "debug_exposure",
    label: "Debug/Info Exposure",
    query: `cpg.call.name("console.log|console.error|System.out.println|println|printf|fprintf").where(_.argument.isIdentifier.name("(?i).*(password|secret|token|key|credential|auth|ssn|credit).*"))${CALL_PROJECTION}`,
  },
];

export const VULN_CATEGORY_KEYS = VULN_CATEGORIES.map((c) => c.key);

export function findVulnerabilities(categories?: string[]): VulnCategory[] {
  if (!categories || categories.length === 0) {
    return VULN_CATEGORIES;
  }
  return VULN_CATEGORIES.filter((c) => categories.includes(c.key));
}
