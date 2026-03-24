import { logger } from "firebase-functions";
import { v4 as uuidv4 } from "uuid";

/**
 * Structured logger that attaches a correlation ID to each log entry.
 */
export const createLogger = (correlationId?: string) => {
  const id = correlationId || uuidv4();

  return {
    info: (message: string, data?: Record<string, unknown>) =>
      logger.info({ correlationId: id, message, ...data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      logger.warn({ correlationId: id, message, ...data }),
    error: (message: string, data?: Record<string, unknown>) =>
      logger.error({ correlationId: id, message, ...data }),
    correlationId: id,
  };
};
