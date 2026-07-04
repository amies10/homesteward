import React from "react";

function renderInline(text: string): React.ReactNode[] {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-stone-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function MarkdownProse({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        if (trimmed.startsWith("### ")) {
          return (
            <p key={i} className="text-xs font-semibold text-stone-800">
              {trimmed.slice(4)}
            </p>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <p key={i} className="text-xs font-semibold text-stone-800">
              {trimmed.slice(3)}
            </p>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <p key={i} className="text-xs font-semibold text-stone-800">
              {trimmed.slice(2)}
            </p>
          );
        }

        // Bullet list block — lines starting with "- " or "* "
        const lines = trimmed.split("\n");
        const isList = lines.every((l) => /^[-*]\s/.test(l.trim()) || l.trim() === "");
        if (isList) {
          return (
            <ul key={i} className="space-y-1 pl-4">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j} className="list-disc text-xs leading-relaxed text-stone-600">
                    {renderInline(l.trim().replace(/^[-*]\s/, ""))}
                  </li>
                ))}
            </ul>
          );
        }

        // Regular paragraph — collapse single newlines
        const collapsed = trimmed.replace(/\n/g, " ");
        return (
          <p key={i} className="text-xs leading-relaxed text-stone-600">
            {renderInline(collapsed)}
          </p>
        );
      })}
    </div>
  );
}
