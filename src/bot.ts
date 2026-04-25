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
import { InlineKeyboard, Keyboard } from "grammy";

// Helper: Main Menu Keyboard
export const mainMenuKeyboard = new Keyboard()
  .text("📝 My Profile").text("🏆 Leaderboard").row()
  .text("📊 My Results").text("🚀 Launch App").resized();

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
      await ctx.reply(
        `👋 Welcome back, *${existingUser.fullName}*!\nYou are ready to go. Use the menu below to navigate.`,
        { 
          reply_markup: mainMenuKeyboard, 
          parse_mode: "Markdown" 
        }
      );
      return;
    }
  } catch (err) {
    console.error("DB check on /start failed:", err);
  }

  await ctx.conversation.enter("register");
});

bot.hears("📝 My Profile", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: { _count: { select: { results: true } } }
  });

  if (!user) {
    return ctx.reply("❌ You are not registered yet. Please type /start to register.");
  }

  const profile = `
👤 *Profile Details*
━━━━━━━━━━━━━━
📛 *Name:* ${user.fullName}
📱 *Phone:* ${user.phone}
🎂 *Age:* ${user.age}
⚧ *Gender:* ${user.gender}
📍 *Location:* ${user.region}, ${user.district}
🏠 *Address:* ${user.mfy}, ${user.street}, ${user.house}
📊 *Tests Taken:* ${user._count.results}
  `.trim();

  await ctx.reply(profile, { parse_mode: "Markdown" });
});

bot.hears("🏆 Leaderboard", async (ctx) => {
  try {
    const topUsers = await prisma.result.groupBy({
      by: ['userId'],
      _sum: { score: true, penaltyPts: true },
      _min: { timeSpentMs: true },
      orderBy: { _sum: { score: 'desc' } },
      take: 10
    });

    if (topUsers.length === 0) {
      return ctx.reply("🏆 Leaderboard is currently empty. Be the first to complete a test!");
    }

    let text = "🏆 *Top 10 Global Leaders*\n━━━━━━━━━━━━━━\n";
    
    for (let i = 0; i < topUsers.length; i++) {
      const row = topUsers[i];
      const user = await prisma.user.findUnique({ where: { id: row.userId } });
      const score = (row._sum.score || 0) - (row._sum.penaltyPts || 0);
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      text += `${medal} *${user?.fullName || 'Unknown'}* — \`${score} XP\`\n`;
    }

    await ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Leaderboard fetch failed:", err);
    await ctx.reply("❌ Failed to fetch leaderboard.");
  }
});

bot.hears("📊 My Results", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: { 
      results: {
        include: { test: true },
        orderBy: { completedAt: 'desc' },
        take: 5
      }
    }
  });

  if (!user) return ctx.reply("❌ You are not registered yet.");
  if (user.results.length === 0) return ctx.reply("📭 You haven't taken any tests yet.");

  let text = "📊 *Your Last 5 Test Results*\n━━━━━━━━━━━━━━\n";
  user.results.forEach(res => {
    const netScore = res.score - res.penaltyPts;
    const date = res.completedAt.toLocaleDateString();
    text += `📅 ${date} — *${res.test.title}*\n   ✨ Score: \`${netScore} XP\` (${res.score} base, -${res.penaltyPts} penalty)\n\n`;
  });

  await ctx.reply(text, { parse_mode: "Markdown" });
});

bot.hears("🚀 Launch App", async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) return ctx.reply("❌ Please register first using /start");

  const webAppUrl = `${process.env.WEBAPP_URL}?gender=${user.gender.toLowerCase()}`;
  
  if (webAppUrl.startsWith('https://')) {
    const launchKeyboard = new InlineKeyboard().webApp("Launch Test 🚀", webAppUrl);
    await ctx.reply("Click the button below to enter the Ustoz AI terminal:", {
      reply_markup: launchKeyboard
    });
  } else {
    await ctx.reply(
      `⚠️ *Note*: Your Web App URL is not HTTPS. Telegram requires HTTPS for the native "Launch" button.\n\n🔗 *Direct Link*:\n${webAppUrl}`,
      { parse_mode: "Markdown" }
    );
  }
});

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started successfully!`);
  },
});
