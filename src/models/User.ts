import mongoose, { Schema } from "mongoose";

export interface IUser {
  _id: string;
  username: string;
  email: string;
  password?: string;
  avatarUrl: string;
  status: "online" | "idle" | "dnd" | "offline";
  customStatus: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarUrl: { type: String, default: "" },
  status: { type: String, enum: ["online", "idle", "dnd", "offline"], default: "online" },
  customStatus: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
