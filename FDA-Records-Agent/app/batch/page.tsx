"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Play, CheckCircle, CheckCircle2, XCircle, Clock, Database, AlertTriangle } from "lucide-react";

interface BatchResult {
  file: string;
  timestamp: string;
  summary: {
    total_documents: number;
    total_questions: number;
    total_answered: number;
    total_unanswered: number;
  };
}

interface BatchResponse {
  success: boolean;
  result_file: string;
  documents_processed: number;
  batch_info?: {
    start_index: number;
    end_index: number;
    batch_size: number;
    total_documents: number;
    remaining: number;
    has_more: boolean;
    next_start_index: number | null;
  };
  summary: {
    total_documents: number;
    total_questions: number;
    total_answered: number;
    total_unanswered: number;
  };
  error?: string;
  instructions?: string[];
}

export default function BatchProcessingPage() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [latestResult, setLatestResult] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [batchSize, setBatchSize] = useState(20);
  const [startIndex, setStartIndex] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [currentDocument, setCurrentDocument] = useState(0);
  const [totalInBatch, setTotalInBatch] = useState(0);

  // Load saved results on mount
  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const response = await fetch("/api/fda-batch");
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setTotalDocuments(data.total_documents || 0);
      }
    } catch (err) {
      console.error("Failed to load results:", err);
    }
  };

  const startBatchProcessing = async () => {
    setProcessing(true);
    setError(null);
    setLatestResult(null);
    setProcessingStatus("Initializing batch processing...");
    setCurrentDocument(0);

    // Calculate total documents in this batch
    const batchEnd = Math.min(startIndex + batchSize, totalDocuments);
    const docsInBatch = batchEnd - startIndex;
    setTotalInBatch(docsInBatch);

    try {
      setProcessingStatus(`Processing ${docsInBatch} documents...`);

      const response = await fetch(`/api/fda-batch?batchSize=${batchSize}&startIndex=${startIndex}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "Batch processing failed");
        setLatestResult(data);
        setProcessingStatus("Processing failed");
      } else {
        setLatestResult(data);
        setProcessingStatus(`✓ Completed ${data.documents_processed || 0} documents`);

        // Update startIndex to next batch if there's more
        if (data.batch_info?.next_start_index !== null) {
          setStartIndex(data.batch_info.next_start_index);
        }
        await loadResults(); // Reload results list
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setProcessingStatus("Error occurred");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-7 h-7" />
          <h1 className="text-2xl font-semibold">FDA Batch Processing</h1>
          <Badge variant="secondary">Question Extraction & Answer Validation</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a href="/" className="hover:text-primary">← Back to Home</a>
        </div>
      </header>

      {/* Instructions Card */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-2 font-semibold">Upload ALL documents to BOTH datasets (questions and answers are mixed in your correspondence):</p>
          <div className="space-y-2 text-sm font-mono bg-white p-4 rounded border">
            <div className="text-muted-foreground"># Step 1: Upload ALL files to BOTH datasets</div>
            <div className="text-blue-600">lf datasets upload fda_letters /path/to/all-files/**/*.pdf</div>
            <div className="text-blue-600">lf datasets upload fda_letters /path/to/all-files/**/*.txt</div>
            <div className="text-green-600">lf datasets upload fda_corpus /path/to/all-files/**/*.pdf</div>
            <div className="text-green-600">lf datasets upload fda_corpus /path/to/all-files/**/*.txt</div>
            <div className="mt-3 text-muted-foreground"># Step 2: Process both datasets</div>
            <div className="text-blue-600">lf datasets process fda_letters</div>
            <div className="text-green-600">lf datasets process fda_corpus</div>
            <div className="mt-3 text-muted-foreground"># Step 3: Verify data</div>
            <div className="text-blue-600">lf datasets list</div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 <strong>Why upload to both?</strong> The system extracts FDA questions from large chunks (fda_letters)
            and searches for answers in small chunks (fda_corpus). Same files, different processing strategies.
          </p>
        </CardContent>
      </Card>

      {/* Batch Processing Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Start Batch Processing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Process documents in batches. For 500+ documents, process in smaller groups (10-20 at a time) and pause/resume as needed.
          </p>

          {/* Batch Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Batch Size</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                disabled={processing}
              >
                <option value={10}>10 documents</option>
                <option value={20}>20 documents (recommended)</option>
                <option value={50}>50 documents</option>
                <option value={100}>100 documents</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Start Index</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md"
                value={startIndex}
                onChange={(e) => setStartIndex(parseInt(e.target.value) || 0)}
                min={0}
                max={Math.max(0, totalDocuments - 1)}
                disabled={processing}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Progress</label>
              <div className="px-3 py-2 bg-muted rounded-md">
                <div className="text-sm font-mono">
                  {startIndex} / {totalDocuments}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {totalDocuments > 0 ? Math.round((startIndex / totalDocuments) * 100) : 0}% complete
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={startBatchProcessing}
              disabled={processing || startIndex >= totalDocuments}
              className="flex-1 sm:flex-none"
            >
              {processing ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {startIndex === 0 ? "Start" : "Continue"} Batch
                </>
              )}
            </Button>

            {startIndex > 0 && (
              <Button
                onClick={() => setStartIndex(0)}
                disabled={processing}
                variant="outline"
              >
                Reset to Start
              </Button>
            )}
          </div>

          {/* Processing Status */}
          {processing && processingStatus && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <div className="font-medium text-blue-900">{processingStatus}</div>
                  <div className="text-sm text-blue-700 mt-1">
                    Check the terminal for detailed progress logs
                  </div>
                </div>
              </div>
            </div>
          )}

          {latestResult?.batch_info && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="font-medium text-green-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Batch Complete!
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <div>
                  📄 Processed documents {latestResult.batch_info.start_index + 1} - {latestResult.batch_info.end_index} of {latestResult.batch_info.total_documents}
                </div>
                {latestResult.summary && (
                  <div className="mt-2 space-y-1">
                    <div>❓ Total Questions: <strong>{latestResult.summary.total_questions || 0}</strong></div>
                    <div>✅ Answered: <strong>{latestResult.summary.answered_questions || 0}</strong></div>
                    <div>❌ Unanswered: <strong>{latestResult.summary.unanswered_questions || 0}</strong></div>
                  </div>
                )}
                {latestResult.batch_info.has_more && (
                  <div className="mt-2 font-medium text-green-800">
                    ⏭️ {latestResult.batch_info.remaining} documents remaining - Click "Continue Batch" to process more
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && latestResult && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 mb-3">{error}</p>
            {latestResult.instructions && latestResult.instructions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Follow these steps:</p>
                <ul className="text-sm space-y-1 list-decimal list-inside">
                  {latestResult.instructions.map((instruction, idx) => (
                    <li key={idx}>{instruction}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Latest Result Display */}
      {latestResult && latestResult.success && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Batch Processing Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Documents</div>
                <div className="text-2xl font-bold">{latestResult.summary.total_documents}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Questions</div>
                <div className="text-2xl font-bold">{latestResult.summary.total_questions}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Answered</div>
                <div className="text-2xl font-bold text-green-600">{latestResult.summary.total_answered}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Unanswered</div>
                <div className="text-2xl font-bold text-orange-600">{latestResult.summary.total_unanswered}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              Results saved to: <code className="bg-white px-2 py-1 rounded">{latestResult.result_file}</code>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Previous Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No results yet. Run batch processing to see results here.
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, idx) => {
                const answerRate = result.summary.total_questions > 0
                  ? Math.round((result.summary.total_answered / result.summary.total_questions) * 100)
                  : 0;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {new Date(result.timestamp).toLocaleString()}
                        </span>
                        <Badge variant={answerRate >= 80 ? "default" : answerRate >= 50 ? "secondary" : "destructive"}>
                          {answerRate}% answered
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-x-4">
                        <span>{result.summary.total_documents} docs</span>
                        <span>{result.summary.total_questions} questions</span>
                        <span className="text-green-600">{result.summary.total_answered} answered</span>
                        <span className="text-orange-600">{result.summary.total_unanswered} unanswered</span>
                      </div>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Open result file in new window or download
                          window.open(`/api/fda-batch/file?path=${encodeURIComponent(result.file)}`, "_blank");
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
