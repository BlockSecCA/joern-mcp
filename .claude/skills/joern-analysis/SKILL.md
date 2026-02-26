---
name: joern-analysis
description: Use this skill when performing code security analysis with Joern. Guides the workflow for importing code, navigating the CPG, tracing data flows, and finding vulnerabilities.
user-invocable: true
---

# Joern Security Analysis

Guide for using the joern-mcp tools to analyze code for security issues.

## Prerequisites

Joern must be running as a server before using any tools:

```bash
joern --server
```

Always start with `check_connection` to verify Joern is reachable.

## Workflow

### 1. Connect and import

```
check_connection          → verify Joern is up
import_code(path, name)   → build the CPG (slow, minutes for large projects)
list_projects             → see what's loaded
switch_project(name)      → activate a previously imported project
```

### 2. Explore the codebase

```
get_methods(filter?)      → list methods, optionally filtered by name
get_types(filter?)        → list classes/types
get_calls(methodName?)    → find call sites
get_source(methodName)    → read a method's source code
get_parameters(methodName)→ see parameter types and names
```

### 3. Navigate relationships

```
get_callers(methodName)   → who calls this method?
get_callees(methodName)   → what does this method call?
get_base_classes(className)    → parent/base classes (inheritance chain)
get_derived_classes(className) → child classes (all implementations)
```

### 4. Security analysis

```
find_vulnerabilities(categories?)  → structural pattern scan (reconnaissance)
taint_analysis(source, sink)       → trace data flow from source to sink
reachable_by(source, sink)         → check if sink is reachable from source
get_data_flows(source, sink)       → get all flow paths between two points
```

**Recommended flow:** `find_vulnerabilities` first to identify interesting patterns, then `taint_analysis` to confirm exploitability with full data flow paths.

### 5. Raw queries

```
query(cpgql)              → run arbitrary CPGQL for anything not covered above
```

## CPGQL Expression Reference

For `taint_analysis`, `reachable_by`, and `get_data_flows`, source and sink are CPGQL expressions relative to `cpg.`. They get wrapped as:

```scala
val source = cpg.<your_expression>; val sink = cpg.<your_expression>; sink.reachableByFlows(source).p
```

### Node types

| Step | What it matches | Example |
|------|----------------|---------|
| `call` | Function/method call sites | `call.name("eval")` |
| `method` | Function/method definitions | `method.name("handleRequest")` |
| `parameter` | Method parameters | `method.name("gets").parameter` |
| `argument` | Arguments passed to calls | `call.name("exec").argument` |
| `identifier` | Variable references | `identifier.name("password")` |
| `literal` | String/number literals | `literal.code(".*SELECT.*")` |

### Filtering

| Filter | What it does | Notes |
|--------|-------------|-------|
| `.name("regex")` | Match function/variable name | Java regex. Use `\|` for alternatives: `"eval\|exec\|system"` |
| `.code("regex")` | Match full code text | Matches the entire expression as written in source |
| `.where(_.predicate)` | Filter by sub-traversal | `call.name("query").where(_.code(".*sequelize.*"))` |
| `.argument.order(N)` | Nth argument (1-indexed) | Only works for simple arguments, NOT template literals |

### The golden rule: broad expressions

**Use BROAD source/sink expressions.** Let Joern's dataflow engine do the precision work. Overly specific expressions are the #1 cause of empty results.

```
GOOD: call.code(".*req\\.query.*")                    → matches all req.query accesses
BAD:  call.name("query").argument.order(1).code(".*criteria.*")  → too specific, misses template literals

GOOD: call.name("query").where(_.code(".*sequelize.*")) → matches sequelize.query broadly
BAD:  call.name("query").where(_.argument.order(1).isCall.name("concat"))  → assumes specific AST shape
```

### Common source patterns

**JavaScript/TypeScript (Express, Node.js):**
```
call.code(".*req\\.(query|params|body).*")     → HTTP request parameters
call.code(".*req\\.headers.*")                  → HTTP headers
call.name("readFileSync|readFile")              → file content
```

**Python (Flask, Django):**
```
call.name("input")                              → user input
call.code(".*request\\.(args|form|json).*")     → HTTP request parameters
call.name("environ.get|getenv")                 → environment variables
```

**Java (Servlet, Spring):**
```
call.name("getParameter|getHeader|getCookies")  → HTTP request data
method.name("doGet|doPost|service").parameter   → servlet entry points
call.name("readLine|read")                      → stream input
```

**C/C++:**
```
method.name("gets|scanf|fgets").parameter       → unsafe input functions
call.name("recv|read")                          → network/file input
method.name("main").parameter                   → command-line arguments
```

### Common sink patterns by vulnerability

**SQL Injection:**
```
call.name("query|execute|executeQuery|executeUpdate|rawQuery").where(_.code(".*sequelize.*|.*sql.*|.*SELECT.*"))
```

**Command Injection:**
```
call.name("eval|exec|system|popen|spawn|passthru|shell_exec|child_process")
```

**Path Traversal:**
```
call.name("readFile|writeFile|readFileSync|open|fopen|createReadStream")
```

**XSS (output sinks):**
```
call.name("send|write|render|innerHTML").where(_.code(".*res\\..*"))
```

**Unsafe Deserialization:**
```
call.name("deserialize|readObject|unserialize|pickle\\.loads|yaml\\.load")
```

### Debugging: always test independently first

Before running `taint_analysis`, verify that your source and sink expressions actually match nodes. Use the `query` tool:

```
Step 1: query("cpg.call.code(\".*req\\.query.*\").l.size")
        → should return > 0

Step 2: query("cpg.call.name(\"query\").where(_.code(\".*sequelize.*\")).l.size")
        → should return > 0

Step 3: NOW run taint_analysis with those expressions
```

If either returns 0, your expression doesn't match how Joern represents that code. Broaden it or use `query` to explore what nodes Joern actually created:

```
query("cpg.call.l.take(20)")           → see what calls exist
query("cpg.call.name.l.distinct")      → list all call names
query("cpg.method.name.l.distinct")    → list all method names
```

### Gotchas

**Template literals and string interpolation are NOT separate arguments.**
Joern represents `` `SELECT ${criteria}` `` as a single expression, not as a concat of parts. Don't use `.argument.order(1).code(".*criteria.*")` — it won't match. Use `.code(".*criteria.*")` on the call itself.

**Closures and callbacks work fine.**
Joern's dataflow engine traces through closures, arrow functions, and callbacks in JS/TS. If you get empty results on a closure pattern, the issue is your expressions, not Joern.

**`.name()` matches the function name, not the full qualified path.**
`call.name("query")` matches `sequelize.query()`, `db.query()`, and plain `query()`. Use `.where(_.code(".*qualifier.*"))` to narrow by the object.

**Regex in `.name()` is Java regex.**
Use `|` for alternatives: `"eval|exec|system"`. Dot is literal in function names but regex-special — escape it for patterns like `"console\\.log"`.

## Common Analysis Patterns

**Reconnaissance → confirmation workflow:**
```
1. find_vulnerabilities()                    → scan for structural patterns
2. Pick interesting findings
3. taint_analysis(broad_source, specific_sink) → confirm data flows to the finding
```

**Find all implementations of a security interface:**
```
get_derived_classes("Sanitizer")
→ then get_source on each to review implementations
```

**Map attack surface:**
```
get_methods("handle*")       → find handler methods
get_callers("handleRequest") → trace entry points
get_callees("handleRequest") → trace what handlers invoke
```

**Understand class hierarchy for access control:**
```
get_base_classes("AdminController")    → what does it extend?
get_derived_classes("BaseController")  → all controllers to audit
```

## Cleanup

```
close_project(name)       → free JVM memory when done
```

## Tips

- CPG generation (`import_code`) is the slow step — once built, queries are fast
- Use `query` for anything the structured tools don't cover
- Source/sink expressions are CPGQL fragments, not full queries — they get `cpg.` prepended
- `find_vulnerabilities` is structural pattern matching (fast) — use it first as reconnaissance
- `taint_analysis` is dataflow tracing (thorough) — use it to confirm specific findings
- Class hierarchy tools are transitive — they follow the full chain
- When in doubt, use `query` to explore the CPG and see what nodes Joern created
