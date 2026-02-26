import { describe, it, expect } from "vitest";
import { stripAnsi, parseScalaOutput, classifyOutput } from "../src/parsers.js";

describe("stripAnsi", () => {
  it("removes color codes", () => {
    expect(stripAnsi("\x1b[32mgreen\x1b[0m")).toBe("green");
  });

  it("removes bold and other SGR codes", () => {
    expect(stripAnsi("\x1b[1m\x1b[31mBold Red\x1b[0m")).toBe("Bold Red");
  });

  it("leaves clean text untouched", () => {
    expect(stripAnsi("no escape codes")).toBe("no escape codes");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("strips multiple sequences in one string", () => {
    expect(stripAnsi("\x1b[36mval\x1b[0m \x1b[33mres0\x1b[0m: Int = 42")).toBe(
      "val res0: Int = 42",
    );
  });
});

describe("parseScalaOutput", () => {
  it("extracts value from simple REPL output", () => {
    expect(parseScalaOutput('val res0: Int = 42')).toBe("42");
  });

  it("extracts list value", () => {
    const input = 'val res0: List[String] = List("main", "foo", "bar")';
    expect(parseScalaOutput(input)).toBe('List("main", "foo", "bar")');
  });

  it("handles multiline list", () => {
    const input = `val res0: List[String] = List(
  "main",
  "foo",
  "bar"
)`;
    expect(parseScalaOutput(input)).toBe(`List(
  "main",
  "foo",
  "bar"
)`);
  });

  it("returns raw string when no REPL pattern", () => {
    expect(parseScalaOutput("just a string")).toBe("just a string");
  });

  it("strips ANSI before parsing", () => {
    expect(parseScalaOutput("\x1b[36mval\x1b[0m res0: Int = 42")).toBe("42");
  });

  it("handles empty string", () => {
    expect(parseScalaOutput("")).toBe("");
  });

  it("handles res with higher numbers", () => {
    expect(parseScalaOutput("val res15: String = hello")).toBe("hello");
  });
});

describe("classifyOutput", () => {
  it("classifies empty string as empty", () => {
    expect(classifyOutput("")).toEqual({ kind: "empty", content: "" });
  });

  it("classifies whitespace-only as empty", () => {
    expect(classifyOutput("   \n  ")).toEqual({ kind: "empty", content: "" });
  });

  it("classifies normal output as value", () => {
    const result = classifyOutput('val res0: List[String] = List("main")');
    expect(result.kind).toBe("value");
    expect(result.content).toBe('List("main")');
  });

  it("classifies Scala 3 compiler error", () => {
    const input = `-- Error: /path/to/file.sc:1:0
       |bad syntax
       |^`;
    const result = classifyOutput(input);
    expect(result.kind).toBe("error");
    expect(result.content).toContain("-- Error:");
  });

  it("classifies Scala 3 typed error", () => {
    const input = `-- [E007] Type Mismatch Error:
       |found:    Int
       |required: String`;
    const result = classifyOutput(input);
    expect(result.kind).toBe("error");
  });

  it("classifies Java exception", () => {
    const input = `java.lang.RuntimeException: No active project
  at io.joern.console.workspacehandling.WorkspaceManager.getActiveProject`;
    const result = classifyOutput(input);
    expect(result.kind).toBe("error");
    expect(result.content).toContain("RuntimeException");
  });

  it("classifies Scala exception", () => {
    const input = `scala.MatchError: foo (of class java.lang.String)`;
    const result = classifyOutput(input);
    expect(result.kind).toBe("error");
  });

  it("classifies stack trace", () => {
    const input = `Something went wrong
at org.example.Foo.bar(Foo.scala:42)`;
    const result = classifyOutput(input);
    expect(result.kind).toBe("error");
  });

  it("strips ANSI before classifying", () => {
    const input = "\x1b[31m-- Error: bad\x1b[0m";
    const result = classifyOutput(input);
    expect(result.kind).toBe("error");
  });
});
