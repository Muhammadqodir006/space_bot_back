import { GrammyError } from "grammy";
import {prisma} from "../db/prisma";
import { setBlocked } from "./userService";
import { only } from "node:test";

const BATCH_SIZE = 10;
const PAUSE_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BroadcastResult {
    total: number;
    sent: number;
    blocked: number;
    failed: number;
}

async function deliver(
    chatId: number,
    send: (chatId: number) => Promise<void>,
    result: BroadcastResult,
) {
    for(let attempt = 0; attempt < 3; attempt++) {
        try {
            await send(chatId);
            result.sent++;
            return;
        }catch (err) {
            if(err instanceof GrammyError) {
                if (err.error_code === 403) {
                    await setBlocked(chatId, true);
                    result.blocked++;
                    return;
                }
                if (err.error_code === 429) {
                    const wait = (err.parameters.retry_after ?? 5) * 1000;
                    await sleep(wait + 500);
                    continue;
                }
            }
            console.warn(`Xabar yuborilmadi (${chatId}): `, (err as Error).message);
            result.failed++;
            return;
        }
    }
    result.failed++;
}

export async function broadcast(
    topic: string,
    send: (chatId: number) => Promise<void>,
    onlyChatId?: number,
): Promise<BroadcastResult> {
    const chatIds = onlyChatId
        ? [onlyChatId]
        : (
              await prisma.user.findMany({
                  where: { isBlocked: false, subscriptions: { some: { topic } } },
                  select: { telegramId: true },
              })
          ).map((u) => Number(u.telegramId));

    const result: BroadcastResult = { total: chatIds.length, sent: 0, blocked: 0, failed: 0 };

    for (let i = 0; i < chatIds.length; i += BATCH_SIZE) {
        const batch = chatIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((id) => deliver(id, send, result)));
        if(i + BATCH_SIZE < chatIds.length) await sleep(PAUSE_MS);
    }
    return result;
}

export async function markNotified(type: string, externalId: string): Promise<boolean> {
    try {
        await prisma.notifiedEvent.create({data: { type, externalId}});
        return true;
    }catch (err) {
        if ((err as {code?: string}).code === "P2002") return false;
        throw err;
    }
}