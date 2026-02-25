"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Zap, Globe, Server, RefreshCw } from "lucide-react";

interface ProviderConfig {
  id: string;
  providerType: string;
  endpointUrl: string;
  hasApiKey: boolean;
  apiVersion: string | null;
  complexModel: string;
  simpleModel: string;
  embeddingModel: string;
  isActive: boolean;
  updatedAt: Date;
}

// Sensible defaults per provider type
const PROVIDER_DEFAULTS: Record<
  string,
  { endpointUrl: string; apiVersion: string; complexModel: string; simpleModel: string; embeddingModel: string }
> = {
  AZURE_OPENAI: {
    endpointUrl: "https://your-resource.openai.azure.com/",
    apiVersion: "2024-12-01-preview",
    complexModel: "gpt-4o",
    simpleModel: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
  },
  OPENAI: {
    endpointUrl: "https://api.openai.com/v1",
    apiVersion: "",
    complexModel: "gpt-4o",
    simpleModel: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
  },
  CUSTOM: {
    endpointUrl: "http://localhost:11434/v1",
    apiVersion: "",
    complexModel: "llama3.1:70b",
    simpleModel: "llama3.1:8b",
    embeddingModel: "nomic-embed-text",
  },
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  AZURE_OPENAI: <Zap className="h-4 w-4" />,
  OPENAI: <Globe className="h-4 w-4" />,
  CUSTOM: <Server className="h-4 w-4" />,
};

const PROVIDER_LABELS: Record<string, string> = {
  AZURE_OPENAI: "Azure OpenAI",
  OPENAI: "OpenAI",
  CUSTOM: "Custom (Ollama, vLLM, etc.)",
};

export function ProviderConfigCard({
  config,
  onSaved,
}: {
  config: ProviderConfig | null | undefined;
  onSaved: () => void;
}) {
  const [providerType, setProviderType] = useState(
    config?.providerType || "AZURE_OPENAI"
  );
  const [endpointUrl, setEndpointUrl] = useState(
    config?.endpointUrl || PROVIDER_DEFAULTS.AZURE_OPENAI.endpointUrl
  );
  const [apiKey, setApiKey] = useState("");
  const [apiVersion, setApiVersion] = useState(
    config?.apiVersion || PROVIDER_DEFAULTS.AZURE_OPENAI.apiVersion
  );
  const [complexModel, setComplexModel] = useState(
    config?.complexModel || "gpt-4o"
  );
  const [simpleModel, setSimpleModel] = useState(
    config?.simpleModel || "gpt-4o-mini"
  );
  const [embeddingModel, setEmbeddingModel] = useState(
    config?.embeddingModel || "text-embedding-3-small"
  );
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<{ id: string; owned_by?: string }[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const updateMutation = trpc.ai.updateProviderConfig.useMutation();
  const testMutation = trpc.ai.testProviderConnection.useMutation();
  const fetchModelsMutation = trpc.ai.listAvailableModels.useMutation();

  function handleProviderChange(type: string) {
    setProviderType(type);
    const defaults = PROVIDER_DEFAULTS[type];
    if (defaults && !config) {
      setEndpointUrl(defaults.endpointUrl);
      setApiVersion(defaults.apiVersion);
      setComplexModel(defaults.complexModel);
      setSimpleModel(defaults.simpleModel);
      setEmbeddingModel(defaults.embeddingModel);
    }
  }

  async function handleFetchModels() {
    setFetchingModels(true);
    setModelsError(null);
    try {
      const result = await fetchModelsMutation.mutateAsync();
      if (result.ok) {
        setAvailableModels(result.models);
      } else {
        setModelsError(result.message);
      }
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : "Failed to fetch models");
    } finally {
      setFetchingModels(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setTestResult(null);
    try {
      await updateMutation.mutateAsync({
        providerType: providerType as "AZURE_OPENAI" | "OPENAI" | "CUSTOM",
        endpointUrl,
        apiKey,
        apiVersion: apiVersion || null,
        complexModel,
        simpleModel,
        embeddingModel,
      });
      setApiKey(""); // Clear after save
      onSaved();
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Provider</h3>
          <p className="text-sm text-muted-foreground">
            Connect to Azure OpenAI, OpenAI, or a local model server
          </p>
        </div>
        {config && (
          <span className="text-xs text-muted-foreground">
            Last updated: {new Date(config.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Provider Type */}
      <div className="space-y-2">
        <Label>Provider Type</Label>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleProviderChange(key)}
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                providerType === key
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              {PROVIDER_ICONS[key]}
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Connection Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="endpoint">Endpoint URL</Label>
          <Input
            id="endpoint"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[providerType]?.endpointUrl}
          />
          {providerType === "AZURE_OPENAI" && (
            <p className="text-xs text-muted-foreground">
              Found in Azure Portal → your OpenAI resource → Keys and Endpoint
            </p>
          )}
          {providerType === "CUSTOM" && (
            <p className="text-xs text-muted-foreground">
              Ollama default: http://hostname:11434/v1 — must be OpenAI-compatible
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.hasApiKey ? "••••••••  (saved)" : "Enter API key"}
          />
        </div>

        {providerType === "AZURE_OPENAI" && (
          <div className="space-y-2">
            <Label htmlFor="apiVersion">API Version</Label>
            <Input
              id="apiVersion"
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              placeholder="2024-12-01-preview"
            />
          </div>
        )}
      </div>

      {/* Model Deployments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Model Deployments</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFetchModels}
            disabled={fetchingModels}
          >
            {fetchingModels ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            {availableModels.length > 0 ? "Refresh Models" : "Fetch Available Models"}
          </Button>
        </div>

        {modelsError && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2.5 text-sm text-yellow-400 mb-3">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {modelsError}. You can still type model names manually below.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <ModelSelector
            label="Complex Model"
            hint="(expensive)"
            value={complexModel}
            onChange={setComplexModel}
            models={availableModels}
            placeholder="gpt-4o"
          />
          <ModelSelector
            label="Simple Model"
            hint="(cheap)"
            value={simpleModel}
            onChange={setSimpleModel}
            models={availableModels}
            placeholder="gpt-4o-mini"
          />
          <ModelSelector
            label="Embedding Model"
            hint="(RAG)"
            value={embeddingModel}
            onChange={setEmbeddingModel}
            models={availableModels}
            placeholder="text-embedding-3-small"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {availableModels.length > 0
            ? `${availableModels.length} models available — select from the dropdown or type a custom name`
            : config
            ? "Click \"Fetch Available Models\" to load your provider's model list, or type names manually"
            : "Save your provider config first, then fetch available models"}
        </p>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            testResult.ok
              ? "border-green-500/50 bg-green-500/10 text-green-400"
              : "border-red-500/50 bg-red-500/10 text-red-400"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {config ? "Update Provider" : "Save Provider"}
        </Button>
        {config && (
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Test Connection
          </Button>
        )}
      </div>
    </div>
  );
}

/** Model selector: dropdown when models are loaded, fallback to text input */
function ModelSelector({
  label,
  hint,
  value,
  onChange,
  models,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  models: { id: string; owned_by?: string }[];
  placeholder: string;
}) {
  const [manualMode, setManualMode] = useState(false);

  // If models are available and not in manual mode, show Select
  if (models.length > 0 && !manualMode) {
    // Ensure current value appears in the list (might be a custom value from before)
    const hasCurrentValue = models.some((m) => m.id === value);

    return (
      <div className="space-y-2">
        <Label>
          {label}
          <span className="ml-1 text-xs text-muted-foreground">{hint}</span>
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {!hasCurrentValue && value && (
              <SelectItem value={value}>
                {value} (current)
              </SelectItem>
            )}
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.id}
                {m.owned_by && (
                  <span className="ml-1 text-muted-foreground text-xs">
                    ({m.owned_by})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline"
        >
          Type manually instead
        </button>
      </div>
    );
  }

  // Fallback: text input
  return (
    <div className="space-y-2">
      <Label>
        {label}
        <span className="ml-1 text-xs text-muted-foreground">{hint}</span>
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {models.length > 0 && manualMode && (
        <button
          type="button"
          onClick={() => setManualMode(false)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline"
        >
          Select from list instead
        </button>
      )}
    </div>
  );
}
