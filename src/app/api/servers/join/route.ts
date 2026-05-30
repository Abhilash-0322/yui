import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { inviteCode } = await req.json();
    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const server = await Server.findOne({ inviteCode });
    if (!server) {
      return NextResponse.json({ error: "Invalid invite code or server not found" }, { status: 404 });
    }
    
    // Check if the user is already a member
    const isMember = server.members.some(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    
    if (isMember) {
      return NextResponse.json({ server, message: "Already a member" });
    }
    
    // Add user as GUEST
    server.members.push({
      userId: user._id,
      role: "GUEST",
    });
    
    await server.save();
    
    const populatedServer = await Server.findById(server._id).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Join Server Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
