import type { ExecutorResult } from "../types";

export interface MonitorExecutor {
  execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult>;
}
