import { renderInlineMarkdown } from "./inlineMarkdown";

export default function MarkdownProse({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const trimmed = block.trim();

        if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          // A header and its paragraph sometimes arrive without a blank line
          // between them, collapsing into one block — only the first line is
          // the header; anything after it is body text, not part of the title.
          const lines = trimmed.split("\n");
          const label = lines[0].replace(/^#{1,3}\s/, "");
          const rest = lines.slice(1).join(" ").trim();
          return (
            <div key={i}>
              <p className="text-[14.5px] font-semibold text-porch-text">{label}</p>
              {rest && (
                <p className="mt-1.5 text-[14px] leading-[1.65] text-[#3A3532]">
                  {renderInlineMarkdown(rest)}
                </p>
              )}
            </div>
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
                    {renderInlineMarkdown(l.trim().replace(/^[-*]\s/, ""))}
                  </li>
                ))}
            </ul>
          );
        }

        // Regular paragraph — collapse single newlines
        const collapsed = trimmed.replace(/\n/g, " ");
        return (
          <p key={i} className="text-[14px] leading-[1.65] text-[#3A3532]">
            {renderInlineMarkdown(collapsed)}
          </p>
        );
      })}
    </div>
  );
}
