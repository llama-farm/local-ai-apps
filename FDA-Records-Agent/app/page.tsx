"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthStatus } from "@/components/HealthStatus";
import { FileText, Database, Play, BookOpen, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

const LF_DATABASE_LETTERS = "fda_letters_full";
const LF_DATABASE_CORPUS = "fda_corpus_chunked";

export default function HomePage() {
  const [datasetsInfo, setDatasetsInfo] = useState<any>(null);

  useEffect(() => {
    // Fetch dataset info from LlamaFarm API
    const fetchDatasets = async () => {
      try {
        const response = await fetch("/api/fda-batch");
        if (response.ok) {
          const data = await response.json();
          // This will show us if we have results
        }
      } catch (err) {
        console.error("Failed to fetch datasets:", err);
      }
    };
    fetchDatasets();
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">FDA Document Processing</h1>
          <Badge variant="secondary" className="ml-2">
            Local-first
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Extract questions from FDA correspondence and validate answers in your response corpus
        </p>
      </header>

      {/* Health Status */}
      <div className="mb-6">
        <HealthStatus />
      </div>

      {/* Important Note */}
      <Card className="mb-6 border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg">
              !
            </div>
            <div>
              <h3 className="font-semibold mb-1 text-orange-900">Important: Upload ALL Files to BOTH Datasets</h3>
              <p className="text-sm text-orange-800 mb-2">
                Your FDA correspondence contains <strong>both questions and answers mixed together</strong>.
                FDA requests might be in meeting minutes, and answers in later emails or official responses.
              </p>
              <p className="text-sm text-orange-800">
                The system processes the same files twice: once with large chunks to extract FDA tasks,
                and once with small chunks to search for answers anywhere in your documents.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              FDA Letters Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Database:</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{LF_DATABASE_LETTERS}</code>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Purpose:</span>
                <span className="text-xs">Extract FDA tasks/questions</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chunk size:</span>
                <span className="text-xs">2000 chars (large context)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Files:</span>
                <span className="text-xs font-semibold">ALL your documents</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-green-600" />
              Response Corpus Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Database:</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{LF_DATABASE_CORPUS}</code>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Purpose:</span>
                <span className="text-xs">Find answers via RAG search</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chunk size:</span>
                <span className="text-xs">800 chars (fine-grained)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Files:</span>
                <span className="text-xs font-semibold">ALL your documents</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link href="/datasets">
          <Card className="hover:border-primary cursor-pointer transition-colors h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Dataset Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Upload files, process datasets, and manage databases - all from the UI
              </p>
              <div className="flex items-center text-sm text-primary font-medium">
                Manage Datasets <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/batch">
          <Card className="hover:border-primary cursor-pointer transition-colors h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600" />
                Batch Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Extract FDA questions and validate answers - process in batches
              </p>
              <div className="flex items-center text-sm text-primary font-medium">
                Start Processing <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Workflow Steps */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Recommended: UI Method */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Recommended: Use the UI</h3>
                <Badge variant="secondary" className="ml-auto">Easy</Badge>
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium">Go to Dataset Management</p>
                    <p className="text-xs text-muted-foreground">
                      Select your FDA files directory - it will recursively find all PDFs and TXT files
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium">Upload to both datasets</p>
                    <p className="text-xs text-muted-foreground">
                      Same files go to fda_letters (questions) and fda_corpus (answers)
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium">Click "Process Selected Datasets"</p>
                    <p className="text-xs text-muted-foreground">
                      Generates vector embeddings for semantic search
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold text-sm">
                    4
                  </div>
                  <div>
                    <p className="text-sm font-medium">Run Batch Processing</p>
                    <p className="text-xs text-muted-foreground">
                      Extract questions and validate answers in batches of 10-20 documents
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Link href="/datasets">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Database className="w-4 h-4 mr-2" />
                    Dataset Management
                  </Button>
                </Link>
                <Link href="/batch">
                  <Button size="sm" variant="outline">
                    <Play className="w-4 h-4 mr-2" />
                    Batch Processing
                  </Button>
                </Link>
              </div>
            </div>

            {/* Alternative: CLI Method */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
                <span>Alternative: Use the CLI</span>
                <Badge variant="outline" className="ml-2">Advanced</Badge>
              </summary>

              <div className="mt-4 space-y-3 pl-4 border-l-2 border-muted">
                <div>
                  <p className="text-sm font-medium mb-2">1. Upload documents to both datasets</p>
                  <div className="bg-muted p-2 rounded text-xs font-mono space-y-1">
                    <div className="text-blue-600">lf datasets upload fda_letters /path/to/files/**/*.pdf</div>
                    <div className="text-green-600">lf datasets upload fda_corpus /path/to/files/**/*.pdf</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">2. Process to generate embeddings</p>
                  <div className="bg-muted p-2 rounded text-xs font-mono space-y-1">
                    <div className="text-blue-600">lf datasets process fda_letters</div>
                    <div className="text-green-600">lf datasets process fda_corpus</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">3. Clear everything if needed</p>
                  <div className="bg-muted p-2 rounded text-xs font-mono space-y-1">
                    <div className="text-red-600">lf datasets remove fda_letters</div>
                    <div className="text-red-600">lf datasets remove fda_corpus</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Or use the "Clear All Data" button in Dataset Management for a complete reset
                  </p>
                </div>
              </div>
            </details>

            {/* Why Both Datasets? */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs text-amber-900">
                <strong>💡 Why upload to both datasets?</strong> The same files are processed differently:
                <strong className="block mt-1">• fda_letters:</strong> Large 2000-char chunks to extract full FDA tasks/requests
                <strong className="block">• fda_corpus:</strong> Small 800-char chunks for finding answers anywhere in your documents
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Question Extraction</h3>
                <p className="text-xs text-muted-foreground">
                  Identify FDA tasks and requests <strong>FROM the FDA</strong> (not questions you asked them)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Answer Validation</h3>
                <p className="text-xs text-muted-foreground">
                  Search response corpus and validate if questions have been answered
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Persistent Results</h3>
                <p className="text-xs text-muted-foreground">
                  Results saved to timestamped JSON files organized by date
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/batch" className="flex-1">
              <Button className="w-full" size="lg">
                <Play className="w-4 h-4 mr-2" />
                Start Batch Processing
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => window.open("FDA_BATCH_PROCESSING.md", "_blank")}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              View Documentation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>
          All processing happens locally. Your documents never leave your device.
        </p>
        <p className="mt-1">
          Using <code className="bg-muted px-1 py-0.5 rounded">gemma3:1b</code> for question extraction and answer validation
        </p>
      </div>
    </div>
  );
}
