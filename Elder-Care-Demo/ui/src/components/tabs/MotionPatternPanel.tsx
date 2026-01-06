import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { anomalyApi, type AnomalyResult, type MotionPatternReading } from '@/lib/api';
import { Home, Clock, DoorOpen, Activity, AlertTriangle, CheckCircle, Database, Upload } from 'lucide-react';
import { useModelState } from '@/contexts/ModelStateContext';

const ROOMS = ['bedroom', 'kitchen', 'living_room', 'bathroom'];

function getTimeLabel(window: number): string {
  const hour = Math.floor(window / 2);
  const minute = (window % 2) * 30;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

export function MotionPatternPanel() {
  const { motionPatternTrained: isTrained, setMotionPatternTrained: setIsTrained } = useModelState();
  const [isTraining, setIsTraining] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [timeWindow, setTimeWindow] = useState(24); // Noon
  const [currentRoom, setCurrentRoom] = useState('kitchen');
  const [previousRoom, setPreviousRoom] = useState('living_room');
  const [timeInRoom, setTimeInRoom] = useState(30);
  const [doorEvents, setDoorEvents] = useState(0);
  const [motionIntensity, setMotionIntensity] = useState(0.5);

  // Training data modal state
  const [showTrainingData, setShowTrainingData] = useState(false);
  const [trainingData, setTrainingData] = useState<MotionPatternReading[]>([]);
  const [trainingDataTotal, setTrainingDataTotal] = useState(0);
  const [isLoadingTrainingData, setIsLoadingTrainingData] = useState(false);

  // Load state
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const handleShowTrainingData = async () => {
    setIsLoadingTrainingData(true);
    try {
      const data = await anomalyApi.getMotionPatternTrainingData(20);
      setTrainingData(data.samples);
      setTrainingDataTotal(data.total_samples);
      setShowTrainingData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training data');
    } finally {
      setIsLoadingTrainingData(false);
    }
  };

  const handleLoadModel = async () => {
    setIsLoadingModel(true);
    setError(null);
    try {
      await anomalyApi.loadMotionPattern();
      setIsTrained(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed - model may not exist yet');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    try {
      await anomalyApi.trainMotionPattern();
      setIsTrained(true);
      // Auto-save after training
      try {
        await anomalyApi.saveMotionPattern();
      } catch {
        // Silently ignore save errors - model is still trained in memory
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  const handleDetect = async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const reading: MotionPatternReading = {
        time_window: timeWindow,
        current_room: currentRoom,
        previous_room: previousRoom,
        time_in_room_minutes: timeInRoom,
        door_events_count: doorEvents,
        motion_intensity: motionIntensity,
        is_expected_location: true, // Will be calculated server-side
      };
      const anomalyResult = await anomalyApi.detectMotionPattern(reading);
      setResult(anomalyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setIsDetecting(false);
    }
  };

  const setPreset = async (type: 'normal' | 'abnormal') => {
    setIsLoadingPreset(true);
    setError(null);
    try {
      const pattern = await anomalyApi.getRandomMotionPattern(type);
      setTimeWindow(pattern.time_window);
      setCurrentRoom(pattern.current_room);
      setPreviousRoom(pattern.previous_room);
      setTimeInRoom(pattern.time_in_room_minutes);
      setDoorEvents(pattern.door_events_count);
      setMotionIntensity(pattern.motion_intensity);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get preset');
    } finally {
      setIsLoadingPreset(false);
    }
  };

  return (
    <div className="space-y-6 mt-8">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-slate-900">Motion Pattern Detection</h3>
        <p className="text-slate-600 mt-1">
          Detects abnormal movement patterns based on Margaret's daily routine
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Training Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Pattern Model Training
            </CardTitle>
            <CardDescription>
              Train on Margaret's normal daily routine (250 samples)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={isTrained ? 'success' : 'secondary'}>
                {isTrained ? 'Trained' : 'Not Trained'}
              </Badge>
              {isTrained && <span className="text-sm text-slate-500">One-Class SVM</span>}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleTrain}
                disabled={isTraining}
                className="flex-1"
              >
                {isTraining ? 'Training...' : isTrained ? 'Retrain' : 'Train Model'}
              </Button>
              <Button
                variant="outline"
                onClick={handleLoadModel}
                disabled={isLoadingModel}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-1" />
                {isLoadingModel ? '...' : 'Load Saved'}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowTrainingData}
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
            <CardTitle>Motion Pattern Input</CardTitle>
            <CardDescription>Enter pattern or use presets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Time Window
                </label>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  {Array.from({ length: 48 }, (_, i) => (
                    <option key={i} value={i}>
                      {getTimeLabel(i)} (#{i})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Home className="h-4 w-4 text-green-500" />
                  Current Room
                </label>
                <select
                  value={currentRoom}
                  onChange={(e) => setCurrentRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  {ROOMS.map((room) => (
                    <option key={room} value={room}>
                      {room.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Home className="h-4 w-4 text-purple-500" />
                  Previous Room
                </label>
                <select
                  value={previousRoom}
                  onChange={(e) => setPreviousRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  {ROOMS.map((room) => (
                    <option key={room} value={room}>
                      {room.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4 text-orange-500" />
                  Time in Room (min)
                </label>
                <Input
                  type="number"
                  value={timeInRoom}
                  onChange={(e) => setTimeInRoom(Number(e.target.value))}
                  min={0}
                  max={120}
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <DoorOpen className="h-4 w-4 text-red-500" />
                  Door Events
                </label>
                <Input
                  type="number"
                  value={doorEvents}
                  onChange={(e) => setDoorEvents(Number(e.target.value))}
                  min={0}
                  max={10}
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Activity className="h-4 w-4 text-cyan-500" />
                  Motion Intensity
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={motionIntensity}
                  onChange={(e) => setMotionIntensity(Number(e.target.value))}
                  min={0}
                  max={1}
                />
                <span className="text-xs text-slate-500">0 = still, 1 = very active</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('normal')}
                disabled={isLoadingPreset}
              >
                {isLoadingPreset ? '...' : 'Normal Day'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('abnormal')}
                disabled={isLoadingPreset}
              >
                {isLoadingPreset ? '...' : 'Abnormal Pattern'}
              </Button>
            </div>

            <Button
              onClick={handleDetect}
              disabled={!isTrained || isDetecting}
              className="w-full"
              variant={isTrained ? 'default' : 'secondary'}
            >
              {isDetecting ? 'Detecting...' : 'Detect Pattern Anomaly'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {result && (
        <Card className={result.is_anomaly ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.is_anomaly ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-600" />
              )}
              {result.is_anomaly ? 'Abnormal Pattern Detected!' : 'Normal Pattern'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Detection Score</h4>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold">
                    {(result.score * 100).toFixed(1)}%
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          result.is_anomaly ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${result.score * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Pattern Analysis</h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(result.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-500">{key.replace(/_/g, ' ')}:</span>
                      <span className={
                        String(value).includes('normal') ? 'text-green-600' :
                        String(value).includes('ABNORMAL') || String(value).includes('CONCERN') || String(value).includes('HIGH') || String(value).includes('LOW') ? 'text-red-600' :
                        String(value).includes('unexpected') ? 'text-amber-600' :
                        'text-slate-700'
                      }>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training Data Modal */}
      <Modal
        isOpen={showTrainingData}
        onClose={() => setShowTrainingData(false)}
        title={`Motion Pattern Training Data (${trainingDataTotal} samples)`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The model learns Margaret's normal daily routine from these samples. When a pattern deviates
            significantly (wrong room at wrong time, unusual activity), it's flagged as anomalous.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Time</th>
                  <th className="px-2 py-2 text-left">Room</th>
                  <th className="px-2 py-2 text-left">Prev Room</th>
                  <th className="px-2 py-2 text-left">Minutes</th>
                  <th className="px-2 py-2 text-left">Door</th>
                  <th className="px-2 py-2 text-left">Motion</th>
                </tr>
              </thead>
              <tbody>
                {trainingData.map((sample, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-2 py-2">{getTimeLabel(sample.time_window)}</td>
                    <td className="px-2 py-2">{sample.current_room.replace('_', ' ')}</td>
                    <td className="px-2 py-2">{sample.previous_room.replace('_', ' ')}</td>
                    <td className="px-2 py-2">{sample.time_in_room_minutes}</td>
                    <td className="px-2 py-2">{sample.door_events_count}</td>
                    <td className="px-2 py-2">{sample.motion_intensity.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Showing {trainingData.length} of {trainingDataTotal} samples
          </p>
        </div>
      </Modal>
    </div>
  );
}
