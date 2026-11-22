import * as SunCalc from "suncalc";
import { MONTHS } from "./moonService";

const TZ_OFFSET_MS = 5 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

interface Shower {
    name: string;
    start: [number, number]; // [oy, kun]
    peak: [number, number];
    end: [number, number];
    zhr: number; // ideal sharoitda soatiga meteorlar soni
}

// Sanalar taxminiy: cho'qqi har yili ±1 kunga siljishi mumkin
const SHOWERS: Shower[] = [
    { name: "Kvadrantidlar", start: [12, 28], peak: [1, 3], end: [1, 12], zhr: 110 },
    { name: "Liridlar", start: [4, 14], peak: [4, 22], end: [4, 30], zhr: 18 },
    { name: "Eta-Akvaridlar", start: [4, 19], peak: [5, 6], end: [5, 28], zhr: 50 },
    { name: "Perseidlar", start: [7, 17], peak: [8, 12], end: [8, 24], zhr: 100 },
    { name: "Orionidlar", start: [10, 2], peak: [10, 21], end: [11, 7], zhr: 20 },
    { name: "Janubiy Tavridlar", start: [9, 10], peak: [11, 5], end: [11, 20], zhr: 5 },
    { name: "Shimoliy Tavridlar", start: [10, 20], peak: [11, 12], end: [12, 10], zhr: 5 },
    { name: "Leonidlar", start: [11, 6], peak: [11, 17], end: [11, 30], zhr: 15 },
    { name: "Geminidlar", start: [12, 4], peak: [12, 14], end: [12, 20], zhr: 150 },
    { name: "Ursidlar", start: [12, 17], peak: [12, 22], end: [12, 26], zhr: 10 },
];

// "Toshkent sanasi" UTC yarim tun ko'rinishida
function todayKey(now: Date): number {
    const t = new Date(now.getTime() + TZ_OFFSET_MS);
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

function fmtDay(ms: number): string {
    const t = new Date(ms);
    return `${t.getUTCDate()}-${MONTHS[t.getUTCMonth()]}`;
}

function inDays(ms: number, today: number): string {
    const n = Math.round((ms - today) / DAY);
    if (n === 0) return "bugun";
    if (n === 1) return "ertaga";
    return `${n} kundan keyin`;
}

function isActive(s: Shower, today: number): boolean {
    const year = new Date(today).getUTCFullYear();
    for (const y of [year - 1, year]) {
        const start = Date.UTC(y, s.start[0] - 1, s.start[1]);
        const end = Date.UTC(y + (s.end[0] < s.start[0] ? 1 : 0), s.end[0] - 1, s.end[1]);
        if (start <= today && today <= end) return true;
    }
    return false;
}

function nextPeak(s: Shower, today: number): number {
    const year = new Date(today).getUTCFullYear();
    for (const y of [year, year + 1]) {
        const p = Date.UTC(y, s.peak[0] - 1, s.peak[1]);
        if (p >= today) return p;
    }
    return Date.UTC(year + 1, s.peak[0] - 1, s.peak[1]);
}

// Cho'qqi kechasi Oy qanchalik yorqin (kuzatishga xalaqit beradi)
function moonNote(peakMs: number): string {
    const evening = new Date(peakMs + 17 * 3600 * 1000); // ~22:00 Toshkent
    const percent = Math.round(SunCalc.getMoonIllumination(evening).fraction * 100);
    const verdict = percent < 30 ? "kuzatish uchun qulay" : percent < 70 ? "o'rtacha" : "Oy xalaqit beradi";
    return `🌙 Oy ${percent}% (${verdict})`;
}

export function meteorReport(now: Date = new Date()): string {
    const today = todayKey(now);

    const active = SHOWERS.filter((s) => isActive(s, today));
    const upcoming = SHOWERS
        .map((s) => ({ s, peak: nextPeak(s, today) }))
        .sort((a, b) => a.peak - b.peak)
        .slice(0, 3);

    const activeText = active.length
        ? active.map((s) => `• ${s.name} (cho'qqi ${fmtDay(nextPeak(s, today - 20 * DAY))}, soatiga ~${s.zhr} ta)`).join("\n")
        : "Hozir katta meteor yomg'iri yo'q.";

    const upcomingText = upcoming
        .map(({ s, peak }) =>
            `☄️ ${s.name}: ${fmtDay(peak)} (${inDays(peak, today)})\n` +
            `   soatiga ~${s.zhr} ta, ${moonNote(peak)}`,
        )
        .join("\n\n");

    return (
        `🌠 Hozir faol:\n${activeText}\n\n` +
        `📅 Eng yaqin cho'qqilar:\n\n${upcomingText}\n\n` +
        "Kuzatish uchun: shahar chirog'idan uzoqroq, qorong'i joyda, tungi soat 1-5 oralig'ida eng yaxshi ko'rinadi."
    );
}