import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { agentApi, modelsApi, type AgentResponse } from '@/lib/api';
import { useModelState } from '@/contexts/ModelStateContext';
import { Bot, Phone, Bell, Eye, RefreshCw, Wrench, AlertTriangle, CheckCircle, Loader2, Zap, Download } from 'lucide-react';

type ScenarioType = 'routine' | 'concern' | 'emergency';

const scenarios: Record<ScenarioType, { title: string; description: string; color: string }> = {
  routine: {
    title: 'Routine Day',
    description: 'Margaret is having a normal afternoon in the living room',
    color: 'bg-green-100 border-green-300',
  },
  concern: {
    title: 'Some Concerns',
    description: 'Margaret mentioned dizziness, vitals borderline, unusually still',
    color: 'bg-amber-100 border-amber-300',
  },
  emergency: {
    title: 'Emergency',
    description: 'Margaret called for help, vitals severely abnormal, no movement',
    color: 'bg-red-100 border-red-300',
  },
};

export function AgentTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(null);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use shared model state context for persistence across tabs
  const {
    biometricTrained,
    classifierTrained,
    setBiometricTrained,
    setClassifierTrained,
    refreshAllStatuses,
  } = useModelState();

  // Derived state for all models ready
  const allModelsReady = biometricTrained && classifierTrained;

  // Training/loading state
  const [isTraining, setIsTraining] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const handleTrainAll = async () => {
    setIsTraining(true);
    setError(null);
    try {
      await modelsApi.trainAll();
      // Update shared state
      setBiometricTrained(true);
      setClassifierTrained(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    setError(null);
    try {
      const result = await modelsApi.loadAll();
      // Update shared state based on what loaded
      setBiometricTrained(result.biometric);
      setClassifierTrained(result.classifier);
      // Also refresh to make sure we have accurate state
      await refreshAllStatuses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading models failed');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleScenario = async (scenario: ScenarioType) => {
    setIsLoading(true);
    setError(null);
    setSelectedScenario(scenario);

    try {
      // Reset agent state first
      await agentApi.reset();

      let result: AgentResponse;
      switch (scenario) {
        case 'routine':
          result = await agentApi.analyzeRoutine();
          break;
        case 'concern':
          result = await agentApi.analyzeConcern();
          break;
        case 'emergency':
          result = await agentApi.analyzeEmergency();
          break;
      }
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    await agentApi.reset();
    setResponse(null);
    setSelectedScenario(null);
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'call_emergency_contact': return <Phone className="h-4 w-4" />;
      case 'send_alert': return <Bell className="h-4 w-4" />;
      case 'adjust_monitoring': return <Eye className="h-4 w-4" />;
      case 'log_observation': return <RefreshCw className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'escalate': return <Badge variant="danger">ESCALATE</Badge>;
      case 'alert': return <Badge variant="warning">ALERT</Badge>;
      case 'monitor_closely': return <Badge variant="warning">MONITOR</Badge>;
      case 'observe': return <Badge variant="info">OBSERVE</Badge>;
      default: return <Badge variant="success">CONTINUE</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">LLM Agent with Tools</h2>
        <p className="text-slate-600 mt-2">
          The LLM coordinates decisions, calling specialized tools to take action.
        </p>
      </div>

      {/* Model Status */}
      {!allModelsReady && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Models Required
            </CardTitle>
            <CardDescription className="text-amber-600">
              Train or load the ML models to use real anomaly detection and classification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Biometric Anomaly:</span>
                <Badge variant={biometricTrained ? 'success' : 'warning'}>
                  {biometricTrained ? 'Ready' : 'Not Trained'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Voice Classifier:</span>
                <Badge variant={classifierTrained ? 'success' : 'warning'}>
                  {classifierTrained ? 'Ready' : 'Not Trained'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleTrainAll}
                disabled={isTraining || isLoadingModels}
                variant="default"
              >
                {isTraining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Training...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Train All Models
                  </>
                )}
              </Button>
              <Button
                onClick={handleLoadModels}
                disabled={isTraining || isLoadingModels}
                variant="outline"
              >
                {isLoadingModels ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Load Saved
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Models Ready Indicator */}
      {allModelsReady && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">All models ready!</span>
              <span className="text-green-600 text-sm ml-2">
                Using real ML models for anomaly detection and classification
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Select Scenario
          </CardTitle>
          <CardDescription>
            Choose a scenario to see how the agent responds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {(Object.keys(scenarios) as ScenarioType[]).map((key) => (
              <button
                key={key}
                onClick={() => handleScenario(key)}
                disabled={isLoading || !allModelsReady}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedScenario === key
                    ? scenarios[key].color + ' border-opacity-100'
                    : !allModelsReady
                    ? 'border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <h4 className="font-semibold">{scenarios[key].title}</h4>
                <p className="text-sm text-slate-600 mt-1">
                  {scenarios[key].description}
                </p>
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-blue-700 font-medium">Agent analyzing situation...</p>
                <p className="text-blue-600 text-sm mt-2">
                  Running anomaly detection, classification, and LLM reasoning
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center mt-2">
                <Badge variant="info" className="animate-pulse">Biometric Analysis</Badge>
                <Badge variant="info" className="animate-pulse">Voice Classification</Badge>
                <Badge variant="info" className="animate-pulse">LLM Decision</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {response && !isLoading && (
        <div className="space-y-4">
          {/* Decision */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Agent Decision</span>
                {getDecisionBadge(response.decision)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-slate-700">{response.reasoning}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tool Calls */}
          {response.tool_calls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Tool Executions ({response.tool_calls.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {response.tool_calls.map((tc, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {getToolIcon(tc.tool_name)}
                        <span className="font-mono font-medium">{tc.tool_name}</span>
                      </div>

                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-slate-500">Arguments:</span>
                          <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                            {JSON.stringify(tc.arguments, null, 2)}
                          </pre>
                        </div>

                        {tc.result && (
                          <div>
                            <span className="text-slate-500">Result:</span>
                            <p className="mt-1 text-green-700 font-medium">{tc.result}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Info note */}
      <div className="text-center text-sm text-slate-500 mt-4">
        LLM reasoning: ~1-2 seconds | Coordinates fast ML models with intelligent decision-making
      </div>
    </div>
  );
}
