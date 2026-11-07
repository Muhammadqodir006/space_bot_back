import { Bot, InlineKeyboard } from "grammy";
import { env } from "../config/env";
import { TOPICS, isTopic } from "../config/topics";
import { setBlocked, touchUser, upsertTelegramUser } from "../services/userService";
import { getUserTopics, subscribe, toggleTopic } from "../services/subscriptionService";
import { getApod } from "../services/apodService";

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

    // Har xabarda oxirgi faol vaqtini yangilash
    bot.use(async (ctx, next) => {
        if (ctx.from && !ctx.from.is_bot) {
            await touchUser(ctx.from.id);
        }
        await next();
    });

    bot.command("start", async (ctx) => {
        if (!ctx.from) return;
        const { user, isNew } = await upsertTelegramUser(ctx.from);

        // Yangi user avtomatik kunlik APOD'ga obuna bo'ladi
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
        await ctx.reply(SETTINGS_TEXT, { reply_markup: await settingsKeyboard(user.id) });
    });

    bot.callbackQuery(/^toggle:(.+)$/, async (ctx) => {
        const topic = ctx.match[1];
        if (!isTopic(topic)) {
            return ctx.answerCallbackQuery({ text: "Noma'lum mavzu" });
        }

        const { user } = await upsertTelegramUser(ctx.from);
        const enabled = await toggleTopic(user.id, topic);

        await ctx.answerCallbackQuery({ text: enabled ? "Yoqildi ✅" : "O'chirildi" });
        await ctx.editMessageReplyMarkup({ reply_markup: await settingsKeyboard(user.id) });
    });

    // /apod          -> bugungi rasm
    // /apod 2024-05-12 -> o'sha sanadagi rasm
    bot.command("apod", async (ctx) => {
        try {
            const arg = ctx.match?.toString().trim();
            let date: string | undefined;

            if (arg) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
                    return ctx.reply("Sanani shunday yozing: /apod 2024-05-12");
                }
                if (arg < "1995-06-16") {
                    return ctx.reply("APOD arxivi 1995-yil 16-iyundan boshlanadi.");
                }
                date = arg;
            }

            await ctx.replyWithChatAction("upload_photo");
            const apod = await getApod(date);

            const title = apod.titleUz ?? apod.titleEn;
            const text = apod.explanationUz ?? apod.explanationEn;
            const head = `🌌 ${title}\n📅 ${apod.date}`;

            if (apod.mediaType === "image") {
                try {
                    await ctx.replyWithPhoto(apod.url, { caption: head });
                } catch {
                    // Telegram rasmni ololmasa (juda katta bo'lsa), havola yuboramiz
                    await ctx.reply(`${head}\n${apod.hdUrl ?? apod.url}`);
                }
            } else {
                await ctx.reply(`${head}\n${apod.url}`);
            }

            const credit = apod.copyright ? `\n\n© ${apod.copyright}` : "";
            await ctx.reply(text.slice(0, 3900) + credit);
        } catch (err) {
            console.error("APOD xatosi:", err);
            await ctx.reply("Hozir rasmni olib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
        }
    });

    bot.command("help", (ctx) =>
        ctx.reply(
            "/start - boshlash\n" +
                "/apod - bugungi kosmik rasm\n" +
                "/apod 2024-05-12 - o'sha kundagi rasm\n" +
                "/settings - obuna mavzularini tanlash",
        ),
    );

    // Foydalanuvchi botni bloklasa / qayta yoqsa (bu yerda javob yozilmaydi)
    bot.on("my_chat_member", async (ctx) => {
        if (ctx.chat.type !== "private") return;
        const status = ctx.myChatMember.new_chat_member.status;
        await setBlocked(ctx.from.id, status === "kicked");
    });

    bot.catch((err) => {
        console.error("Bot xatosi: ", err.error);
    });

    return bot;
}