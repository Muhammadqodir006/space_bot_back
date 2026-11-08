import {Router} from "express";
import {z} from "zod";
import { searchByUzbekQuery } from "../services/imageLibraryService";

export const feedRouter = Router();

const querySchema = z.object({
    q: z.string().trim().min(1).max(80),
    page: z.coerce.number().int().min(1).max(50).default(1),
});

feedRouter.get("/feed", async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if(!parsed.success) {
        return res.status(400).json({error: "q (qidiruv so'zi) kerak"});
    }

    try {
        const {en, items} = await searchByUzbekQuery(parsed.data.q, parsed.data.page, 20);
        res.json({query: en, page: parsed.data.page, items});
    }catch(err) {
        console.error("Feed xatosi: ", err);
        res.status(502).json({error: "NASA arxivi hozir javob bermadi"});
    }
});