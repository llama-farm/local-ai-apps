"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  const [autoExpandedThinking, setAutoExpandedThinking] = useState(false);

  // Parse content to separate thinking from main response
  const parseContent = (content: string) => {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const thoughts: string[] = [];
    let mainContent = content;
    let hasOpenThink = false;

    // First, extract all closed <think> blocks
    let match;
    const closedThinks: string[] = [];
    while ((match = thinkRegex.exec(content)) !== null) {
      closedThinks.push(match[1].trim());
    }

    // Check if there's an unclosed <think> tag (thinking in progress)
    const lastClosedIndex = content.lastIndexOf('</think>');
    const lastOpenIndex = content.lastIndexOf('<think>');

    if (lastOpenIndex > lastClosedIndex) {
      // There's an open <think> tag after the last closed one
      hasOpenThink = true;
      const openThinkContent = content.substring(lastOpenIndex + 7); // 7 = length of "<think>"
      closedThinks.push(openThinkContent.trim());
    }

    thoughts.push(...closedThinks);

    // Remove ALL <think>...</think> and unclosed <think>... from main content
    mainContent = content.replace(thinkRegex, ''); // Remove closed blocks
    if (hasOpenThink) {
      // Remove from last <think> onwards
      const openTagIndex = content.lastIndexOf('<think>');
      mainContent = content.substring(0, openTagIndex);
    }
    mainContent = mainContent.trim();

    return { thoughts, mainContent, hasOpenThink };
  };

  const { thoughts, mainContent, hasOpenThink } = parseContent(message.content || "");

  // Auto-expand the thinking section when streaming
  React.useEffect(() => {
    if (hasOpenThink && !autoExpandedThinking) {
      const lastThoughtIndex = thoughts.length - 1;
      setExpandedThoughts(prev => ({ ...prev, [lastThoughtIndex]: true }));
      setAutoExpandedThinking(true);
    }
  }, [hasOpenThink, thoughts.length, autoExpandedThinking]);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[95%] rounded-2xl px-4 py-3 shadow-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {/* Thinking sections */}
        {thoughts.length > 0 && (
          <div className="mb-3 space-y-2">
            {thoughts.map((thought, idx) => {
              const isExpanded = expandedThoughts[idx];
              const isLastThought = idx === thoughts.length - 1;
              const isThinking = isLastThought && hasOpenThink;

              return (
                <div
                  key={idx}
                  className="bg-background/50 rounded-lg border border-border/50"
                >
                  <button
                    onClick={() =>
                      setExpandedThoughts((prev) => ({
                        ...prev,
                        [idx]: !prev[idx],
                      }))
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-background/30 transition-colors rounded-lg"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 opacity-70 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 opacity-70 flex-shrink-0" />
                    )}
                    <div className="text-xs font-medium opacity-70 flex items-center gap-2">
                      {isThinking ? (
                        <>
                          <span className="inline-block animate-pulse">Processing...</span>
                          <span className="inline-block w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="inline-block w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="inline-block w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </>
                      ) : idx === 0 ? (
                        "Agent steps"
                      ) : (
                        "Analysis"
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 text-xs italic opacity-80 whitespace-pre-wrap">
                      {thought || "…"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Main content */}
        {mainContent && (
          <div className={cn(
            "prose prose-sm max-w-none break-words",
            isUser ? "prose-invert" : ""
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {mainContent}
            </ReactMarkdown>
          </div>
        )}

        {!mainContent && !thoughts.length && (
          <div className="text-sm opacity-60">…</div>
        )}

        {/* Citations hidden by default - data is in the response already */}
      </div>
    </div>
  );
}
