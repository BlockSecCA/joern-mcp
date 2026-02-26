import { describe, it, expect } from "vitest";
import * as cpgql from "../src/cpgql.js";

describe("workspace queries", () => {
  it("importCode generates correct CPGQL", () => {
    expect(cpgql.importCode("/tmp/repo", "test-project")).toBe(
      'importCode("/tmp/repo", "test-project")',
    );
  });

  it("importCode escapes paths with special characters", () => {
    expect(cpgql.importCode('/tmp/my "project"', "test")).toBe(
      'importCode("/tmp/my \\"project\\"", "test")',
    );
  });

  it("listProjects returns workspace query", () => {
    expect(cpgql.listProjects()).toBe("workspace.getProjectNames");
  });

  it("switchProject generates correct CPGQL", () => {
    expect(cpgql.switchProject("my-project")).toBe(
      'workspace.setActiveProject("my-project")',
    );
  });

  it("closeProject generates correct CPGQL", () => {
    expect(cpgql.closeProject("my-project")).toBe(
      'workspace.closeProject("my-project")',
    );
  });
});

describe("querying queries", () => {
  it("getMethods without filter lists all", () => {
    expect(cpgql.getMethods()).toBe(
      "cpg.method.map(m => (m.name, m.fullName, m.filename, m.lineNumber.getOrElse(-1))).l",
    );
  });

  it("getMethods with filter", () => {
    expect(cpgql.getMethods("main")).toContain('.name("main")');
  });

  it("getCalls without filter lists all", () => {
    expect(cpgql.getCalls()).toContain("cpg.call.map");
  });

  it("getCalls with method name", () => {
    expect(cpgql.getCalls("printf")).toContain('.name("printf")');
  });

  it("getTypes without filter lists all", () => {
    expect(cpgql.getTypes()).toContain("cpg.typeDecl.map");
  });

  it("getTypes with filter", () => {
    expect(cpgql.getTypes("User")).toContain('.name("User")');
  });
});

describe("navigation queries", () => {
  it("getSource", () => {
    expect(cpgql.getSource("main")).toBe(
      'cpg.method.name("main").code.l',
    );
  });

  it("getCallers", () => {
    expect(cpgql.getCallers("validate")).toContain('.name("validate").caller');
  });

  it("getCallees", () => {
    expect(cpgql.getCallees("main")).toContain('.name("main").callee');
  });

  it("getParameters", () => {
    expect(cpgql.getParameters("main")).toContain('.name("main").parameter');
  });
});

describe("security queries", () => {
  it("taintAnalysis constructs source/sink flow", () => {
    const q = cpgql.taintAnalysis(
      'method.name("gets").parameter',
      'method.name("strcpy").parameter',
    );
    expect(q).toContain('val source = cpg.method.name("gets").parameter');
    expect(q).toContain('val sink = cpg.method.name("strcpy").parameter');
    expect(q).toContain("sink.reachableByFlows(source).p");
  });

  it("reachableBy constructs reachability check", () => {
    const q = cpgql.reachableBy(
      'method.name("source").parameter',
      'method.name("sink").parameter',
    );
    expect(q).toContain("sink.reachableBy(source)");
  });

  it("getDataFlows constructs flow query", () => {
    const q = cpgql.getDataFlows(
      'method.name("source").parameter',
      'method.name("sink").parameter',
    );
    expect(q).toContain("sink.reachableByFlows(source).p");
  });

  it("findVulnerabilities runs ossdataflow", () => {
    expect(cpgql.findVulnerabilities()).toContain("run.ossdataflow");
  });
});

describe("escaping", () => {
  it("escapes backslashes in paths", () => {
    expect(cpgql.importCode("C:\\Users\\test", "proj")).toContain(
      "C:\\\\Users\\\\test",
    );
  });

  it("escapes quotes in names", () => {
    expect(cpgql.switchProject('my"project')).toContain('my\\"project');
  });
});
