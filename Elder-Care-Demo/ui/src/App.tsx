import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnomalyTab } from '@/components/tabs/AnomalyTab';
import { ClassifierTab } from '@/components/tabs/ClassifierTab';
import { AgentTab } from '@/components/tabs/AgentTab';
import { LiveDemoTab } from '@/components/tabs/LiveDemoTab';
import { ModelStateProvider } from '@/contexts/ModelStateContext';
import { Activity, MessageSquare, Bot, Play } from 'lucide-react';

function App() {
  return (
    <ModelStateProvider>
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Stop Using LLMs for Everything
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            A Guide to Private, Local LLMs for Elder Care Monitoring
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="anomaly" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="anomaly" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Anomaly</span>
            </TabsTrigger>
            <TabsTrigger value="classifier" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Classification</span>
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">LLM Agent</span>
            </TabsTrigger>
            <TabsTrigger value="demo" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Live Demo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="anomaly">
            <AnomalyTab />
          </TabsContent>

          <TabsContent value="classifier">
            <ClassifierTab />
          </TabsContent>

          <TabsContent value="agent">
            <AgentTab />
          </TabsContent>

          <TabsContent value="demo">
            <LiveDemoTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-slate-500">
          Powered by LlamaFarm | Anomaly Detection (One-Class SVM) | Classification (SetFit) | LLM Agent (qwen3:8b)
        </div>
      </footer>
    </div>
    </ModelStateProvider>
  );
}

export default App;
