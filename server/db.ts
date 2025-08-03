import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Use RENDER_DATABASE_URL if available, otherwise fall back to DATABASE_URL
const databaseUrl = process.env.RENDER_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or RENDER_DATABASE_URL environment variable is required");
}

console.log(`Connecting to database: ${databaseUrl.replace(/:[^:]*@/, ':***@')}`);
const sql = neon(databaseUrl);
export const db = drizzle(sql);