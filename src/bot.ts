import 'dotenv/config';
import { Bot, Context, session } from "grammy";
import {
  conversations,
  createConversation,
  ConversationFlavor,
} from "@grammyjs/conversations";
import { RedisAdapter } from "@grammyjs/storage-redis";
import Redis from "ioredis";
import { registrationFlow } from "./registration";
import { prisma } from "../server/lib/prisma";
import { InlineKeyboard } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required in .env");
}

export type MyContext = Context & ConversationFlavor;

const bot = new Bot<MyContext>(BOT_TOKEN);

const redisInstance = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
redisInstance.on('error', (err) => {
  console.error('[ioredis] Redis Error:', err.message);
});

const storage = new RedisAdapter({ instance: redisInstance });

bot.use(
  session({
    initial: () => ({}),
    storage,
  })
);

bot.use(conversations());
bot.use(createConversation(registrationFlow, "register"));

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Error] Update ${ctx.update.update_id}:`, err.error);
});

// Guard: Check if the user is already registered before entering the flow
bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (existingUser) {
      const webAppUrl = `${process.env.WEBAPP_URL}?gender=${existingUser.gender.toLowerCase()}`;
      const launchKeyboard = new InlineKeyboard().webApp("Launch Test 🚀", webAppUrl);
      await ctx.reply(
        `👋 Welcome back, *${existingUser.fullName}*!\nYou are already registered. Click below to launch.`,
        { reply_markup: launchKeyboard, parse_mode: "Markdown" }
      );
      return;
    }
  } catch (err) {
    console.error("DB check on /start failed:", err);
  }

  await ctx.conversation.enter("register");
});

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started successfully!`);
  },
});
