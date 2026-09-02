import fs from "fs";
import path from "path";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "AUDIT";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  message: string;
  data?: any;
}

// Sanitização estrita contra vazamento de segredos conforme regras globais
function sanitizeData(data: any): any {
  if (!data) return data;
  if (typeof data !== "object") return data;

  try {
    const serialized = JSON.stringify(data, (key, value) => {
      const lower = key.toLowerCase();
      if (
        lower.includes("secret") ||
        lower.includes("password") ||
        lower.includes("token") ||
        lower.includes("key") ||
        lower.includes("authorization") ||
        lower.includes("cookie") ||
        lower.includes("jwt")
      ) {
        return "[REDACTED]";
      }
      return value;
    });
    return JSON.parse(serialized);
  } catch {
    return "[Unserializable Data]";
  }
}

class SystemLogger {
  private logsDir: string;
  private initialized = false;

  constructor() {
    this.logsDir = process.env.LOGS_DIR || (process.env.NODE_ENV === "production" ? "/app/logs" : path.resolve(process.cwd(), "logs"));
  }

  private ensureDir() {
    if (this.initialized) return;
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      this.initialized = true;
    } catch {
      // Falha silenciosa para não quebrar runtime
    }
  }

  private writeToFile(filename: string, text: string) {
    try {
      this.ensureDir();
      const filePath = path.join(this.logsDir, filename);
      fs.appendFileSync(filePath, text + "\n", "utf8");
    } catch {
      // Falha silenciosa
    }
  }

  public log(level: LogLevel, subsystem: string, message: string, rawData?: any) {
    const timestamp = new Date().toISOString();
    const data = rawData ? sanitizeData(rawData) : undefined;
    const formattedData = data !== undefined ? ` | ${JSON.stringify(data)}` : "";
    const logLine = `[${timestamp}] [${level}] [${subsystem}] ${message}${formattedData}`;

    // Saída padrão para captura pelo container Docker
    if (level === "ERROR") {
      console.error(logLine);
    } else if (level === "WARN") {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }

    // Gravação persistente em arquivos segregados para auditoria
    this.writeToFile("system.log", logLine);

    if (level === "ERROR") {
      this.writeToFile("error.log", logLine);
    } else if (level === "AUDIT") {
      this.writeToFile("audit.log", logLine);
    }
  }

  public info(subsystem: string, message: string, data?: any) {
    this.log("INFO", subsystem, message, data);
  }

  public warn(subsystem: string, message: string, data?: any) {
    this.log("WARN", subsystem, message, data);
  }

  public error(subsystem: string, message: string, data?: any) {
    this.log("ERROR", subsystem, message, data);
  }

  public audit(subsystem: string, message: string, data?: any) {
    this.log("AUDIT", subsystem, message, data);
  }
}

export const logger = new SystemLogger();
