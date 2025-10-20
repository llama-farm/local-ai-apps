"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Database, Trash2, Play, FolderOpen, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface DatasetInfo {
  name: string;
  file_count: number;
  database: string;
}

interface DatabaseInfo {
  name: string;
  type: string;
}

export default function DatasetManagementPage() {
  const [directory, setDirectory] = useState("");
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(["fda_letters", "fda_corpus"]);
  const [uploadStatus, setUploadStatus] = useState<any>(null);
  const [processStatus, setProcessStatus] = useState<any>(null);
  const [clearStatus, setClearStatus] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  // Load dataset info on mount
  useEffect(() => {
    loadDatasetInfo();
  }, []);

  const handleBrowseFolder = async () => {
    setBrowsing(true);
    try {
      const response = await fetch("/api/browse-folder");
      const data = await response.json();

      if (data.path) {
        setDirectory(data.path);
      } else if (data.cancelled) {
        // User cancelled - do nothing
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err: any) {
      alert(`Failed to open folder picker: ${err.message}`);
    } finally {
      setBrowsing(false);
    }
  };

  const loadDatasetInfo = async () => {
    try {
      const response = await fetch("/api/datasets/clear");
      if (response.ok) {
        const data = await response.json();
        setDatasets(data.available_datasets || []);
        setDatabases(data.available_databases || []);
      }
    } catch (err) {
      console.error("Failed to load dataset info:", err);
    }
  };

  const handleUpload = async () => {
    if (!directory) {
      alert("Please enter a directory path");
      return;
    }

    setLoading("upload");
    setUploadStatus(null);

    try {
      const response = await fetch("/api/datasets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directory,
          datasets: selectedDatasets,
          recursive: true,
        }),
      });

      const data = await response.json();
      setUploadStatus(data);

      if (data.success) {
        await loadDatasetInfo();
      }
    } catch (err: any) {
      setUploadStatus({ error: err.message });
    } finally {
      setLoading(null);
    }
  };

  const handleProcess = async () => {
    setLoading("process");
    setProcessStatus(null);

    try {
      const response = await fetch("/api/datasets/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasets: selectedDatasets,
          async_processing: false,
        }),
      });

      const data = await response.json();
      setProcessStatus(data);

      if (data.success) {
        await loadDatasetInfo();
      }
    } catch (err: any) {
      setProcessStatus({ error: err.message });
    } finally {
      setLoading(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("⚠️ This will DELETE all datasets and databases. Are you absolutely sure?")) {
      return;
    }

    setLoading("clear");
    setClearStatus(null);

    try {
      const response = await fetch("/api/datasets/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clear_all: true,
        }),
      });

      const data = await response.json();
      setClearStatus(data);

      if (data.success) {
        await loadDatasetInfo();
      }
    } catch (err: any) {
      setClearStatus({ error: err.message });
    } finally {
      setLoading(null);
    }
  };

  const toggleDataset = (dataset: string) => {
    setSelectedDatasets(prev =>
      prev.includes(dataset)
        ? prev.filter(d => d !== dataset)
        : [...prev, dataset]
    );
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-7 h-7" />
          <h1 className="text-2xl font-semibold">Dataset Management</h1>
          <Badge variant="secondary">Upload & Process</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a href="/" className="hover:text-primary">← Back to Home</a>
        </div>
      </header>

      {/* Current Datasets Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Current Datasets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datasets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No datasets found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datasets.map(dataset => (
                <div key={dataset.name} className="p-4 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{dataset.name}</h3>
                    <Badge variant="outline">{dataset.file_count} files</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Database: {dataset.database}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Directory Path (will search recursively for .pdf and .txt files)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="/path/to/your/fda-files"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                disabled={loading !== null || browsing}
              />
              <Button
                variant="outline"
                onClick={handleBrowseFolder}
                disabled={loading !== null || browsing}
                className="min-w-[100px]"
              >
                {browsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Browsing...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Browse
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Browse" to select a folder, or type the path manually
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Upload to Datasets (select both for full functionality)
            </label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedDatasets.includes("fda_letters") ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDataset("fda_letters")}
                disabled={loading !== null}
              >
                fda_letters (questions)
              </Button>
              <Button
                variant={selectedDatasets.includes("fda_corpus") ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDataset("fda_corpus")}
                disabled={loading !== null}
              >
                fda_corpus (answers)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Both datasets use the same files but with different chunking strategies
            </p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={loading !== null || !directory || selectedDatasets.length === 0}
            className="w-full"
          >
            {loading === "upload" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </>
            )}
          </Button>

          {uploadStatus && (
            <div className={`p-3 rounded-md ${uploadStatus.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {uploadStatus.success ? (
                <div className="text-sm text-green-900">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    Upload Complete
                  </div>
                  <div className="space-y-1">
                    <div>Found {uploadStatus.total_files_found} supported files</div>
                    {uploadStatus.results?.map((result: any, idx: number) => (
                      <div key={idx}>
                        <strong>{result.dataset}:</strong> {result.uploaded} uploaded, {result.failed} failed
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-900">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Upload Error
                  </div>
                  <div>{uploadStatus.error}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Process Datasets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate embeddings and populate vector databases. This must be done after uploading files.
          </p>

          <Button
            onClick={handleProcess}
            disabled={loading !== null || selectedDatasets.length === 0}
            className="w-full"
          >
            {loading === "process" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Process Selected Datasets
              </>
            )}
          </Button>

          {processStatus && (
            <div className={`p-3 rounded-md ${processStatus.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {processStatus.success ? (
                <div className="text-sm text-green-900">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    Processing Complete
                  </div>
                  {processStatus.results?.map((result: any, idx: number) => (
                    <div key={idx}>
                      <strong>{result.dataset}:</strong> {result.message || "Success"}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-red-900">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Processing Error
                  </div>
                  <div>{processStatus.error}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone - Clear All */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-900">
            <strong>⚠️ Warning:</strong> This will permanently delete all datasets, embeddings, and databases.
            Use this if you need to start completely fresh or if something is corrupted.
          </p>

          <Button
            onClick={handleClearAll}
            disabled={loading !== null}
            variant="destructive"
            className="w-full"
          >
            {loading === "clear" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Data
              </>
            )}
          </Button>

          {clearStatus && (
            <div className={`p-3 rounded-md ${clearStatus.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              {clearStatus.success ? (
                <div className="text-sm text-green-900">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    Clear Complete
                  </div>
                  <div className="space-y-1">
                    {clearStatus.datasets_deleted?.length > 0 && (
                      <div>Deleted datasets: {clearStatus.datasets_deleted.join(", ")}</div>
                    )}
                    {clearStatus.databases_cleared?.length > 0 && (
                      <div>Cleared databases: {clearStatus.databases_cleared.join(", ")}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-900">
                  <div className="font-medium flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Clear Error
                  </div>
                  <div>{clearStatus.error}</div>
                  {clearStatus.errors?.length > 0 && (
                    <ul className="mt-2 list-disc list-inside">
                      {clearStatus.errors.map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
