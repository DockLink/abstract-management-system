"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from "lucide-react";

export function GuidelinesEditor({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "rich-text max-w-none min-h-[220px] px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
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
          "min-h-[240px] animate-pulse rounded-lg border border-input bg-muted/40",
          className,
        )}
      />
    );
  }

  const tools = [
    { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Bulleted list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className,
      )}
    >
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 border-b border-border bg-muted/50 p-1.5">
        {tools.map(({ label, icon: Icon, active, run }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={run}
            aria-label={label}
            aria-pressed={active}
            className={cn(active && "bg-primary-tint text-brand-ink")}
          >
            <Icon />
          </Button>
        ))}
        <span aria-hidden className="mx-1 my-1.5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
