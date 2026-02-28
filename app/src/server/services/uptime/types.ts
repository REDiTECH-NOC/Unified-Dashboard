export interface ExecutorResult {
  status: "UP" | "DOWN";
  latencyMs: number;
  message: string;
  tlsInfo?: TlsInfo | null;
  dnsResult?: DnsResult | null;
  packetLoss?: number; // 0-100 percentage, populated by PING executor
}

export interface TlsInfo {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  fingerprint: string;
}

export interface DnsResult {
  resolvedAddresses: string[];
  recordType: string;
}

export interface HttpConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus: string;
  keyword?: string;
  invertKeyword?: boolean;
  followRedirects?: boolean;
  maxRedirects?: number;
  ignoreTls?: boolean;
  authType?: "none" | "basic";
  authUser?: string;
  authPass?: string;
}

export interface TcpConfig {
  hostname: string;
  port: number;
}

export interface PingConfig {
  hostname: string;
  packetSize?: number;
}

export interface DnsConfig {
  hostname: string;
  resolveServer?: string;
  recordType: string;
  expectedValue?: string;
}

export interface RedisConfig {
  connectionString: string;
  ignoreTls?: boolean;
}

export interface MysqlConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface PostgresqlConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface SqlServerConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
}

export interface MongodbConfig {
  connectionString: string;
}

export interface DockerConfig {
  containerId: string;
  dockerHost: string;
}

export type MonitorConfig =
  | HttpConfig
  | TcpConfig
  | PingConfig
  | DnsConfig
  | RedisConfig
  | MysqlConfig
  | PostgresqlConfig
  | SqlServerConfig
  | MongodbConfig
  | DockerConfig;
