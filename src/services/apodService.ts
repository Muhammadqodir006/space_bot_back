import type { ApodCache } from "@prisma/client";
import { prisma } from "../db/prisma";
import { fetchApodFromNasa, type NasaApod } from "./nasaService";
import { translateText } from "./translationService";

export function todayInEastern(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// NASA ba'zan rasm o'rniga sayt logotipini qaytaradi
function isPlaceholder(nasa: NasaApod): boolean {
    return /nasa-logo/i.test(nasa.url) || nasa.title.trim() === "NASA Science";
}

function previousDay(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

async function load(date: string): Promise<ApodCache> {
    let row = await prisma.apodCache.findUnique({ where: { date } });

    // Oldin keshlangan logotipli qatorni o'chirib, qayta olamiz
    if (row && /nasa-logo/i.test(row.url)) {
        await prisma.apodCache.delete({ where: { date: row.date } });
        row = null;
    }

    if (!row) {
        const nasa = await fetchApodFromNasa(date);

        if (isPlaceholder(nasa)) {
            throw new Error("APOD hali tayyor emas (NASA logotip qaytardi)");
        }

        row = await prisma.apodCache.upsert({
            where: { date: nasa.date },
            update: {},
            create: {
                date: nasa.date,
                titleEn: nasa.title,
                explanationEn: nasa.explanation
                    .replace(/\s*Tomorrow's picture:.*$/s, "")
                    .trim(),
                mediaType: nasa.media_type,
                url: nasa.url,
                hdUrl: nasa.hdurl,
                copyright: nasa.copyright?.trim(),
            },
        });
    }

    // Tarjima yo'q bo'lsa (yoki oldin xato bo'lgan bo'lsa) qayta urinamiz
    if (!row.titleUz || !row.explanationUz) {
        const [titleUz, explanationUz] = await Promise.all([
            row.titleUz ?? translateText(row.titleEn),
            row.explanationUz ?? translateText(row.explanationEn),
        ]);
        if (titleUz !== row.titleUz || explanationUz !== row.explanationUz) {
            row = await prisma.apodCache.update({
                where: { date: row.date },
                data: { titleUz, explanationUz },
            });
        }
    }

    return row;
}

// Bir vaqtda ko'p user so'rasa, NASA/AI ga bitta so'rov ketadi
const inflight = new Map<string, Promise<ApodCache>>();

function getOnce(date: string): Promise<ApodCache> {
    const existing = inflight.get(date);
    if (existing) return existing;

    const p = load(date).finally(() => inflight.delete(date));
    inflight.set(date, p);
    return p;
}

export async function getApod(date?: string): Promise<ApodCache> {
    // Aniq sana so'ralgan bo'lsa, o'sha sana (xato bo'lsa xato)
    if (date) return getOnce(date);

    const today = todayInEastern();
    try {
        return await getOnce(today);
    } catch (err) {
        console.warn("⚠️ Bugungi APOD tayyor emas, kechagisini olamiz:", (err as Error).message);
        try {
            return await getOnce(previousDay(today));
        } catch {
            // NASA umuman bermasa, DB'dagi eng so'nggi to'g'ri rasm
            const latest = await prisma.apodCache.findFirst({
                where: { NOT: { url: { contains: "nasa-logo" } } },
                orderBy: { date: "desc" },
            });
            if (latest) return latest;
            throw err;
        }
    }
}