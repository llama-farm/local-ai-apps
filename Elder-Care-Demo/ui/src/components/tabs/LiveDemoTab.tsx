import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { streamingApi, modelsApi, type StreamEvent } from '@/lib/api';
import { useModelState } from '@/contexts/ModelStateContext';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Activity,
  MessageSquare,
  Bot,
  Phone,
  Bell,
  AlertTriangle,
  CheckCircle,
  Gauge,
  Download,
  Loader2,
  Zap,
} from 'lucide-react';

type DemoState = 'idle' | 'running' | 'completed' | 'error';

interface ProcessedEvent extends StreamEvent {
  timestamp: Date;
}

export function LiveDemoTab() {
  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [events, setEvents] = useState<ProcessedEvent[]>([]);
  const [currentTime, setCurrentTime] = useState('2:15 PM');
  const [speed, setSpeed] = useState(1.5);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsContainerRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to latest event
  useEffect(() => {
    if (eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
  }, [events]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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

  const handleStart = () => {
    setDemoState('running');
    setEvents([]);
    setError(null);

    eventSourceRef.current = streamingApi.startDemo(
      speed,
      // On each event
      (event) => {
        setCurrentTime(event.time_label);
        setEvents((prev) => [...prev, { ...event, timestamp: new Date() }]);
      },
      // On start
      () => {
        setCurrentTime('2:15 PM');
      },
      // On complete
      () => {
        setDemoState('completed');
        eventSourceRef.current = null;
      },
      // On error
      (err) => {
        setError(err);
        setDemoState('error');
        eventSourceRef.current = null;
      }
    );
  };

  const handleStop = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    try {
      await streamingApi.stopDemo();
    } catch {
      // Ignore errors when stopping
    }
    setDemoState('idle');
  };

  const handleReset = async () => {
    await handleStop();
    setEvents([]);
    setCurrentTime('2:15 PM');
    setError(null);
    try {
      await streamingApi.resetDemo();
    } catch {
      // Ignore errors
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'biometric':
        return <Activity className="h-4 w-4 text-red-500" />;
      case 'motion':
        return <Gauge className="h-4 w-4 text-blue-500" />;
      case 'voice':
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case 'agent_summary':
      case 'agent_decision':
        return <Bot className="h-4 w-4 text-amber-500" />;
      case 'tool_execution':
        return <Phone className="h-4 w-4 text-green-500" />;
      case 'resolution':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  const getEventBadgeVariant = (type: string, result?: ProcessedEvent['result']) => {
    if (result?.anomaly_detection?.is_anomaly) return 'danger';
    if (result?.classification?.label === 'emergency') return 'danger';
    if (result?.classification?.label === 'concern') return 'warning';
    if (result?.agent?.decision === 'escalate') return 'danger';
    if (type === 'resolution') return 'success';
    return 'secondary';
  };

  const renderEventResult = (event: ProcessedEvent) => {
    const { result } = event;
    if (!result) return null;

    if (result.anomaly_detection) {
      return (
        <div className="mt-2 p-2 bg-white rounded text-sm">
          <div className="flex items-center gap-2">
            {result.anomaly_detection.is_anomaly ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span className={result.anomaly_detection.is_anomaly ? 'text-red-600 font-medium' : 'text-green-600'}>
              {result.anomaly_detection.is_anomaly ? 'ANOMALY DETECTED' : 'Normal'}
            </span>
            <span className="text-slate-500">
              (Score: {(result.anomaly_detection.score * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      );
    }

    if (result.classification) {
      return (
        <div className="mt-2 p-2 bg-white rounded text-sm">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                result.classification.label === 'emergency'
                  ? 'danger'
                  : result.classification.label === 'concern'
                  ? 'warning'
                  : 'info'
              }
            >
              {result.classification.label.toUpperCase()}
            </Badge>
            <span className="text-slate-500">
              Confidence: {(result.classification.score * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      );
    }

    if (result.agent) {
      return (
        <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={result.agent.decision === 'escalate' ? 'danger' : 'warning'}>
              {result.agent.decision.toUpperCase()}
            </Badge>
          </div>
          <p className="text-slate-600 text-xs">{result.agent.reasoning}</p>
          {result.agent.actions.length > 0 && (
            <div className="mt-1 flex gap-1">
              {result.agent.actions.map((action, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {action}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (result.tool_call) {
      return (
        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="h-4 w-4 text-green-600" />
            <span className="font-mono text-green-700">{result.tool_call.tool_name}</span>
          </div>
          <p className="text-green-600 text-xs">{result.tool_call.result}</p>
        </div>
      );
    }

    if (result.resolution) {
      const resolution = result.resolution as { outcome?: string; status?: string };
      return (
        <div className="mt-2 p-2 bg-green-100 rounded text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-green-700 font-medium">Situation Resolved</span>
          </div>
          <p className="text-green-600 text-xs mt-1">{resolution.outcome}</p>
        </div>
      );
    }

    if (result.agent_summary) {
      const summary = result.agent_summary as {
        anomalies_detected?: number;
        concern_classifications?: number;
        time_since_last_kitchen?: string;
        motion_pattern?: string;
      };
      return (
        <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Anomalies:</span>{' '}
              <span className="font-medium text-red-600">{summary.anomalies_detected}</span>
            </div>
            <div>
              <span className="text-slate-500">Concerns:</span>{' '}
              <span className="font-medium text-amber-600">{summary.concern_classifications}</span>
            </div>
            <div>
              <span className="text-slate-500">Kitchen:</span>{' '}
              <span className="font-medium">{summary.time_since_last_kitchen}</span>
            </div>
            <div>
              <span className="text-slate-500">Motion:</span>{' '}
              <span className="font-medium">{summary.motion_pattern}</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Live Streaming Demo</h2>
        <p className="text-slate-600 mt-2">
          Watch Margaret's concerning afternoon unfold in real-time (~90 seconds at 1.5x speed)
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
              Train or load the ML models before running the demo
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

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Demo Controls
            </span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono">{currentTime}</span>
              <Badge
                variant={
                  demoState === 'running'
                    ? 'success'
                    : demoState === 'completed'
                    ? 'info'
                    : demoState === 'error'
                    ? 'danger'
                    : 'secondary'
                }
              >
                {demoState === 'running'
                  ? 'LIVE'
                  : demoState === 'completed'
                  ? 'Complete'
                  : demoState === 'error'
                  ? 'Error'
                  : 'Ready'}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            {demoState === 'idle' && 'Click Start to begin the streaming demo'}
            {demoState === 'running' && `Streaming at ${speed}x speed...`}
            {demoState === 'completed' && 'Demo complete! Click Reset to run again'}
            {demoState === 'error' && 'An error occurred'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Button
              onClick={demoState === 'running' ? handleStop : handleStart}
              variant={demoState === 'running' ? 'destructive' : 'default'}
              size="lg"
              disabled={demoState === 'error' || (!allModelsReady && demoState !== 'running')}
            >
              {demoState === 'running' ? (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start Demo
                </>
              )}
            </Button>
            <Button variant="outline" size="lg" onClick={handleReset}>
              <RotateCcw className="h-5 w-5 mr-2" />
              Reset
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-500">Speed:</span>
              {[1, 1.5, 2, 3].map((s) => (
                <Button
                  key={s}
                  variant={speed === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSpeed(s)}
                  disabled={demoState === 'running'}
                >
                  {s}x
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Event Stream */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Event Stream</span>
            {events.length > 0 && (
              <span className="text-sm font-normal text-slate-500">
                {events.length} events
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Real-time sensor data and ML processing results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={eventsContainerRef}
            className="space-y-3 max-h-[500px] overflow-y-auto pr-2"
          >
            {events.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                {demoState === 'idle'
                  ? 'Events will appear here when you start the demo'
                  : 'Waiting for events...'}
              </div>
            ) : (
              events.map((event, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border transition-all ${
                    i === events.length - 1
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-16 text-center">
                      <span className="text-sm font-mono text-slate-500">
                        {event.time_label}
                      </span>
                    </div>
                    <div className="flex-shrink-0">{getEventIcon(event.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getEventBadgeVariant(event.type, event.result)}>
                          {event.type.replace('_', ' ')}
                        </Badge>
                        {event.result?.fallback && (
                          <Badge variant="secondary" className="text-xs">
                            simulated
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{event.narrator}</p>
                      {renderEventResult(event)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary (after completion) */}
      {demoState === 'completed' && events.length > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Demo Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {events.filter((e) => e.result?.anomaly_detection?.is_anomaly).length}
                </div>
                <div className="text-sm text-slate-500">Anomalies Detected</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {
                    events.filter(
                      (e) =>
                        e.result?.classification?.label === 'concern' ||
                        e.result?.classification?.label === 'emergency'
                    ).length
                  }
                </div>
                <div className="text-sm text-slate-500">Voice Concerns</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">
                  {events.filter((e) => e.result?.tool_call).length}
                </div>
                <div className="text-sm text-slate-500">Tools Called</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">1</div>
                <div className="text-sm text-slate-500">Resolution</div>
              </div>
            </div>
            <p className="mt-4 text-center text-slate-600">
              The system detected early warning signs and contacted Margaret's daughter Sarah,
              preventing a potential emergency through early intervention.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
