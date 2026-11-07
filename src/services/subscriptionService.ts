import {prisma} from "../db/prisma";
import {TopicKey} from "../config/topics";

export async function getUserTopics(userId: number): Promise<string[]> {
    const subs = await prisma.subscription.findMany({
        where: { userId },
        select: { topic: true },
    });
    return subs.map((s) => s.topic);
}

export async function subscribe(userId: number, topic: TopicKey) {
    await prisma.subscription.upsert({
        where: { userId_topic: { userId, topic } },
        update: {},
        create: { userId, topic},
    });
}

export async function toggleTopic(userId: number, topic: TopicKey): Promise<boolean> {
    const existing = await prisma.subscription.findUnique({
        where: { userId_topic: { userId, topic } },
    });

    if(existing) {
        await prisma.subscription.delete({ where: { id: existing.id}});
        return false;
    }
    await prisma.subscription.create({data: { userId, topic}});
    return true;
}