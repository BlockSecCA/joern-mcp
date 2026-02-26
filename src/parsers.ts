const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

const REPL_RE = /^val res\d+:\s*.+?\s*=\s*/s;

export function parseScalaOutput(stdout: string): string {
  const clean = stripAnsi(stdout).trim();
  const match = clean.match(REPL_RE);
  if (match) {
    return clean.slice(match[0].length).trim();
  }
  return clean;
}

export interface ClassifiedOutput {
  kind: "value" | "error" | "empty";
  content: string;
}

const ERROR_PATTERNS = [
  /^-- Error:/m,
  /^-- \[E/m,
  /Exception/,
  /^error:/im,
  /^java\./m,
  /^scala\./m,
  /^at \w/m,
];

export function classifyOutput(stdout: string): ClassifiedOutput {
  const stripped = stripAnsi(stdout);

  if (!stripped.trim()) {
    return { kind: "empty", content: "" };
  }

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(stripped)) {
      return { kind: "error", content: stripped.trim() };
    }
  }

  return { kind: "value", content: parseScalaOutput(stdout) };
}
