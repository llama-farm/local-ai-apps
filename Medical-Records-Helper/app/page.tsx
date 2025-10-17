"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dropzone } from "@/components/Dropzone";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { HealthStatus } from "@/components/HealthStatus";
import { Bot, Database, FileText, X } from "lucide-react";
import { parsePdfToText } from "@/lib/pdf";
import { chunkTextSmart } from "@/lib/chunk";
import { extractTopExcerpts } from "@/lib/rank";
import { streamChat } from "@/lib/lf";
import { Message, Citation, ParsedPDF } from "@/lib/types";
import { uid } from "@/lib/utils";

const LF_DATABASE = process.env.NEXT_PUBLIC_LF_DATABASE || "medical_db";

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [parsedPDFs, setParsedPDFs] = useState<ParsedPDF[]>([]);
  const [useLocalDocs, setUseLocalDocs] = useState(true);
  const [ragTopK, setRagTopK] = useState(6);

  const handleFileDrop = useCallback(async (files: File[]) => {
    setPending(true);

    const newPDFs: ParsedPDF[] = [];

    for (const file of files) {
      try {
        const { text, pages } = await parsePdfToText(file);
        const chunks = chunkTextSmart(text);

        newPDFs.push({
          id: uid(),
          name: file.name,
          pages,
          textLength: text.length,
          chunks,
        });
      } catch (error: any) {
        console.error(`PDF parsing error for ${file.name}:`, error);
        alert(`Failed to parse ${file.name}: ${error.message}`);
      }
    }

    setParsedPDFs((prev) => [...prev, ...newPDFs]);
    setPending(false);
  }, []);

  const handleRemovePDF = useCallback((id: string) => {
    setParsedPDFs((prev) => prev.filter((pdf) => pdf.id !== id));
  }, []);

  const mergeCitations = (
    existing: Citation[] | undefined,
    incoming: any[]
  ): Citation[] => {
    const citationMap: Record<string, Citation> = {};

    for (const c of existing || []) {
      citationMap[c.id] = c;
    }

    for (const c of incoming || []) {
      const id = c.id || uid();
      citationMap[id] = {
        id,
        title: c.title || c.metadata?.title || c.filename || c.doc_title,
        source: c.source || c.metadata?.source || c.path || c.uri,
        page: c.page || c.metadata?.page,
        score: c.score,
        snippet: c.snippet || c.text,
      };
    }

    return Object.values(citationMap).slice(0, 12);
  };

  const handleSend = useCallback(
    async (prompt: string) => {
      const userMessage: Message = {
        id: uid(),
        role: "user",
        content: prompt,
      };

      setMessages((prev) => [...prev, userMessage]);
      setPending(true);

      try {
        // Collect all chunks from all PDFs
        const allChunks = parsedPDFs.flatMap((pdf) => pdf.chunks);

        const excerpts =
          useLocalDocs && allChunks.length
            ? extractTopExcerpts(prompt, allChunks, 6)
            : [];

        const assistantId = uid();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        let accumulated = "";

        for await (const event of streamChat({
          prompt,
          excerpts,
          topK: ragTopK,
          ragEnabled: true,
          scoreThreshold: 0.7,
        })) {
          if (event.done) break;

          if (event.token) {
            accumulated += event.token;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              )
            );
          }

          if (event.citations?.length) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, citations: mergeCitations(m.citations, event.citations) }
                  : m
              )
            );
          }
        }
      } catch (error: any) {
        console.error("Chat error:", error);
        const errorMessage: Message = {
          id: uid(),
          role: "assistant",
          content: `⚠️ Error: ${error.message || "Unknown error occurred"}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setPending(false);
      }
    },
    [useLocalDocs, parsedPDFs, ragTopK]
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="flex items-center gap-3 mb-4 flex-wrap">
        <Bot className="w-7 h-7" />
        <h1 className="text-2xl font-semibold">Health Copilot</h1>
        <Badge className="ml-2" variant="secondary">
          Local-first
        </Badge>
        <HealthStatus />
        <div className="ml-auto flex items-center gap-2 text-sm opacity-80">
          <Database className="w-4 h-4" />
          <span>RAG DB:</span>
          <code className="px-2 py-0.5 bg-muted rounded">{LF_DATABASE}</code>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Upload Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Dropzone onFileDrop={handleFileDrop} disabled={pending} />

              {parsedPDFs.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {parsedPDFs.length} PDF{parsedPDFs.length !== 1 ? "s" : ""} loaded
                    </div>
                    <Badge
                      variant={useLocalDocs ? "default" : "secondary"}
                      className="cursor-pointer text-xs"
                      onClick={() => setUseLocalDocs((v) => !v)}
                    >
                      {useLocalDocs ? "Using local docs" : "Not using local docs"}
                    </Badge>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {parsedPDFs.map((pdf) => (
                      <div
                        key={pdf.id}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                      >
                        <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{pdf.name}</div>
                          <div className="text-xs opacity-70">
                            {pdf.pages} pages · {(pdf.textLength / 1000).toFixed(1)}k chars · {pdf.chunks.length} chunks
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePDF(pdf.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs opacity-70 pt-2 border-t">
                    Your PDFs are parsed locally and never uploaded.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <SettingsDrawer ragTopK={ragTopK} onRagTopKChange={setRagTopK} />
        </div>

        <div className="lg:col-span-9">
          <Card className="rounded-2xl h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2 min-h-0">
              <MessageList messages={messages} />
              <div className="flex-shrink-0">
                <Composer onSend={handleSend} disabled={pending} />
                <div className="text-xs opacity-60 text-center mt-2">
                  Not medical advice. For education only. Verify with your clinician.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
