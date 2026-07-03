import { type ComponentProps } from "react";
import { Light as SyntaxHighlighterLight } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import markdown from "react-syntax-highlighter/dist/esm/languages/hljs/markdown";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import html from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import yaml from "react-syntax-highlighter/dist/esm/languages/hljs/yaml";
import { stackoverflowDark as dark } from "react-syntax-highlighter/dist/esm/styles/hljs";

SyntaxHighlighterLight.registerLanguage("bash", bash);
SyntaxHighlighterLight.registerLanguage("json", json);
SyntaxHighlighterLight.registerLanguage("html", html);
SyntaxHighlighterLight.registerLanguage("typescript", typescript);
SyntaxHighlighterLight.registerLanguage("tsx", typescript);
SyntaxHighlighterLight.registerLanguage("yaml", yaml);
SyntaxHighlighterLight.registerLanguage("markdown", markdown);

/**
 * @todo This is a workaround for non-markdown code blocks. Maybe it will be possible
 * to use a core rspress API instead in the future
 */
export const SyntaxHighlighter = (
  props: ComponentProps<typeof SyntaxHighlighterLight>,
) => {
  return (
    <SyntaxHighlighterLight
      {...props}
      children={
        typeof props.children === "string"
          ? props.children.trim()
          : props.children.map((child) => child.trim())
      }
      customStyle={{
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        backgroundColor: "var(--rp-c-code-block-bg)",
        border: "1px solid rgba(40, 44, 52, 0.52)",
        lineHeight: "1.4",
        color: "var(--code-base-color)",
        margin: "0.5rem 0",
      }}
      style={{
        ...dark,
        "hljs-string": {
          color: "var(--code-string-color)",
        },
        "hljs-keyword": {
          color: "var(--code-keyword-color)",
        },
        "hljs-attr": {
          color: "var(--code-attr-color)",
        },
        "hljs-built_in": {
          color: "var(--code-built-in-color)",
        },
        "hljs-comment": {
          color: "var(--code-comment-color)",
        },
      }}
    />
  );
};
