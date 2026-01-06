import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { anomalyApi, classifierApi } from '@/lib/api';

interface ModelStates {
  biometricTrained: boolean;
  motionPatternTrained: boolean;
  classifierTrained: boolean;
}

interface ModelStateContextType extends ModelStates {
  setBiometricTrained: (trained: boolean) => void;
  setMotionPatternTrained: (trained: boolean) => void;
  setClassifierTrained: (trained: boolean) => void;
  refreshAllStatuses: () => Promise<void>;
}

const ModelStateContext = createContext<ModelStateContextType | null>(null);

export function ModelStateProvider({ children }: { children: ReactNode }) {
  const [biometricTrained, setBiometricTrained] = useState(false);
  const [motionPatternTrained, setMotionPatternTrained] = useState(false);
  const [classifierTrained, setClassifierTrained] = useState(false);
  const hasInitialized = useRef(false);

  // On mount: try to load saved models, then check status
  const initModels = async () => {
    // Just call load on each - if saved, it loads; if not, it fails silently
    await Promise.all([
      anomalyApi.loadBiometric().catch(() => {}),
      anomalyApi.loadMotionPattern().catch(() => {}),
      classifierApi.load().catch(() => {}),
    ]);

    // Now check what's actually loaded
    await refreshAllStatuses();
  };

  const refreshAllStatuses = async () => {
    try {
      const [biometricStatus, motionPatternStatus, classifierStatus] = await Promise.all([
        anomalyApi.getStatus('biometric').catch(() => ({ is_trained: false })),
        anomalyApi.getMotionPatternStatus().catch(() => ({ is_trained: false })),
        classifierApi.getStatus().catch(() => ({ is_trained: false })),
      ]);
      setBiometricTrained(biometricStatus.is_trained);
      setMotionPatternTrained(motionPatternStatus.is_trained);
      setClassifierTrained(classifierStatus.is_trained);
    } catch (err) {
      console.error('Failed to refresh model statuses:', err);
    }
  };

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initModels();
    }
  }, []);

  return (
    <ModelStateContext.Provider
      value={{
        biometricTrained,
        motionPatternTrained,
        classifierTrained,
        setBiometricTrained,
        setMotionPatternTrained,
        setClassifierTrained,
        refreshAllStatuses,
      }}
    >
      {children}
    </ModelStateContext.Provider>
  );
}

export function useModelState() {
  const context = useContext(ModelStateContext);
  if (!context) {
    throw new Error('useModelState must be used within a ModelStateProvider');
  }
  return context;
}
