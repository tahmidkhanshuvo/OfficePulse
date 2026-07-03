import { createLogger } from "../../../packages/logger/src";

const logger = createLogger("discord-bot");

logger.info("Discord bot entrypoint loaded", {
  configured: Boolean(Bun.env.DISCORD_APPLICATION_ID && Bun.env.DISCORD_BOT_TOKEN)
});
