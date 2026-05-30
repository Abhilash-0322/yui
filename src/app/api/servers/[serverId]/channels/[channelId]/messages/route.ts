import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Server from "@/models/Server";
import Message from "@/models/Message";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { serverId, channelId } = await params;
    
    await connectToDatabase();
    
    // Verify membership
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    const isMember = server.members.some(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    // Fetch last 100 messages
    const messages = await Message.find({
      serverId,
      channelId,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("userId", "username email avatarUrl status customStatus");
    
    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("Messages GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { serverId, channelId } = await params;
    const { content } = await req.json();
    
    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    // Verify membership
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    const isMember = server.members.some(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    const newMessage = await Message.create({
      serverId,
      channelId,
      userId: user._id,
      content,
    });
    
    const populatedMessage = await Message.findById(newMessage._id).populate(
      "userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ message: populatedMessage });
  } catch (error: any) {
    console.error("Messages POST Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { messageId, content } = await req.json();
    if (!messageId || !content) {
      return NextResponse.json({ error: "Message ID and content are required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    
    // Only the creator can edit their messages
    if (message.userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    message.content = content;
    message.updatedAt = new Date();
    await message.save();
    
    const populatedMessage = await Message.findById(message._id).populate(
      "userId",
      "username email avatarUrl status customStatus"
    );
    
    return NextResponse.json({ message: populatedMessage });
  } catch (error: any) {
    console.error("Messages PATCH Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ serverId: string; channelId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { serverId } = await params;
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    
    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
    }
    
    await connectToDatabase();
    
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    
    const server = await Server.findById(serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Verify permissions: Only the creator of the message, OR a server ADMIN / MODERATOR can delete messages
    const member = server.members.find(
      (m: any) => m.userId.toString() === user._id.toString()
    );
    
    const isOwner = message.userId.toString() === user._id.toString();
    const isAdminOrMod = member && (member.role === "ADMIN" || member.role === "MODERATOR");
    
    if (!isOwner && !isAdminOrMod && server.ownerId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    
    await Message.findByIdAndDelete(messageId);
    
    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error("Messages DELETE Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
