import {PrismaClient} from "@prisma/client";

export const prisma = new PrismaClient();

export async function connectDb() {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("PostgreSQL ulandi");
}

export async function disconnectDb() {
    await prisma.$disconnect();
}