"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizonal } from "lucide-react";

interface ComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: ComposerProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Textarea
          placeholder="Ask about your labs, scans, visit notes…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="resize-none h-20"
          disabled={disabled}
        />
        <Button onClick={handleSend} disabled={disabled || !input.trim()} className="h-10 self-center">
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <SendHorizonal className="w-4 h-4" />
          )}
        </Button>
      </div>
      <div className="text-xs opacity-70">Press ⌘/Ctrl + Enter to send</div>
    </div>
  );
}
