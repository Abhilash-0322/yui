import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";

function generateChannelId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 6);
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
    const { name, type, category } = await req.json();
    
    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check permissions
    const member = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR" && server.ownerId.toString() !== user._id.toString())) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    const newChannel = {
      id: generateChannelId(name),
      name: type === "TEXT" ? name.toLowerCase().replace(/\s+/g, "-") : name,
      type,
      category: category || (type === "TEXT" ? "TEXT CHANNELS" : "VOICE CHANNELS"),
    };
    
    server.channels.push(newChannel);
    await server.save();
    
    const populatedServer = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer, channel: newChannel });
  } catch (error: any) {
    console.error("Channels POST Error:", error);
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
    const { channelId, name, type, category } = await req.json();
    
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check permissions
    const member = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR" && server.ownerId.toString() !== user._id.toString())) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    const channel = server.channels.find((c: any) => c.id === channelId);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    
    if (name) {
      channel.name = type === "TEXT" || channel.type === "TEXT" ? name.toLowerCase().replace(/\s+/g, "-") : name;
    }
    if (type) channel.type = type;
    if (category) channel.category = category;
    
    await server.save();
    
    const populatedServer = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Channels PATCH Error:", error);
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
    const channelId = searchParams.get("channelId");
    
    if (!channelId) {
      return NextResponse.json({ error: "Channel ID is required" }, { status: 400 });
    }
    
    if (channelId === "general") {
      return NextResponse.json({ error: "Cannot delete the general channel" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Check permissions
    const member = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR" && server.ownerId.toString() !== user._id.toString())) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    server.channels = server.channels.filter((c: any) => c.id !== channelId);
    await server.save();
    
    const populatedServer = await Server.findById(serverId).populate(
      "members.userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ server: populatedServer });
  } catch (error: any) {
    console.error("Channels DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
