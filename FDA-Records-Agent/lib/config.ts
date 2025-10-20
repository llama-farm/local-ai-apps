import { promises as fs } from "fs";
import path from "path";
import yaml from "yaml";

interface LlamaFarmConfig {
  name: string;
  namespace: string;
  version: string;
  [key: string]: any;
}

let cachedConfig: LlamaFarmConfig | null = null;

/**
 * Read llamafarm.yaml from the project root
 */
export async function getLlamaFarmConfig(): Promise<LlamaFarmConfig> {
  if (cachedConfig) {
    console.log("Using cached config:", { namespace: cachedConfig.namespace, name: cachedConfig.name });
    return cachedConfig;
  }

  try {
    // Read local file first to get namespace/name for API call
    const configPath = path.join(process.cwd(), "llamafarm.yaml");
    const configContent = await fs.readFile(configPath, "utf-8");
    const localConfig = yaml.parse(configContent);

    if (!localConfig.name || !localConfig.namespace) {
      throw new Error("llamafarm.yaml must contain 'name' and 'namespace' fields");
    }

    // Fetch the REAL config from API (source of truth)
    const LF_BASE_URL = getLlamaFarmBaseURL();
    console.log(`Fetching config from API: ${LF_BASE_URL}/v1/projects/${localConfig.namespace}/${localConfig.name}`);

    try {
      const response = await fetch(
        `${LF_BASE_URL}/v1/projects/${localConfig.namespace}/${localConfig.name}`
      );

      if (response.ok) {
        const apiData = await response.json();
        const config = apiData.project?.config || localConfig;

        console.log("Loaded config from API:", {
          namespace: config.namespace,
          name: config.name,
          version: config.version,
          databases: config.rag?.databases?.map((db: any) => db.name) || []
        });

        cachedConfig = config;
        return config;
      } else {
        console.warn("API fetch failed, using local config:", response.statusText);
      }
    } catch (apiError) {
      console.warn("API fetch error, using local config:", apiError);
    }

    // Fallback to local config
    console.log("Using local config (fallback):", {
      namespace: localConfig.namespace,
      name: localConfig.name,
      version: localConfig.version,
      databases: localConfig.rag?.databases?.map((db: any) => db.name) || []
    });

    cachedConfig = localConfig;
    return localConfig;
  } catch (error: any) {
    console.error("Failed to read llamafarm.yaml:", error);
    throw new Error(`Failed to read llamafarm.yaml: ${error.message}`);
  }
}

/**
 * Get LlamaFarm API base URL
 */
export function getLlamaFarmBaseURL(): string {
  return process.env.NEXT_PUBLIC_LF_BASE_URL || "http://localhost:8000";
}

/**
 * Clear the config cache (useful for testing or hot reload)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
