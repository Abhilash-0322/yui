import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.cookies.set("token", "", {
        httpOnly: true,
        expires: new Date(0),
        path: "/",
      });
      return response;
    }
    
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Auth Me GET Error:", error);
    // If it's a DB connection error or other internal error, we return 500 but don't clear the cookie yet
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    await connectToDatabase();
    
    const body = await req.json();
    const { username, avatarUrl, status, customStatus } = body;
    
    const updateFields: any = {};
    if (username) updateFields.username = username;
    if (avatarUrl) updateFields.avatarUrl = avatarUrl;
    if (status) updateFields.status = status;
    if (customStatus !== undefined) updateFields.customStatus = customStatus;
    
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { new: true }
    ).select("-password");
    
    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error("Auth Me PATCH Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
