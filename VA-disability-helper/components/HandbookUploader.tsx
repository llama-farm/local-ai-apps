"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Upload, Loader2, CheckCircle2, XCircle, BookOpen, UploadCloud, X } from "lucide-react";

interface HandbookUploaderProps {
  onSummaryReady?: (summary: string) => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "summarizing" | "ready" | "error";

export function HandbookUploader({ onSummaryReady }: HandbookUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [filenames, setFilenames] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Load existing summary from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("handbook_summary");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setSummary(data.summary);
        setFilenames(data.filenames || (data.filename ? [data.filename] : []));
        setStatus("ready");
      } catch (e) {
        console.error("Failed to parse stored summary", e);
      }
    }
  }, []);

  // Poll for processing status
  useEffect(() => {
    if (status === "processing" && taskId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/handbook/status?taskId=${taskId}`);
          const data = await response.json();

          console.log("Task status:", data);

          if (data.status === "completed") {
            clearInterval(interval);
            setStatus("summarizing");
            generateSummary();
          } else if (data.status === "failed") {
            clearInterval(interval);
            setStatus("error");
            setError(data.error || "Processing failed");
          }
        } catch (err: any) {
          console.error("Status check error:", err);
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [status, taskId]);

  const generateSummary = async () => {
    try {
      console.log("Generating summary...");
      const response = await fetch("/api/handbook/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topK: 15 }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      setSummary(data.summary);
      setStatus("ready");

      // Store summary in localStorage
      localStorage.setItem("handbook_summary", JSON.stringify({
        summary: data.summary,
        filenames,
        timestamp: data.timestamp,
      }));

      onSummaryReady?.(data.summary);
    } catch (err: any) {
      console.error("Summary generation error:", err);
      setStatus("error");
      setError(err.message || "Failed to generate summary");
    }
  };

  const handleFilesSelect = useCallback((files: File[]) => {
    const pdfFiles = files.filter(f => f.type === "application/pdf");
    if (pdfFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...pdfFiles]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFilesSelect(files);
    e.target.value = ""; // Reset input
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "uploading" || status === "processing" || status === "summarizing") return;

    const files = Array.from(e.dataTransfer.files);
    handleFilesSelect(files);
  }, [handleFilesSelect, status]);

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setStatus("uploading");
    setError("");

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch("/api/handbook/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      setFilenames(data.filenames);

      // Check if processing completed immediately (synchronously)
      if (data.isComplete) {
        console.log("Processing completed immediately");
        setStatus("summarizing");
        generateSummary();
      } else {
        // Processing is async, need to poll for status
        setTaskId(data.taskId);
        setStatus("processing");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setStatus("error");
      setError(err.message || "Failed to upload handbook");
    }
  };

  const handleClear = () => {
    setStatus("idle");
    setSelectedFiles([]);
    setFilenames([]);
    setTaskId("");
    setSummary("");
    setError("");
    localStorage.removeItem("handbook_summary");
  };

  const renderStatusIcon = () => {
    switch (status) {
      case "uploading":
      case "processing":
      case "summarizing":
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case "ready":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <BookOpen className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const renderStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploading handbook...";
      case "processing":
        return "Processing and creating embeddings...";
      case "summarizing":
        return "Generating coverage summary...";
      case "ready":
        return "Ready";
      case "error":
        return "Error";
      default:
        return "No handbook uploaded";
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5" />
          Medical Member Handbook
        </CardTitle>
        <CardDescription>
          Upload your insurance handbook for personalized coverage information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {renderStatusIcon()}
          <span className="font-medium">{renderStatusText()}</span>
        </div>

        {status === "idle" || status === "error" ? (
          <>
            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/40 transition ${
                status === "uploading" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <UploadCloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm opacity-90 mb-1">Drag & drop handbooks here</p>
              <p className="text-xs opacity-70 mb-3">
                Medical member handbooks, benefit guides - Processed server-side, stored persistently
              </p>
              <Separator className="my-3" />
              <Input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileInput}
                disabled={status === "uploading"}
              />
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedFiles.length} file(s) selected:</p>
                <div className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ({(file.size / 1024 / 1024).toFixed(1)}MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                        disabled={status === "uploading"}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || status === "uploading"}
              className="w-full"
            >
              {status === "uploading" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading {selectedFiles.length} file(s)...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ""}Handbook
                  {selectedFiles.length > 1 ? "s" : ""}
                </>
              )}
            </Button>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </>
        ) : status === "processing" ? (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Processing your handbook...
              </span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              This may take 2-5 minutes. Creating embeddings for semantic search...
            </p>
          </div>
        ) : status === "summarizing" ? (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Generating coverage summary...
              </span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Analyzing your plan details...
            </p>
          </div>
        ) : status === "ready" && summary ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium">
                    {filenames.length} handbook{filenames.length > 1 ? "s" : ""} uploaded
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Clear
                </Button>
              </div>
              {filenames.length > 0 && (
                <div className="text-xs text-muted-foreground pl-6">
                  {filenames.join(", ")}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Coverage Summary</h4>
              <ScrollArea className="h-[300px] rounded-lg border p-3">
                <div className="text-sm whitespace-pre-wrap">{summary}</div>
              </ScrollArea>
            </div>

            <div className="text-xs text-muted-foreground">
              This summary is automatically used when you ask coverage questions
            </div>
          </>
        ) : null}

        <Separator />

        <div className="text-xs opacity-70">
          <p className="mb-1">
            <strong>What is this?</strong> Your Medical Member Handbook contains both generic
            and customized information about your insurance plan.
          </p>
          <p>
            Once uploaded, it will be processed and made searchable for quick answers about
            your specific coverage.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
