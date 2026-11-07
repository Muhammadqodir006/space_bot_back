import {Router} from "express";
import {prisma} from "../db/prisma";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ok: true, db: "up", time: new Date().toISOString()});
    }catch {
        res.status(503).json({ok: false, db: "down", });
    }
});