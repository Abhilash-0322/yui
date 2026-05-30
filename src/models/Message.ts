import mongoose, { Schema } from "mongoose";

export interface IMessage {
  _id: string;
  serverId: mongoose.Types.ObjectId | string;
  channelId: string;
  userId: mongoose.Types.ObjectId | string;
  content: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  serverId: { type: Schema.Types.ObjectId, ref: "Server", required: true },
  channelId: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
