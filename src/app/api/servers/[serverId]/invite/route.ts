import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { serverId } = await params;
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check if user is admin or owner
    const member = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    
    if (!member || (member.role !== "ADMIN" && server.ownerId.toString() !== user._id.toString())) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    server.inviteCode = generateInviteCode();
    await server.save();
    
    return NextResponse.json({ inviteCode: server.inviteCode });
  } catch (error: any) {
    console.error("Invite POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
