import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { classifierApi, type ClassificationResult } from '@/lib/api';
import { MessageSquare, Brain, Zap, Database, Upload, RefreshCw } from 'lucide-react';
import { useModelState } from '@/contexts/ModelStateContext';

const examplePhrases = [
  { text: "Good morning, time for my show", expected: "routine" },
  { text: "I'm feeling a bit dizzy", expected: "concern" },
  { text: "Help! I've fallen!", expected: "emergency" },
  { text: "I'm feeling wonderful today", expected: "positive" },
];

interface TrainingDataSample {
  text: string;
  label: string;
}

export function ClassifierTab() {
  const { classifierTrained: isTrained, setClassifierTrained: setIsTrained } = useModelState();
  const [isTraining, setIsTraining] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [inputText, setInputText] = useState("I'm feeling a bit dizzy");
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trainingInfo, setTrainingInfo] = useState<{ labels: string[]; samples: number } | null>(null);

  // Training data modal state
  const [showTrainingData, setShowTrainingData] = useState(false);
  const [trainingData, setTrainingData] = useState<TrainingDataSample[]>([]);
  const [trainingDataTotal, setTrainingDataTotal] = useState(0);
  const [labelCounts, setLabelCounts] = useState<Record<string, number>>({});
  const [isLoadingTrainingData, setIsLoadingTrainingData] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(undefined);

  // Load state
  const [isLoading, setIsLoading] = useState(false);

  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    try {
      const response = await classifierApi.train();
      // Auto-save after training
      await classifierApi.save();
      setIsTrained(true);
      setTrainingInfo({ labels: response.labels, samples: response.samples_fitted });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  const handleLoad = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await classifierApi.load();
      setIsTrained(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed - model may not exist yet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassify = async () => {
    if (!inputText.trim()) return;
    setIsClassifying(true);
    setError(null);
    try {
      const classResult = await classifierApi.classify(inputText);
      setResult(classResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setIsClassifying(false);
    }
  };

  const handleShowTrainingData = async (label?: string) => {
    setIsLoadingTrainingData(true);
    try {
      const data = await classifierApi.getTrainingData(25, label);
      setTrainingData(data.samples);
      setTrainingDataTotal(data.total_samples);
      setLabelCounts(data.label_counts);
      setSelectedLabel(label);
      setShowTrainingData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training data');
    } finally {
      setIsLoadingTrainingData(false);
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'routine': return 'info';
      case 'concern': return 'warning';
      case 'emergency': return 'danger';
      case 'positive': return 'success';
      default: return 'secondary';
    }
  };

  const getLabelBgColor = (label: string) => {
    switch (label) {
      case 'routine': return 'bg-blue-100 text-blue-800';
      case 'concern': return 'bg-amber-100 text-amber-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'positive': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Text Classification</h2>
        <p className="text-slate-600 mt-2">
          SetFit classifier for voice transcript urgency. Train once, classify instantly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Training Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Model Training
            </CardTitle>
            <CardDescription>
              Train on 100 labeled voice transcripts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={isTrained ? 'success' : 'secondary'}>
                {isTrained ? 'Trained' : 'Not Trained'}
              </Badge>
              {isTrained && <span className="text-sm text-slate-500">SetFit</span>}
            </div>

            {trainingInfo && (
              <div className="text-sm text-slate-600 space-y-1">
                <p>Samples: {trainingInfo.samples}</p>
                <p>Labels: {trainingInfo.labels.join(', ')}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleTrain}
                disabled={isTraining}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isTraining ? 'animate-spin' : ''}`} />
                {isTraining ? 'Training... (30-60s)' : isTrained ? 'Retrain' : 'Train Classifier'}
              </Button>
              <Button
                variant="outline"
                onClick={handleLoad}
                disabled={isLoading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-1" />
                {isLoading ? '...' : 'Load Saved'}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleShowTrainingData()}
              disabled={isLoadingTrainingData}
              className="w-full text-slate-500"
            >
              <Database className="h-4 w-4 mr-2" />
              {isLoadingTrainingData ? 'Loading...' : 'View Training Data'}
            </Button>
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Voice Transcript
            </CardTitle>
            <CardDescription>
              Enter text or click an example
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-24 p-3 border border-slate-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a voice transcript..."
            />

            <div className="flex flex-wrap gap-2">
              {examplePhrases.map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => { setInputText(phrase.text); setResult(null); }}
                  className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  {phrase.expected}
                </button>
              ))}
            </div>

            <Button
              onClick={handleClassify}
              disabled={!isTrained || isClassifying || !inputText.trim()}
              className="w-full"
              variant={isTrained ? 'default' : 'secondary'}
            >
              <Zap className="h-4 w-4 mr-2" />
              {isClassifying ? 'Classifying...' : 'Classify'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Classification Result
              <Badge variant={getLabelColor(result.label)} className="text-base px-3 py-1">
                {result.label.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Main result */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-lg italic">"{result.text}"</p>
                <p className="text-sm text-slate-500 mt-2">
                  Confidence: {(result.score * 100).toFixed(1)}%
                </p>
              </div>

              {/* Score breakdown */}
              <div>
                <h4 className="font-medium mb-3">All Scores</h4>
                <div className="space-y-2">
                  {Object.entries(result.all_scores)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, score]) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-24 text-sm capitalize">{label}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              label === result.label ? 'bg-blue-500' : 'bg-slate-300'
                            }`}
                            style={{ width: `${score * 100}%` }}
                          />
                        </div>
                        <span className="w-16 text-sm text-right">
                          {(score * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speed comparison note */}
      <div className="text-center text-sm text-slate-500 mt-4">
        Classification speed: ~10ms | LLM equivalent: ~1-2 seconds
      </div>

      {/* Training Data Modal */}
      <Modal
        isOpen={showTrainingData}
        onClose={() => setShowTrainingData(false)}
        title={`Voice Transcript Training Data (${trainingDataTotal} samples)`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The classifier learns to recognize these categories from labeled examples.
            Click a label to filter the samples.
          </p>

          {/* Label counts */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleShowTrainingData(undefined)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                !selectedLabel ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All ({Object.values(labelCounts).reduce((a, b) => a + b, 0)})
            </button>
            {Object.entries(labelCounts).map(([label, count]) => (
              <button
                key={label}
                onClick={() => handleShowTrainingData(label)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedLabel === label
                    ? getLabelBgColor(label).replace('100', '600').replace('800', '100')
                    : getLabelBgColor(label) + ' hover:opacity-80'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Samples table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Text</th>
                  <th className="px-3 py-2 text-left">Label</th>
                </tr>
              </thead>
              <tbody>
                {trainingData.map((sample, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">{sample.text}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getLabelBgColor(sample.label)}`}>
                        {sample.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Showing {trainingData.length} of {trainingDataTotal} samples
            {selectedLabel && ` (filtered by "${selectedLabel}")`}
          </p>
        </div>
      </Modal>
    </div>
  );
}
