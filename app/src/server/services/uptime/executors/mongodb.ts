import * as net from "net";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, MongodbConfig } from "../types";

/**
 * MongoDB executor — connects and sends a hello/isMaster command
 * using the MongoDB wire protocol. A valid response means the server
 * is healthy. No driver dependency needed.
 */
export class MongodbExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as MongodbConfig;
    const start = performance.now();

    // Parse connection string for host:port
    let host = "localhost";
    let port = 27017;

    try {
      const connStr = c.connectionString || "mongodb://localhost:27017";
      // Handle mongodb:// and mongodb+srv://
      const match = connStr.match(
        /mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?:]+)(?::(\d+))?/
      );
      if (match) {
        host = match[1];
        if (match[2]) port = parseInt(match[2], 10);
      }
    } catch {
      // Use defaults
    }

    return new Promise<ExecutorResult>((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const done = (result: ExecutorResult) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve(result);
      };

      const timer = setTimeout(() => {
        done({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `MongoDB connection timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      socket.connect(port, host, () => {
        // Send OP_MSG with { hello: 1, $db: "admin" }
        // This is the modern hello command (MongoDB 5.0+, backwards compatible)
        const doc = buildBsonDoc({
          hello: 1,
          $db: "admin",
        });

        const msgHeader = Buffer.alloc(16 + 4 + doc.length);
        const totalLen = msgHeader.length;
        msgHeader.writeInt32LE(totalLen, 0); // messageLength
        msgHeader.writeInt32LE(1, 4); // requestID
        msgHeader.writeInt32LE(0, 8); // responseTo
        msgHeader.writeInt32LE(2013, 12); // opCode: OP_MSG
        msgHeader.writeUInt32LE(0, 16); // flags
        // Section kind 0 (body) = 0x00
        doc.copy(msgHeader, 20);
        // Prepend section kind byte
        const msg = Buffer.alloc(totalLen + 1);
        msgHeader.copy(msg, 0, 0, 20);
        msg[20] = 0x00; // kind = body
        doc.copy(msg, 21);
        msg.writeInt32LE(msg.length, 0);

        socket.write(msg);
      });

      socket.once("data", (data) => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);

        // Any response from MongoDB means the server is alive
        if (data.length >= 16) {
          done({
            status: "UP",
            latencyMs,
            message: `MongoDB server responding on ${host}:${port}`,
          });
        } else {
          done({
            status: "DOWN",
            latencyMs,
            message: "MongoDB invalid response",
          });
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        done({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `MongoDB connection failed: ${err.message}`,
        });
      });
    });
  }
}

/** Minimal BSON document builder for simple key-value docs */
function buildBsonDoc(obj: Record<string, unknown>): Buffer {
  const parts: Buffer[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const keyBuf = Buffer.from(key + "\0");

    if (typeof value === "number" && Number.isInteger(value)) {
      // Int32
      const b = Buffer.alloc(1 + keyBuf.length + 4);
      b[0] = 0x10; // type: int32
      keyBuf.copy(b, 1);
      b.writeInt32LE(value, 1 + keyBuf.length);
      parts.push(b);
    } else if (typeof value === "string") {
      // String
      const strBuf = Buffer.from(value + "\0");
      const b = Buffer.alloc(1 + keyBuf.length + 4 + strBuf.length);
      b[0] = 0x02; // type: string
      keyBuf.copy(b, 1);
      b.writeInt32LE(strBuf.length, 1 + keyBuf.length);
      strBuf.copy(b, 1 + keyBuf.length + 4);
      parts.push(b);
    }
  }

  const bodyLen = parts.reduce((s, p) => s + p.length, 0);
  const doc = Buffer.alloc(4 + bodyLen + 1); // 4-byte length + body + 0x00 terminator
  doc.writeInt32LE(doc.length, 0);
  let offset = 4;
  for (const part of parts) {
    part.copy(doc, offset);
    offset += part.length;
  }
  doc[offset] = 0x00;

  return doc;
}
