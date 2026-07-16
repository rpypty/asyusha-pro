import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://asysha:asysha@127.0.0.1:5432/asysha_pro"),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  SEED_DEMO_DATA: booleanFromEnv.optional(),
  TELEGRAM_BOT_TOKEN: z.string().trim().optional(),
  TELEGRAM_POLLING_ENABLED: booleanFromEnv.default(false),
  TELEGRAM_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2500),
  TELEGRAM_REMINDER_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173")
});

const parsedConfig = envSchema.parse(process.env);

export const config = {
  ...parsedConfig,
  SEED_DEMO_DATA:
    parsedConfig.SEED_DEMO_DATA ?? parsedConfig.NODE_ENV !== "production"
};
