import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    await connectToDatabase();
    
    // Find all servers in the database
    const allServers = await Server.find({});
    
    // Auto-join the user if they are not already a member
    for (const server of allServers) {
      const isMember = server.members.some(
        (m: any) => m.userId && m.userId.toString() === user._id.toString()
      );
      if (!isMember) {
        server.members.push({ userId: user._id, role: "GUEST" });
        await server.save();
      }
    }
    
    // Fetch fully populated servers
    const servers = await Server.find({}).populate("members.userId", "username email avatarUrl status customStatus");
    
    return NextResponse.json({ servers });
  } catch (error: any) {
    console.error("Servers GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    await connectToDatabase();
    
    const { name, imageUrl } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Server name is required" }, { status: 400 });
    }
    
    const defaultChannels = [
      { id: "general", name: "general", type: "TEXT", category: "TEXT CHANNELS" },
      { id: "voice-general", name: "General Voice", type: "VOICE", category: "VOICE CHANNELS" },
      { id: "video-general", name: "General Video", type: "VIDEO", category: "VOICE CHANNELS" },
    ];
    
    const inviteCode = generateInviteCode();
    
    const newServer = await Server.create({
      name,
      imageUrl: imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      inviteCode,
      ownerId: user._id,
      members: [{ userId: user._id, role: "ADMIN" }],
      channels: defaultChannels,
    });
    
    // Fetch populated server to return
    const populatedServer = await Server.findById(newServer._id).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Servers POST Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
