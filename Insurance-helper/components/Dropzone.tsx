"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UploadCloud } from "lucide-react";

interface DropzoneProps {
  onFileDrop: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFileDrop, disabled }: DropzoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (files.length > 0) onFileDrop(files);
    },
    [onFileDrop, disabled]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) onFileDrop(files);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/40 transition ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <UploadCloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm opacity-90 mb-1">Drag & drop bills or EOBs</p>
      <p className="text-xs opacity-70 mb-3">Medical bills, EOBs, claim letters - Parsed locally, never uploaded</p>
      <Separator className="my-3" />
      <Input
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileInput}
        disabled={disabled}
      />
    </div>
  );
}
