"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, ShieldCheck } from "lucide-react";

interface SettingsDrawerProps {
  ragTopK: number;
  onRagTopKChange: (value: number) => void;
}

export function SettingsDrawer({ ragTopK, onRagTopKChange }: SettingsDrawerProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> Retrieval
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-3">
          <div className="flex items-center justify-between">
            <span>RAG top-k</span>
            <input
              type="range"
              min={3}
              max={12}
              value={ragTopK}
              onChange={(e) => onRagTopKChange(parseInt(e.target.value))}
              className="mx-3"
            />
            <code className="w-10 text-right">{ragTopK}</code>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-80">
            <ShieldCheck className="w-4 h-4" />
            <span>PHI stays on-device; only short excerpts go to the model.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
