import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { env } from "../config/env";
import { TOPICS, isTopic } from "../config/topics";
import { setBlocked, touchUser, upsertTelegramUser } from "../services/userService";
import { getUserTopics, subscribe, toggleTopic } from "../services/subscriptionService";
import { getApod } from "../services/apodService";
import { searchByUzbekQuery, searchImages } from "../services/imageLibraryService";

async function settingsKeyboard(userId: number) {
    const active = new Set(await getUserTopics(userId));
    const kb = new InlineKeyboard();
    for (const t of TOPICS) {
        kb.text(`${active.has(t.key) ? "✅" : "⬜️"} ${t.label}`, `toggle:${t.key}`).row();
    }
    return kb;
}

// Rasmni avval URL bilan, bo'lmasa o'zimiz yuklab olib yuboradi
async function sendPhotoSafe(ctx: Context, urls: string[], caption: string): Promise<boolean> {
    for (const u of urls) {
        try {
            await ctx.replyWithPhoto(u, { caption });
            return true;
        } catch {
            try {
                const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
                if (!res.ok) continue;
                const buf = Buffer.from(await res.arrayBuffer());
                await ctx.replyWithPhoto(new InputFile(buf, "space.jpg"), { caption });
                return true;
            } catch (err) {
                console.warn("Rasm yuborilmadi:", u, (err as Error).message);
            }
        }
    }
    return false;
}

// Birinchi ochiladigan manzildan rasmni yuklab oladi
async function downloadImage(urls: string[]): Promise<InputFile | null> {
    for (const u of urls) {
        try {
            const res = await fetch(u, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) continue;
            const buf = Buffer.from(await res.arrayBuffer());
            return new InputFile(buf, "space.jpg");
        } catch {
            // keyingi manzilga o'tamiz
        }
    }
    return null;
}

// Qaysi foydalanuvchi qaysi so'rov bo'yicha qaysi sahifagacha ko'rgan
const progress = new Map<string, number>();
// "Yana" tugmasi uchun oxirgi so'rov
const lastQuery = new Map<number, string>();
// "/search" argumentsiz yuborilgan bo'lsa, keyingi matn so'rov deb olinadi
const awaitingSearch = new Set<number>();

async function runSearch(ctx: Context, q: string) {
    try {
        await ctx.replyWithChatAction("upload_photo");

        const key = `${ctx.from?.id ?? 0}|${q.toLowerCase()}`;
        let page = (progress.get(key) ?? 0) + 1;
        let { items } = await searchByUzbekQuery(q, page, 5);

        // Hammasi ko'rib bo'lingan bo'lsa, boshidan boshlaymiz
        if (items.length === 0 && page > 1) {
            await ctx.reply("Bu so'rov bo'yicha hammasini ko'rib chiqdingiz, boshidan boshlaymiz 🔄");
            page = 1;
            ({ items } = await searchByUzbekQuery(q, page, 5));
        }

        if (items.length === 0) {
            await ctx.reply(`"${q}" bo'yicha hech narsa topilmadi. Boshqa so'z bilan urinib ko'ring!`);
            return;
        }

        if (progress.size > 5000) progress.clear(); // xotira to'lib ketmasin
        progress.set(key, page);

        // Rasmlarni parallel yuklab olamiz, ochilmaganlarini tashlaymiz
        const downloaded = await Promise.all(
            items.map(async (i) => ({
                item: i,
                file: await downloadImage([i.mediumUrl, i.thumbUrl]),
            })),
        );
        const ready = downloaded.filter((d) => d.file !== null);

        if (ready.length === 0) {
            await ctx.reply(items.map((i) => `${i.title}\n${i.thumbUrl}`).join("\n\n"));
        } else if (ready.length === 1) {
            await ctx.replyWithPhoto(ready[0].file!, {
                caption: ready[0].item.title.slice(0, 200),
            });
        } else {
            await ctx.replyWithMediaGroup(
                ready.map(({ item, file }) => ({
                    type: "photo" as const,
                    media: file!,
                    caption: item.title.slice(0, 200),
                })),
            );
        }

        // To'liq sahifa kelgan bo'lsa, davomi bo'lishi mumkin
        if (items.length === 5 && ctx.from) {
            lastQuery.set(ctx.from.id, q);
            await ctx.reply("Yana ko'rasizmi?", {
                reply_markup: new InlineKeyboard().text("➡️ Yana 5 ta", "more"),
            });
        }
    } catch (err) {
        console.error("Qidiruv xatosi: ", err);
        await ctx.reply("Qidirib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
    }
}

const SETTINGS_TEXT = "Qaysi mavzulardan xabar olishni xohlaysiz?\nBosib yoqing yoki o'chiring:";

export function createBot() {
    if (!env.BOT_TOKEN) {
        throw new Error("BOT_TOKEN .env faylida aniqlanmagan");
    }

    const bot = new Bot(env.BOT_TOKEN);

    // Har xabarda oxirgi faol vaqtini yangilash
    bot.use(async (ctx, next) => {
        console.log("📩", ctx.message?.text ?? ctx.callbackQuery?.data ?? "(boshqa update)");
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

    // /apod            -> bugungi rasm
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
                const ok = await sendPhotoSafe(ctx, [apod.url, apod.hdUrl ?? apod.url], head);
                if (!ok) await ctx.reply(`${head}\n${apod.hdUrl ?? apod.url}`);
            } else {
                await ctx.reply(`${head}\n${apod.url}`);
            }

            const credit = apod.copyright ? `\n\n© ${apod.copyright}` : "";
            await ctx.reply(text.slice(0, 3900) + credit);
        } catch (err) {
            console.error("APOD xatosi:", err);

            // Zaxira: NASA arxividan tasodifiy rasm
            try {
                const topics = ["galaxy", "nebula", "moon", "mars", "saturn", "supernova"];
                const topic = topics[Math.floor(Math.random() * topics.length)];
                const items = await searchImages(topic, 1, 20);

                const pick = items[Math.floor(Math.random() * items.length)];
                if (pick) {
                    const ok = await sendPhotoSafe(
                        ctx,
                        [pick.mediumUrl, pick.thumbUrl],
                        `🌌 ${pick.title.slice(0, 200)}\n\nNASA'ning kunlik rasmi hozir vaqtincha ishlamayapti, shuning uchun arxivdan rasm yubordim.`,
                    );
                    if (ok) return;
                }
            } catch (fallbackErr) {
                console.error("Zaxira ham ishlamadi:", fallbackErr);
            }

            await ctx.reply("Hozir rasmni olib bo'lmadi, birozdan keyin qayta urinib ko'ring.");
        }
    });

    // /search qora tuynuk
    bot.command("search", async (ctx) => {
        const q = ctx.match?.toString().trim();
        if (!q) {
            if (ctx.from) awaitingSearch.add(ctx.from.id);
            return ctx.reply("Nimani qidiramiz? So'zni yozing, masalan: qora tuynuk");
        }
        if (ctx.from) awaitingSearch.delete(ctx.from.id);
        await runSearch(ctx, q);
    });

    // "Yana 5 ta" tugmasi: keyingi sahifa
    bot.callbackQuery("more", async (ctx) => {
        await ctx.answerCallbackQuery();

        const q = lastQuery.get(ctx.from.id);
        if (!q) {
            return ctx.reply("Qidiruv topilmadi, /search bilan qaytadan boshlang.");
        }

        // Eski tugmani olib tashlaymiz (ikki marta bosilmasin)
        try {
            await ctx.editMessageReplyMarkup();
        } catch {
            // xabar allaqachon o'zgargan bo'lsa, e'tibor bermaymiz
        }

        await runSearch(ctx, q);
    });

    bot.command("help", (ctx) =>
        ctx.reply(
            "/start - boshlash\n" +
                "/apod - bugungi kosmik rasm\n" +
                "/apod 2024-05-12 - o'sha kundagi rasm\n" +
                "/settings - obuna mavzularini tanlash\n" +
                "/search qora tuynuk - kosmik arxivdan qidirish",
        ),
    );

    // Barcha buyruqlardan KEYIN: "/search" dan keyingi oddiy matn qidiruv so'rovi
    bot.on("message:text", async (ctx) => {
        const id = ctx.from.id;
        if (!awaitingSearch.has(id)) return;

        awaitingSearch.delete(id);
        await runSearch(ctx, ctx.message.text.trim());
    });

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