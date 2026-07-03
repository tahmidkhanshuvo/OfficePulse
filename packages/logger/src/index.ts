export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function write(level: LogLevel, component: string, message: string, context?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...context
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(component: string): Logger {
  return {
    debug: (message, context) => write("debug", component, message, context),
    info: (message, context) => write("info", component, message, context),
    warn: (message, context) => write("warn", component, message, context),
    error: (message, context) => write("error", component, message, context)
  };
}
