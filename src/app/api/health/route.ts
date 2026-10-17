import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json({
    status: "ok",
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    aiEnabled: process.env.AI_DISABLED !== "true",
  });
}
