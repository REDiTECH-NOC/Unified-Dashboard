import type { MonitorExecutor } from "./base";
import { HttpExecutor } from "./http";
import { TcpExecutor } from "./tcp";
import { PingExecutor } from "./ping";
import { DnsExecutor } from "./dns";
import { RedisExecutor } from "./redis-check";
import { MysqlExecutor } from "./mysql";
import { PostgresqlExecutor } from "./postgresql";
import { SqlServerExecutor } from "./sqlserver";
import { MongodbExecutor } from "./mongodb";
import { DockerExecutor } from "./docker";

const executors: Record<string, MonitorExecutor> = {
  HTTP: new HttpExecutor(),
  TCP: new TcpExecutor(),
  PING: new PingExecutor(),
  DNS: new DnsExecutor(),
  REDIS: new RedisExecutor(),
  MYSQL: new MysqlExecutor(),
  POSTGRESQL: new PostgresqlExecutor(),
  SQLSERVER: new SqlServerExecutor(),
  MONGODB: new MongodbExecutor(),
  DOCKER: new DockerExecutor(),
};

export function getExecutor(type: string): MonitorExecutor {
  const executor = executors[type];
  if (!executor) throw new Error(`Unknown monitor type: ${type}`);
  return executor;
}
