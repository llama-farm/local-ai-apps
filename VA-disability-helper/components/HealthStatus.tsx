"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface HealthStatus {
  status: "healthy" | "error" | "checking";
  message?: string;
  url?: string;
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthStatus>({ status: "checking" });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();

        if (response.ok && data.status === "healthy") {
          setHealth({ status: "healthy", url: data.url });
        } else {
          setHealth({
            status: "error",
            message: data.message || "LlamaFarm unavailable",
            url: data.url,
          });
        }
      } catch (error: any) {
        setHealth({
          status: "error",
          message: "Cannot reach health endpoint",
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (health.status === "checking") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (health.status === "healthy") {
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-green-600">
        <CheckCircle2 className="w-3 h-3" />
        LlamaFarm Connected
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="flex items-center gap-1">
      <AlertCircle className="w-3 h-3" />
      LlamaFarm Offline
    </Badge>
  );
}
