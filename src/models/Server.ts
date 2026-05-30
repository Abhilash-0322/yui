import mongoose, { Schema } from "mongoose";

export interface IChannel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE" | "VIDEO";
  category: string;
}

export interface IMember {
  userId: mongoose.Types.ObjectId | string;
  role: "ADMIN" | "MODERATOR" | "GUEST";
}

export interface IServer {
  _id: string;
  name: string;
  imageUrl: string;
  inviteCode: string;
  ownerId: mongoose.Types.ObjectId | string;
  members: IMember[];
  channels: IChannel[];
  createdAt: Date;
}

const ChannelSchema = new Schema<IChannel>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["TEXT", "VOICE", "VIDEO"], default: "TEXT" },
  category: { type: String, default: "TEXT CHANNELS" },
});

const MemberSchema = new Schema<IMember>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["ADMIN", "MODERATOR", "GUEST"], default: "GUEST" },
});

const ServerSchema = new Schema<IServer>({
  name: { type: String, required: true },
  imageUrl: { type: String, default: "" },
  inviteCode: { type: String, required: true, unique: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  members: [MemberSchema],
  channels: [ChannelSchema],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Server || mongoose.model<IServer>("Server", ServerSchema);
