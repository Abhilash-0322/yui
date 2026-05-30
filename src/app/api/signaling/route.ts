import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import mongoose from "mongoose";

function getModel() {
  if (mongoose.models.SignalMsg) {
    return mongoose.models.SignalMsg;
  }
  const schema = new mongoose.Schema(
    {
      channelId: { type: String, required: true, index: true },
      to: { type: String, default: null },
      from: { type: String, required: true },
      payload: { type: mongoose.Schema.Types.Mixed, required: true },
      createdAt: { type: Date, default: Date.now, expires: 30 }, // TTL 30s auto-delete
    },
    { timestamps: false }
  );
  return mongoose.model("SignalMsg", schema);
}

// POST /api/signaling — send a signaling message
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const Model = getModel();
    const body = await req.json();
    const { channelId, from, to, payload } = body;
    if (!channelId || !from || !payload) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    await Model.create({ channelId, from, to: to ?? null, payload });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/signaling?channelId=X&userId=Y&since=timestamp — poll for messages
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const Model = getModel();
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");
    const userId = searchParams.get("userId");
    const since = searchParams.get("since");

    if (!channelId || !userId) {
      return NextResponse.json({ error: "Missing channelId or userId" }, { status: 400 });
    }

    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 30000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      channelId: channelId,
      from: { $ne: userId },
      $or: [{ to: userId }, { to: null }],
      createdAt: { $gt: sinceDate },
    };

    const msgs = await Model.find(query)
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    return NextResponse.json({ messages: msgs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
