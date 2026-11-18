"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { countWordsInHtml, validateAbstractHtml } from "@/lib/html";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
  Sigma,
} from "lucide-react";
import { toast } from "sonner";

const GREEK_AND_MATH_SYMBOLS = [
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
  { symbol: "±", name: "plus-minus" },
  { symbol: "≤", name: "less than or equal" },
  { symbol: "≥", name: "greater than or equal" },
  { symbol: "≠", name: "not equal" },
  { symbol: "≈", name: "approximately" },
  { symbol: "°", name: "degree" },
  { symbol: "µg", name: "microgram" },
  { symbol: "µL", name: "microliter" },
  { symbol: "→", name: "right arrow" },
  { symbol: "←", name: "left arrow" },
  { symbol: "↑", name: "increase" },
  { symbol: "↓", name: "decrease" },
];

export function AbstractSectionEditor({
  value,
  onChange,
  placeholder = "Enter section content…",
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [symbolOpen, setSymbolOpen] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[140px] px-3 py-2 focus:outline-none text-foreground leading-relaxed",
        placeholder,
      },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/html") || "";
        if (text) {
          const check = validateAbstractHtml(text);
          if (!check.valid) {
            toast.error(
              `Tables and images are blocked in the abstract body (${check.forbiddenTags.join(", ")}). Cleaned text will be used.`,
            );
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[180px] animate-pulse rounded-lg border border-input bg-muted/40",
          className,
        )}
      />
    );
  }

  const wordCount = countWordsInHtml(value);

  function insertSymbol(sym: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(sym).run();
    setSymbolOpen(false);
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-input bg-white transition-colors focus-within:border-primary/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-pressed={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic className="size-3.5" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-pressed={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-pressed={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className="size-3.5" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Greek & Medical Symbol Picker */}
          <Popover open={symbolOpen} onOpenChange={setSymbolOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground"
                title="Insert Greek/Medical symbol"
              >
                <Sigma className="size-3.5" />
                <span>Symbols</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Greek & Medical Symbols
              </p>
              <div className="grid grid-cols-6 gap-1">
                {GREEK_AND_MATH_SYMBOLS.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => insertSymbol(s.symbol)}
                    className="flex size-8 items-center justify-center rounded border border-border text-sm hover:bg-muted font-medium transition-colors"
                    title={s.name}
                  >
                    {s.symbol}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="mx-1 h-4 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo2 className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo2 className="size-3.5" />
          </Button>
        </div>

        <div className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded bg-muted/60">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

