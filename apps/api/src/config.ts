import "dotenv/config";
import { z } from "zod";

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
  TELEGRAM_BOT_TOKEN: z.string().trim().optional(),
  TELEGRAM_POLLING_ENABLED: z.coerce.boolean().default(false),
  TELEGRAM_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2500),
  TELEGRAM_REMINDER_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173")
});

export const config = envSchema.parse(process.env);
