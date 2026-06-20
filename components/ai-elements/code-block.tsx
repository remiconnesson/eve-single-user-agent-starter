"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties, HTMLAttributes } from "react";
import { memo, useEffect, useMemo, useState } from "react";
import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  ThemedToken,
} from "shiki";
import { createHighlighter } from "shiki";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  readonly code: string;
  readonly language: BundledLanguage;
  readonly showLineNumbers?: boolean;
};

interface TokenizedCode {
  readonly bg: string;
  readonly fg: string;
  readonly tokens: ThemedToken[][];
}

interface KeyedToken {
  readonly key: string;
  readonly token: ThemedToken;
}

interface KeyedLine {
  readonly key: string;
  readonly tokens: KeyedToken[];
}

interface AsyncTokens {
  readonly key: string;
  readonly value: TokenizedCode;
}

const MAX_TOKENS_CACHE_ENTRIES = 256;
const highlighterCache = new Map<
  string,
  Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
>();
const tokensCache = new Map<string, TokenizedCode>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

const getTokensCacheKey = (code: string, language: BundledLanguage) =>
  `${language}:${code}`;

function setTokensCache(key: string, value: TokenizedCode): void {
  tokensCache.set(key, value);
  while (tokensCache.size > MAX_TOKENS_CACHE_ENTRIES) {
    const oldest = tokensCache.keys().next().value;
    if (oldest === undefined) return;
    tokensCache.delete(oldest);
  }
}

function getHighlighter(
  language: BundledLanguage,
): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
  const cached = highlighterCache.get(language);
  if (cached) return cached;

  const highlighter = createHighlighter({
    langs: [language],
    themes: ["github-light", "github-dark"],
  });
  highlighterCache.set(language, highlighter);
  return highlighter;
}

function createRawTokens(code: string): TokenizedCode {
  return {
    bg: "transparent",
    fg: "inherit",
    tokens: code.split("\n").map((line) =>
      line === ""
        ? []
        : [
            {
              color: "inherit",
              content: line,
              offset: 0,
            },
          ],
    ),
  };
}

function highlightCode(
  code: string,
  language: BundledLanguage,
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null {
  const key = getTokensCacheKey(code, language);
  const cached = tokensCache.get(key);
  if (cached) {
    tokensCache.delete(key);
    tokensCache.set(key, cached);
    return cached;
  }

  if (callback) {
    const listeners = subscribers.get(key) ?? new Set();
    listeners.add(callback);
    subscribers.set(key, listeners);
  }

  void getHighlighter(language)
    .then((highlighter) => {
      const result = highlighter.codeToTokens(code, {
        lang: language,
        themes: {
          dark: "github-dark",
          light: "github-light",
        },
      });
      const tokenized = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      } satisfies TokenizedCode;

      setTokensCache(key, tokenized);
      for (const listener of subscribers.get(key) ?? []) listener(tokenized);
      subscribers.delete(key);
    })
    .catch(() => {
      subscribers.delete(key);
    });

  return null;
}

const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-8",
  "before:mr-4",
  "before:text-right",
  "before:text-muted-foreground/50",
  "before:font-mono",
  "before:select-none",
);

function tokenStyle(token: ThemedToken): CSSProperties {
  const fontStyle = token.fontStyle;
  return {
    backgroundColor: token.bgColor,
    color: token.color,
    fontStyle: fontStyle !== undefined && (fontStyle & 1) !== 0 ? "italic" : undefined,
    fontWeight: fontStyle !== undefined && (fontStyle & 2) !== 0 ? "bold" : undefined,
    textDecoration:
      fontStyle !== undefined && (fontStyle & 4) !== 0 ? "underline" : undefined,
    ...token.htmlStyle,
  };
}

function addKeysToTokens(lines: ThemedToken[][]): KeyedLine[] {
  return lines.map((line, lineIndex) => ({
    key: `line-${lineIndex}`,
    tokens: line.map((token, tokenIndex) => ({
      key: `line-${lineIndex}-${tokenIndex}`,
      token,
    })),
  }));
}

function TokenSpan({ token }: { readonly token: ThemedToken }) {
  return (
    <span
      className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
      style={tokenStyle(token)}
    >
      {token.content}
    </span>
  );
}

function LineSpan({
  line,
  showLineNumbers,
}: {
  readonly line: KeyedLine;
  readonly showLineNumbers: boolean;
}) {
  return (
    <span className={showLineNumbers ? LINE_NUMBER_CLASSES : "block"}>
      {line.tokens.length === 0
        ? "\n"
        : line.tokens.map(({ key, token }) => (
            <TokenSpan key={key} token={token} />
          ))}
    </span>
  );
}

const CodeBlockBody = memo(function CodeBlockBody({
  className,
  showLineNumbers,
  tokenized,
}: {
  readonly className?: string;
  readonly showLineNumbers: boolean;
  readonly tokenized: TokenizedCode;
}) {
  const lines = useMemo(
    () => addKeysToTokens(tokenized.tokens),
    [tokenized.tokens],
  );
  const style = useMemo<CSSProperties>(
    () => ({ backgroundColor: tokenized.bg, color: tokenized.fg }),
    [tokenized.bg, tokenized.fg],
  );

  return (
    <pre
      className={cn(
        "dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)] m-0 p-4 text-sm",
        className,
      )}
      style={style}
    >
      <code
        className={cn(
          "font-mono text-sm",
          showLineNumbers && "[counter-increment:line_0] [counter-reset:line]",
        )}
      >
        {lines.map((line) => (
          <LineSpan key={line.key} line={line} showLineNumbers={showLineNumbers} />
        ))}
      </code>
    </pre>
  );
});

function CodeBlockContent({
  code,
  language,
  showLineNumbers,
}: {
  readonly code: string;
  readonly language: BundledLanguage;
  readonly showLineNumbers: boolean;
}) {
  const cacheKey = getTokensCacheKey(code, language);
  const rawTokens = useMemo(() => createRawTokens(code), [code]);
  const syncTokens = useMemo(
    () => highlightCode(code, language) ?? rawTokens,
    [code, language, rawTokens],
  );
  const [asyncTokens, setAsyncTokens] = useState<AsyncTokens | null>(null);

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, language, (value) => {
      if (!cancelled) setAsyncTokens({ key: cacheKey, value });
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, code, language]);

  const tokenized = asyncTokens?.key === cacheKey ? asyncTokens.value : syncTokens;
  return (
    <div className="relative overflow-auto">
      <CodeBlockBody showLineNumbers={showLineNumbers} tokenized={tokenized} />
    </div>
  );
}

export function CodeBlock({
  className,
  code,
  language,
  showLineNumbers = false,
  style,
  ...props
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
        className,
      )}
      data-language={language}
      style={{
        containIntrinsicSize: "auto 200px",
        contentVisibility: "auto",
        ...style,
      }}
      {...props}
    >
      <CodeBlockContent
        code={code}
        language={language}
        showLineNumbers={showLineNumbers}
      />
    </div>
  );
}
