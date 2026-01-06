import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { anomalyApi, type AnomalyResult, type BiometricReading } from '@/lib/api';
import { Activity, Heart, Thermometer, Gauge, AlertTriangle, CheckCircle, Database, Upload } from 'lucide-react';
import { MotionPatternPanel } from './MotionPatternPanel';
import { useModelState } from '@/contexts/ModelStateContext';

export function AnomalyTab() {
  const { biometricTrained: isTrained, setBiometricTrained: setIsTrained } = useModelState();
  const [isTraining, setIsTraining] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Biometric form values
  const [heartRate, setHeartRate] = useState(72);
  const [systolicBp, setSystolicBp] = useState(120);
  const [diastolicBp, setDiastolicBp] = useState(78);
  const [temperature, setTemperature] = useState(98.2);

  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    try {
      await anomalyApi.trainBiometric();
      setIsTrained(true);
      // Auto-save after training
      try {
        await anomalyApi.saveBiometric();
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
      const anomalyResult = await anomalyApi.detectBiometric({
        heart_rate: heartRate,
        systolic_bp: systolicBp,
        diastolic_bp: diastolicBp,
        temperature: temperature,
        activity_level: 'resting',
      });
      setResult(anomalyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setIsDetecting(false);
    }
  };

  const [isLoadingPreset, setIsLoadingPreset] = useState(false);

  // Training data modal state
  const [showTrainingData, setShowTrainingData] = useState(false);
  const [trainingData, setTrainingData] = useState<BiometricReading[]>([]);
  const [trainingDataTotal, setTrainingDataTotal] = useState(0);
  const [isLoadingTrainingData, setIsLoadingTrainingData] = useState(false);

  // Load state
  const [isLoading, setIsLoading] = useState(false);

  const handleShowTrainingData = async () => {
    setIsLoadingTrainingData(true);
    try {
      const data = await anomalyApi.getBiometricTrainingData(20);
      setTrainingData(data.samples);
      setTrainingDataTotal(data.total_samples);
      setShowTrainingData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training data');
    } finally {
      setIsLoadingTrainingData(false);
    }
  };

  const handleLoad = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await anomalyApi.loadBiometric();
      setIsTrained(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed - model may not exist yet');
    } finally {
      setIsLoading(false);
    }
  };

  const setPreset = async (type: 'normal' | 'abnormal') => {
    setIsLoadingPreset(true);
    setError(null);
    try {
      const reading = await anomalyApi.getRandomBiometric(type);
      setHeartRate(reading.heart_rate);
      setSystolicBp(reading.systolic_bp);
      setDiastolicBp(reading.diastolic_bp);
      setTemperature(reading.temperature);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get random values');
    } finally {
      setIsLoadingPreset(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Anomaly Detection</h2>
        <p className="text-slate-600 mt-2">
          One-Class SVM trained on normal biometric data. Fast detection without LLM overhead.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Training Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Model Training
            </CardTitle>
            <CardDescription>
              Train on 250 normal biometric readings
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
            <CardTitle>Biometric Input</CardTitle>
            <CardDescription>Enter values or use presets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Heart className="h-4 w-4 text-red-500" />
                  Heart Rate
                </label>
                <Input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  min={30}
                  max={200}
                />
                <span className="text-xs text-slate-500">Normal: 60-90 bpm</span>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Gauge className="h-4 w-4 text-blue-500" />
                  Systolic BP
                </label>
                <Input
                  type="number"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(Number(e.target.value))}
                  min={60}
                  max={220}
                />
                <span className="text-xs text-slate-500">Normal: 110-140</span>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Gauge className="h-4 w-4 text-purple-500" />
                  Diastolic BP
                </label>
                <Input
                  type="number"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(Number(e.target.value))}
                  min={40}
                  max={140}
                />
                <span className="text-xs text-slate-500">Normal: 70-90</span>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Thermometer className="h-4 w-4 text-orange-500" />
                  Temperature
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  min={95}
                  max={105}
                />
                <span className="text-xs text-slate-500">Normal: 97.5-98.8 F</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('normal')}
                disabled={isLoadingPreset}
              >
                {isLoadingPreset ? '...' : 'Normal Values'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('abnormal')}
                disabled={isLoadingPreset}
              >
                {isLoadingPreset ? '...' : 'Abnormal Values'}
              </Button>
            </div>

            <Button
              onClick={handleDetect}
              disabled={!isTrained || isDetecting}
              className="w-full"
              variant={isTrained ? 'default' : 'secondary'}
            >
              {isDetecting ? 'Detecting...' : 'Detect Anomaly'}
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
        <Card className={result.is_anomaly ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.is_anomaly ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-600" />
              )}
              {result.is_anomaly ? 'Anomaly Detected!' : 'Normal Reading'}
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
                <p className="text-sm text-slate-500 mt-2">
                  Threshold: 50% (above = anomaly)
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Analysis Details</h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(result.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-500">{key.replace(/_/g, ' ')}:</span>
                      <span className={
                        String(value).includes('normal') ? 'text-green-600' :
                        String(value).includes('low') || String(value).includes('high') ? 'text-red-600' :
                        'text-amber-600'
                      }>{String(value)}</span>
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
        Detection speed: ~10ms | LLM equivalent: ~1-2 seconds
      </div>

      {/* Motion Pattern Panel */}
      <div className="border-t border-slate-200 pt-8 mt-8">
        <MotionPatternPanel />
      </div>

      {/* Training Data Modal */}
      <Modal
        isOpen={showTrainingData}
        onClose={() => setShowTrainingData(false)}
        title={`Biometric Training Data (${trainingDataTotal} samples)`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            The model learns what "normal" looks like from these readings. When a new reading deviates
            significantly from this pattern, it's flagged as anomalous.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Heart Rate</th>
                  <th className="px-3 py-2 text-left">Systolic BP</th>
                  <th className="px-3 py-2 text-left">Diastolic BP</th>
                  <th className="px-3 py-2 text-left">Temp (F)</th>
                  <th className="px-3 py-2 text-left">Activity</th>
                </tr>
              </thead>
              <tbody>
                {trainingData.map((sample, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">{sample.heart_rate.toFixed(1)}</td>
                    <td className="px-3 py-2">{sample.systolic_bp.toFixed(1)}</td>
                    <td className="px-3 py-2">{sample.diastolic_bp.toFixed(1)}</td>
                    <td className="px-3 py-2">{sample.temperature.toFixed(1)}</td>
                    <td className="px-3 py-2">{sample.activity_level}</td>
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
