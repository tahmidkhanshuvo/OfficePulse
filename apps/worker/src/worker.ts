import { createLogger } from "../../../packages/logger/src";
import { redisStreams } from "../../../packages/redis/src";

const logger = createLogger("worker");

logger.info("OfficePulse worker started", {
  streams: redisStreams,
  mode: Bun.env.REDIS_URL ? "redis-configured" : "in-memory-api-mode"
});
