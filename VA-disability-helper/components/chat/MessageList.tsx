"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const visibleMessages = messages.filter((m) => m.role !== "system");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or content updates
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [visibleMessages, visibleMessages[visibleMessages.length - 1]?.content]);

  return (
    <ScrollArea className="flex-1 pr-2">
      <div className="space-y-4 pb-4" ref={scrollRef}>
        {visibleMessages.map((message, idx) => (
          <div
            key={message.id}
            ref={idx === visibleMessages.length - 1 ? lastMessageRef : undefined}
          >
            <MessageBubble message={message} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
