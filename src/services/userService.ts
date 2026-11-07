import {prisma} from "../db/prisma";
import {env} from "../config/env";

interface TgUser {
    id: number;
    first_name?: string;
    username?: string;
    language_code?: string;
}

export async function upsertTelegramUser(from: TgUser) {
    const telegramId = BigInt(from.id);
    const existing = await prisma.user.findUnique({ where: { telegramId}});

    if(existing) {
        const user = await prisma.user.update({
            where: { telegramId},
            data: {
                firstName: from.first_name,
                username: from.username,
                languageCode: from.language_code,
                lastActiveAt: new Date(),
                isBlocked: false,
            },
        });
        return { user, isNew: false};
    }

    const user = await prisma.user.create({
        data: {
            telegramId,
            firstName: from.first_name,
            username: from.username,
            languageCode: from.language_code,
            isAdmin: env.adminId.includes(telegramId),
        },
    });
    return {user, isNew: true};
}

export async function touchUser(telegramId: number) {
    await prisma.user.updateMany({
        where: { telegramId: BigInt(telegramId)},
        data: { lastActiveAt: new Date()},
    });
}

export async function setBlocked(telegramId: number, isBlocked: boolean) {
    await prisma.user.updateMany({
        where: { telegramId: BigInt(telegramId)},
        data: { isBlocked},
    });
}