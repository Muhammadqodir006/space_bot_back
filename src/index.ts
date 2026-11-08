import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectDb, disconnectDb } from "./db/prisma";
import { healthRouter } from "./routes/health";
import { createBot } from "./bot";
import { feedRouter } from "./routes/feed";

// Prisma BigInt (telegramId) ni JSON'ga o'tkazish uchun
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function main() {
  await connectDb();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", healthRouter);
  app.use("/api", feedRouter);

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server: http://localhost:${env.PORT}/api/health`);
  });

  // Bot (hozircha long polling, productionda webhook'ga o'tamiz)
  let bot: ReturnType<typeof createBot> | null = null;
  if (env.BOT_TOKEN) {
    bot = createBot();
    bot.start({
      onStart: (me) => console.log(`🤖 Bot ishga tushdi: @${me.username}`),
    });
  } else {
    console.warn("⚠️ BOT_TOKEN yo'q, bot ishga tushmadi");
  }

  const shutdown = async () => {
    server.close();
    await bot?.stop();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("❌ Ishga tushmadi:", err);
  process.exit(1);
});