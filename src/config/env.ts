import "dotenv/config";
import {z} from "zod";

const schema = z.object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL kerak"),

    BOT_TOKEN: z.string().optional(),
    ADMIN_ID: z.string().default(""),

    NASA_API_KEY: z.string().default("DEMO_KEY"),

    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error(".env xato: ", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = {
    ...parsed.data,
    adminId: parsed.data.ADMIN_ID.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s)),
};