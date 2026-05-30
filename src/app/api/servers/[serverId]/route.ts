import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";

export async function GET(
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
    
    const server = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check if the user is a member of the server
    const isMember = server.members.some(
      (m: any) => m.userId && m.userId._id.toString() === user._id.toString()
    );
    
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    return NextResponse.json({ server });
  } catch (error: any) {
    console.error("Server GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const { name, imageUrl } = await req.json();
    
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
    
    if (name) server.name = name;
    if (imageUrl) server.imageUrl = imageUrl;
    
    await server.save();
    
    const populatedServer = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Server PATCH Error:", error);
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
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Only the owner can delete the server
    if (server.ownerId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Only server owners can delete servers" }, { status: 403 });
    }
    
    await Server.findByIdAndDelete(serverId);
    
    return NextResponse.json({ success: true, message: "Server deleted successfully" });
  } catch (error: any) {
    console.error("Server DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
