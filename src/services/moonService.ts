import * as SunCalc from "suncalc";

// Toshkent
const LAT = 41.2995;
const LNG = 69.2401;
const TZ_OFFSET_MS = 5 * 3600 * 1000; // UTC+5, yozgi/qishki vaqt yo'q
const DAY = 24 * 3600 * 1000;

export const MONTHS = [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function phaseInfo(p: number): { emoji: string; name: string } {
    if (p < 0.03 || p >= 0.97) return { emoji: "🌑", name: "Yangi oy" };
    if (p < 0.22) return { emoji: "🌒", name: "O'sayotgan hilol" };
    if (p < 0.28) return { emoji: "🌓", name: "Birinchi chorak" };
    if (p < 0.47) return { emoji: "🌔", name: "O'sayotgan oy" };
    if (p < 0.53) return { emoji: "🌕", name: "To'lin oy" };
    if (p < 0.72) return { emoji: "🌖", name: "Kamayayotgan oy" };
    if (p < 0.78) return { emoji: "🌗", name: "Oxirgi chorak" };
    return { emoji: "🌘", name: "Kamayayotgan hilol" };
}

// Toshkent sanasi bo'yicha bugungi kunning boshlanishi (UTC ms)
function tashkentDayStart(now: Date): number {
    const t = new Date(now.getTime() + TZ_OFFSET_MS);
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - TZ_OFFSET_MS;
}

function fmtTime(d: Date | null): string {
    if (!d) return "—";
    const t = new Date(d.getTime() + TZ_OFFSET_MS);
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function fmtDate(d: Date): string {
    const t = new Date(d.getTime() + TZ_OFFSET_MS);
    return `${t.getUTCDate()}-${MONTHS[t.getUTCMonth()]}`;
}

function moonRiseSet(now: Date): { rise: Date | null; set: Date | null } {
    const start = tashkentDayStart(now);
    const end = start + DAY;

    let rise: Date | null = null;
    let set: Date | null = null;

    for (const shift of [-1, 0, 1]) {
        const times = SunCalc.getMoonTimes(new Date(start + shift * DAY + 12 * 3600 * 1000), LAT, LNG, true);
        for (const [key, value] of [["rise", times.rise], ["set", times.set]] as const) {
            if (!value) continue;
            const ms = value.getTime();
            if (ms < start || ms >= end) continue;
            if (key === "rise" && !rise) rise = value;
            if (key === "set" && !set) set = value;
        }
    }
    return { rise, set };
}

function nextPhase(now: Date, kind: "full" | "new"): Date | null {
    let prev = SunCalc.getMoonIllumination(now).phase;
    for (let h = 1; h <= 24 * 32; h++) {
        const t = new Date(now.getTime() + h * 3600 * 1000);
        const cur = SunCalc.getMoonIllumination(t).phase;
        if (kind === "full" && prev < 0.5 && cur >= 0.5) return t;
        if (kind === "new" && prev > 0.9 && cur < 0.1) return t;
        prev = cur;
    }
    return null;
}

export function moonReport(now: Date = new Date()): string {
    const ill = SunCalc.getMoonIllumination(now);
    const info = phaseInfo(ill.phase);
    const percent = Math.round(ill.fraction * 100);
    const { rise, set } = moonRiseSet(now);
    const full = nextPhase(now, "full");
    const fresh = nextPhase(now, "new");

    return (
        `${info.emoji} ${info.name}\n` +
        `💡 Yoritilgan qismi: ${percent}%\n\n` +
        `🌙 Oy chiqishi: ${fmtTime(rise)}\n` +
        `🌘 Oy botishi: ${fmtTime(set)}\n` +
        `(Toshkent vaqti bilan)\n\n` +
        `🌕 Keyingi to'lin oy: ${full ? fmtDate(full) : "—"}\n` +
        `🌑 Keyingi yangi oy: ${fresh ? fmtDate(fresh) : "—"}`
    );
}