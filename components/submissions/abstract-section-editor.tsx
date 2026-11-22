"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { useEffect, useState } from "react";
import { Bold, Italic, Redo2, Sigma, Subscript as SubIcon, Superscript as SupIcon, Undo2 } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { countWordsInHtml, validateAbstractHtml } from "@/lib/html";
import { cn } from "@/lib/utils";

const SYMBOLS = [
  { symbol: "α", name: "alpha" },
  { symbol: "β", name: "beta" },
  { symbol: "γ", name: "gamma" },
  { symbol: "δ", name: "delta" },
  { symbol: "ε", name: "epsilon" },
  { symbol: "θ", name: "theta" },
  { symbol: "λ", name: "lambda" },
  { symbol: "μ", name: "mu" },
  { symbol: "π", name: "pi" },
  { symbol: "σ", name: "sigma" },
  { symbol: "τ", name: "tau" },
  { symbol: "φ", name: "phi" },
  { symbol: "χ", name: "chi" },
  { symbol: "ψ", name: "psi" },
  { symbol: "ω", name: "omega" },
  { symbol: "±", name: "plus or minus" },
  { symbol: "≤", name: "less than or equal to" },
  { symbol: "≥", name: "greater than or equal to" },
  { symbol: "≠", name: "not equal to" },
  { symbol: "≈", name: "approximately" },
  { symbol: "°", name: "degree" },
  { symbol: "µg", name: "microgram" },
  { symbol: "µL", name: "microlitre" },
  { symbol: "→", name: "right arrow" },
  { symbol: "←", name: "left arrow" },
  { symbol: "↑", name: "increase" },
  { symbol: "↓", name: "decrease" },
];

/**
 * One abstract section (SUB-02/04). Toolbar is limited to what the
 * guidelines allow: bold, italic, superscript, subscript and symbols.
 * Tables and images are blocked — pasted ones are stripped (unchanged
 * behaviour) and the author is told so.
 */
export function AbstractSectionEditor({
  id,
  label,
  value,
  onChange,
  placeholder = "Write this section…",
  className,
}: {
  id: string;
  /** Section name, used for the editor's accessible label. */
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [symbolOpen, setSymbolOpen] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Superscript, Subscript],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text max-w-none min-h-[9rem] px-4 py-3 outline-none",
        "aria-label": `${label} — abstract section`,
        "aria-multiline": "true",
        role: "textbox",
        id,
        "data-placeholder": placeholder,
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html") || "";
        if (html) {
          const check = validateAbstractHtml(html);
          if (!check.valid) {
            toast.warning("Tables and images were removed", "Only the text was pasted. Describe results in words or numbers.");
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className={cn("min-h-44 animate-pulse rounded-md border border-input bg-muted/40", className)} />;
  }

  const words = countWordsInHtml(value);
  const tools = [
    { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Superscript", icon: SupIcon, active: editor.isActive("superscript"), run: () => editor.chain().focus().toggleSuperscript().run() },
    { label: "Subscript", icon: SubIcon, active: editor.isActive("subscript"), run: () => editor.chain().focus().toggleSubscript().run() },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className,
      )}
    >
      <div role="toolbar" aria-label={`Formatting for ${label}`} className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 p-1">
        {tools.map(({ label: l, icon: Icon, active, run }) => (
          <Button
            key={l}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={l}
            aria-pressed={active}
            onClick={run}
            className={cn(active && "bg-primary-tint text-brand-ink")}
          >
            <Icon />
          </Button>
        ))}
        <Popover open={symbolOpen} onOpenChange={setSymbolOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" aria-label="Insert a symbol">
              <Sigma data-icon="inline-start" />
              Symbols
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-2" align="start">
            <p className="mb-2 px-1 text-sm text-muted-foreground">Greek letters and medical symbols</p>
            <div className="grid grid-cols-6 gap-1">
              {SYMBOLS.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().insertContent(s.symbol).run();
                    setSymbolOpen(false);
                  }}
                  aria-label={`Insert ${s.name}`}
                  className="flex h-11 items-center justify-center rounded-md border border-border text-base hover:bg-muted"
                >
                  {s.symbol}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 />
        </Button>
        <span className="ml-auto px-2 text-sm text-muted-foreground tabular-nums" aria-live="off">
          {words} {words === 1 ? "word" : "words"}
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
