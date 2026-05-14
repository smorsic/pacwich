import { describe, expect, test } from "bun:test";
import { sanitizeOutput } from "../../../src/internal/core";

describe("sanitizeOutput", () => {
  test("returns plain text unchanged", () => {
    expect(sanitizeOutput("my-workspace")).toBe("my-workspace");
    expect(sanitizeOutput("path/with/slashes")).toBe("path/with/slashes");
    expect(sanitizeOutput("scoped @user/pkg name-1.2")).toBe(
      "scoped @user/pkg name-1.2",
    );
  });

  test("preserves newlines and tabs", () => {
    expect(sanitizeOutput("line1\nline2")).toBe("line1\nline2");
    expect(sanitizeOutput("col1\tcol2")).toBe("col1\tcol2");
    expect(sanitizeOutput("a\n\tb")).toBe("a\n\tb");
  });

  test("strips ANSI color (SGR) sequences", () => {
    expect(sanitizeOutput("\x1b[31mred\x1b[0m")).toBe("red");
    expect(sanitizeOutput("\x1b[1;33mbold yellow\x1b[0m text")).toBe(
      "bold yellow text",
    );
  });

  test("strips screen-clearing and cursor sequences", () => {
    expect(sanitizeOutput("hi\x1b[2Jbye")).toBe("hibye");
    expect(sanitizeOutput("\x1b[Hreset cursor")).toBe("reset cursor");
    expect(sanitizeOutput("\x1b[3Aup three")).toBe("up three");
  });

  test("strips OSC sequences (terminal title, hyperlinks)", () => {
    // OSC 8 hyperlink: ESC ] 8 ; ; URL ESC \ TEXT ESC ] 8 ; ; ESC \
    expect(
      sanitizeOutput(
        "\x1b]8;;https://evil.example\x1b\\click me\x1b]8;;\x1b\\",
      ),
    ).toBe("click me");
  });

  test("strips BEL, backspace, vertical tab, form feed", () => {
    expect(sanitizeOutput("alert\x07")).toBe("alert");
    expect(sanitizeOutput("oops\x08\x08fix")).toBe("oopsfix");
    expect(sanitizeOutput("a\x0bb")).toBe("ab");
    expect(sanitizeOutput("a\x0cb")).toBe("ab");
  });

  test("strips C1 controls and DEL", () => {
    // \x84 (IND) is a C1 control with no follow-on bytes — verifies the
    // control-strip regex catches it after Bun.stripANSI runs.
    expect(sanitizeOutput("a\x84b")).toBe("ab");
    expect(sanitizeOutput("a\x7fb")).toBe("ab");
  });

  test("handles an empty string", () => {
    expect(sanitizeOutput("")).toBe("");
  });

  test("composite: workspace-name-style payload", () => {
    const malicious = `evil\x1b[2J\x1b[H\x07name`;
    expect(sanitizeOutput(malicious)).toBe("evilname");
  });
});
