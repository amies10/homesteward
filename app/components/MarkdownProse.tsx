import React from "react";

function renderInline(text: string): React.ReactNode[] {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-porch-text">
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
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          const label = trimmed.replace(/^#{1,3}\s/, "");
          return (
            <p key={i} className="text-[14.5px] font-semibold text-porch-text">
              {label}
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
                  <li key={j} className="list-disc text-[13.5px] leading-relaxed text-porch-text-secondary">
                    {renderInline(l.trim().replace(/^[-*]\s/, ""))}
                  </li>
                ))}
            </ul>
          );
        }

        // Regular paragraph — collapse single newlines
        const collapsed = trimmed.replace(/\n/g, " ");
        return (
          <p key={i} className="text-[14px] leading-[1.65] text-[#3A3532]">
            {renderInline(collapsed)}
          </p>
        );
      })}
    </div>
  );
}
