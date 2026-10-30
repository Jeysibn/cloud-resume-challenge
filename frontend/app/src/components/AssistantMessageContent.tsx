import type { ReactNode } from "react";

type ListBlock = {
  kind: "ul" | "ol";
  items: string[];
};

type TextBlock = {
  kind: "paragraph";
  lines: string[];
};

type MessageBlock = ListBlock | TextBlock;

const UNORDERED_ITEM = /^\s*[-+*]\s+(.+)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.+)$/;
const INLINE_TOKEN = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    if (token.startsWith("**") || token.startsWith("__")) {
      parts.push(<strong key={`${keyPrefix}-strong-${index}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<code key={`${keyPrefix}-code-${index}`}>{token.slice(1, -1)}</code>);
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function parseBlocks(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let paragraph: string[] = [];
  let list: ListBlock | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };

  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const unordered = line.match(UNORDERED_ITEM);
    const ordered = line.match(ORDERED_ITEM);
    if (unordered || ordered) {
      flushParagraph();
      const kind = unordered ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list.items.push((unordered ?? ordered)?.[1] ?? "");
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="assistant-content">
      {blocks.map((block, blockIndex) => {
        if (block.kind === "paragraph") {
          return (
            <p key={`paragraph-${blockIndex}`}>
              {block.lines.map((line, lineIndex) => (
                <span key={`line-${lineIndex}`}>
                  {lineIndex > 0 ? <br /> : null}
                  {renderInline(line, `${blockIndex}-${lineIndex}`)}
                </span>
              ))}
            </p>
          );
        }

        const List = block.kind;
        return (
          <List key={`${List}-${blockIndex}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${blockIndex}-${itemIndex}`}>
                {renderInline(item, `${blockIndex}-${itemIndex}`)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
