import {Bot, InlineKeyboard} from "grammy";
import {env} from "../config/env";
import {prisma} from "../db/prisma";
import {TOPICS, isTopic} from "../config/topics";
import {setBlocked, touchUser, upsertTelegramUser} from "../services/userService";
import {getUserTopics, subscribe, toggleTopic} from "../services/subscriptionService";

async function settingsKeyboard(userId: number) {
    const active = new Set(await getUserTopics(userId));
    const kb = new InlineKeyboard();
    for (const t of TOPICS) {
        kb.text(`${active.has(t.key) ? "✅" : "⬜️"} ${t.label}`, `toggle:${t.key}`).row();
    }
    return kb;
}

const SETTINGS_TEXT = "Qaysi mavzulardan xabar olishni xohlaysiz?\nBosib yoqing yoki o'chiring:";

export function createBot() {
    if (!env.BOT_TOKEN) {
        throw new Error("BOT_TOKEN .env faylida aniqlanmagan");
    }

    const bot = new Bot(env.BOT_TOKEN);

    bot.use(async (ctx, next) => {
        if (ctx.from && !ctx.from.is_bot) {
            await touchUser(ctx.from.id);
        }
        await next();
    });

    bot.command("start", async (ctx) => {
        if (!ctx.from) return;
        const {user, isNew} = await upsertTelegramUser(ctx.from);

        if (isNew) {
            await subscribe(user.id, "apod");
        }
        
        await ctx.reply(
      `Salom, ${ctx.from.first_name ?? "do'st"}! 🚀\n\n` +
        "Men har kuni kosmosdan qiziqarli yangiliklarni o'zbek tilida yuboraman: " +
        "NASA'ning kunlik rasmi, Mars, asteroidlar, quyosh, meteor yomg'irlari va boshqalar.\n\n" +
        "Qaysi mavzular kerakligini /settings orqali tanlang.",
    );
    });

    bot.command("settings", async (ctx) => {
        if (!ctx.from) return;
        const { user } = await upsertTelegramUser(ctx.from);
        await ctx.reply(SETTINGS_TEXT, { reply_markup: await settingsKeyboard(user.id)});
    });

    bot.callbackQuery(/^toggle:(.+)$/, async (ctx) => {
        const topic = ctx.match[1];
        if (!isTopic(topic)) {
            return ctx.answerCallbackQuery({ text: "Noma'lum mavzu"});
        }

        const { user } = await upsertTelegramUser(ctx.from);
        const enabled = await toggleTopic(user.id, topic);

        await ctx.answerCallbackQuery({ text: enabled ? "Yoqildi ✅" : "O'chirildi "});
        await ctx.editMessageReplyMarkup({ reply_markup: await settingsKeyboard(user.id)});
    });

    bot.on("my_chat_member", async (ctx) => ctx.reply("/start - boshlash\n/settings - obuna avzularini tanlash"),);

    bot.catch((err) => {
        console.error("Bot xatosi: ", err.error);
    });

    return bot;
}