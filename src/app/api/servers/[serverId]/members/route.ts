import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { serverId } = await params;
    const { memberUserId, role } = await req.json();
    
    if (!memberUserId || !role) {
      return NextResponse.json({ error: "Member User ID and role are required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check if the current user is owner or admin
    const currentUserMember = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    const isOwner = server.ownerId.toString() === user._id.toString();
    const isAdmin = currentUserMember && currentUserMember.role === "ADMIN";
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    // Cannot change the owner's role
    if (server.ownerId.toString() === memberUserId) {
      return NextResponse.json({ error: "Cannot change the server owner's role" }, { status: 400 });
    }
    
    const targetMember = server.members.find(
      (m: any) => m.userId.toString() === memberUserId
    );
    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    
    targetMember.role = role;
    await server.save();
    
    const populatedServer = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Members PATCH Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { serverId } = await params;
    const { searchParams } = new URL(req.url);
    const memberUserId = searchParams.get("memberUserId");
    
    if (!memberUserId) {
      return NextResponse.json({ error: "Member User ID is required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check if the current user is owner or admin
    const currentUserMember = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    const isOwner = server.ownerId.toString() === user._id.toString();
    const isAdmin = currentUserMember && currentUserMember.role === "ADMIN";
    
    // Users should be able to LEAVE the server themselves
    const isLeavingSelf = user._id.toString() === memberUserId;
    
    if (!isOwner && !isAdmin && !isLeavingSelf) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    // Owners cannot be kicked or leave without transferring ownership
    if (server.ownerId.toString() === memberUserId) {
      return NextResponse.json({ error: "Server owners cannot leave or be kicked" }, { status: 400 });
    }
    
    server.members = server.members.filter(
      (m: any) => m.userId.toString() !== memberUserId
    );
    
    await server.save();
    
    const populatedServer = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Members DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
