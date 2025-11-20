"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizonal, RotateCcw } from "lucide-react";

interface ComposerProps {
  onSend: (message: string) => void;
  onClearChat?: () => void;
  disabled?: boolean;
}

export function Composer({ onSend, onClearChat, disabled }: ComposerProps) {
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
          placeholder="Ask about your policy coverage, medical bills, EOBs, or claim denials…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="resize-none h-20"
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          <Button onClick={handleSend} disabled={disabled || !input.trim()} className="h-10">
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SendHorizonal className="w-4 h-4" />
            )}
          </Button>
          {onClearChat && (
            <Button
              onClick={onClearChat}
              disabled={disabled}
              variant="outline"
              className="h-10"
              title="Clear chat and start new session"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="text-xs opacity-70">Press ⌘/Ctrl + Enter to send</div>
    </div>
  );
}
