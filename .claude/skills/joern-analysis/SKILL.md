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
find_vulnerabilities      → run default vulnerability scan
taint_analysis(source, sink)   → trace data flow from source to sink
reachable_by(source, sink)     → check if sink is reachable from source
get_data_flows(source, sink)   → get all flow paths between two points
```

### 5. Raw queries

```
query(cpgql)              → run arbitrary CPGQL for anything not covered above
```

## Source/Sink Syntax

For `taint_analysis`, `reachable_by`, and `get_data_flows`, source and sink are CPGQL expressions relative to `cpg.`:

```
source: method.name("gets").parameter
sink:   method.name("strcpy").parameter
```

These get wrapped as `val source = cpg.<expr>; val sink = cpg.<expr>; ...`

## Common Analysis Patterns

**Find all implementations of a security interface:**
```
get_derived_classes("Sanitizer")
→ then get_source on each to review implementations
```

**Trace user input to dangerous sinks:**
```
taint_analysis(
  source: 'method.name("getParameter").parameter',
  sink: 'method.name("executeQuery").parameter'
)
```

**Map attack surface:**
```
get_methods("handle*")     → find handler methods
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
- Source/sink expressions are CPGQL fragments, not full queries
- `find_vulnerabilities` runs Joern's built-in scanner — good starting point
- Class hierarchy tools are transitive — they follow the full chain
