"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

export interface ChannelType {
  id: string;
  name: string;
  type: "TEXT" | "VOICE" | "VIDEO";
  category: string;
}

export interface MemberType {
  userId: {
    _id: string;
    username: string;
    email: string;
    avatarUrl: string;
    status: "online" | "idle" | "dnd" | "offline";
    customStatus: string;
  };
  role: "ADMIN" | "MODERATOR" | "GUEST";
}

export interface ServerType {
  _id: string;
  name: string;
  imageUrl: string;
  inviteCode: string;
  ownerId: string;
  members: MemberType[];
  channels: ChannelType[];
  createdAt: string;
}

export interface MessageType {
  _id: string;
  serverId: string;
  channelId: string;
  userId: {
    _id: string;
    username: string;
    avatarUrl: string;
    status: "online" | "idle" | "dnd" | "offline";
  };
  content: string;
  deleted: boolean;
  createdAt: string;
}

interface ServerContextType {
  servers: ServerType[];
  activeServer: ServerType | null;
  activeChannel: ChannelType | null;
  messages: MessageType[];
  activeVoiceChannel: string | null;
  
  // Voice states
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  voiceParticipants: { username: string; avatarUrl: string; speaking: boolean; video: boolean }[];
  
  // Modals state
  activeModal: "createServer" | "editServer" | "createChannel" | "editChannel" | "invite" | "userSettings" | "members" | null;
  modalTargetChannel: ChannelType | null;
  
  // Actions
  setActiveModal: (modal: "createServer" | "editServer" | "createChannel" | "editChannel" | "invite" | "userSettings" | "members" | null) => void;
  setModalTargetChannel: (channel: ChannelType | null) => void;
  selectServer: (serverId: string) => void;
  selectChannel: (channelId: string) => void;
  
  fetchServers: () => Promise<void>;
  createServer: (name: string, imageUrl?: string) => Promise<{ success: boolean; error?: string }>;
  editServer: (name: string, imageUrl?: string) => Promise<{ success: boolean; error?: string }>;
  deleteServer: () => Promise<{ success: boolean; error?: string }>;
  
  joinServerByInvite: (inviteCode: string) => Promise<{ success: boolean; serverId?: string; error?: string }>;
  leaveServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  kickMember: (serverId: string, memberUserId: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (serverId: string, memberUserId: string, role: "ADMIN" | "MODERATOR" | "GUEST") => Promise<{ success: boolean; error?: string }>;
  
  createChannel: (name: string, type: "TEXT" | "VOICE" | "VIDEO", category?: string) => Promise<{ success: boolean; error?: string }>;
  editChannel: (channelId: string, name: string, type: "TEXT" | "VOICE" | "VIDEO", category?: string) => Promise<{ success: boolean; error?: string }>;
  deleteChannel: (channelId: string) => Promise<{ success: boolean; error?: string }>;
  
  sendMessage: (content: string) => Promise<{ success: boolean; error?: string }>;
  editMessage: (messageId: string, content: string) => Promise<{ success: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Voice controls
  joinVoiceChannel: (channelId: string) => void;
  leaveVoiceChannel: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [activeServer, setActiveServer] = useState<ServerType | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<string | null>(null);
  
  // Voice / Video states
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<{ username: string; avatarUrl: string; speaking: boolean; video: boolean }[]>([]);
  
  // Modals state
  const [activeModal, setActiveModal] = useState<ServerContextType["activeModal"]>(null);
  const [modalTargetChannel, setModalTargetChannel] = useState<ChannelType | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch servers list
  const fetchServers = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers);
        
        // Sync active server if it was already selected
        if (activeServer) {
          const updatedActive = data.servers.find((s: ServerType) => s._id === activeServer._id);
          if (updatedActive) {
            setActiveServer(updatedActive);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching servers", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchServers();
    } else {
      setServers([]);
      setActiveServer(null);
      setActiveChannel(null);
      setMessages([]);
      setActiveVoiceChannel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Handle message polling
  useEffect(() => {
    if (activeServer && activeChannel && activeChannel.type === "TEXT") {
      // Immediate fetch
      const fetchMessages = async () => {
        try {
          const res = await fetch(`/api/servers/${activeServer._id}/channels/${activeChannel.id}/messages`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data.messages);
          }
        } catch (err) {
          console.error("Error fetching messages", err);
        }
      };
      
      fetchMessages();
      
      // Start polling
      pollingRef.current = setInterval(fetchMessages, 1500);
    } else {
      setMessages([]);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeServer, activeChannel]);

  // Simulated Voice / Video participants animation loop
  useEffect(() => {
    if (activeVoiceChannel && activeServer) {
      // Seed with some mock participants from server + self
      const otherMembers = activeServer.members
        .filter((m) => m.userId && m.userId._id !== user?._id)
        .slice(0, 4)
        .map((m) => ({
          username: m.userId.username,
          avatarUrl: m.userId.avatarUrl,
          speaking: false,
          video: Math.random() > 0.6,
        }));
      
      const selfParticipant = {
        username: user?.username || "You",
        avatarUrl: user?.avatarUrl || "",
        speaking: false,
        video: isCameraOn,
      };
      
      const participants = [selfParticipant, ...otherMembers];
      setVoiceParticipants(participants);
      
      // Periodic speaking status changes
      const speakInterval = setInterval(() => {
        setVoiceParticipants((prev) =>
          prev.map((p) => {
            if (p.username === user?.username) {
              return { ...p, speaking: !isMuted && Math.random() > 0.7, video: isCameraOn };
            }
            return { ...p, speaking: Math.random() > 0.8 };
          })
        );
      }, 2000);

      return () => {
        clearInterval(speakInterval);
      };
    } else {
      setVoiceParticipants([]);
    }
  }, [activeVoiceChannel, activeServer, user, isMuted, isCameraOn]);

  const selectServer = (serverId: string) => {
    const s = servers.find((serv) => serv._id === serverId);
    if (s) {
      setActiveServer(s);
      
      // Auto-select general or first text channel
      const generalChan = s.channels.find((c) => c.id === "general");
      if (generalChan) {
        setActiveChannel(generalChan);
      } else if (s.channels.length > 0) {
        setActiveChannel(s.channels[0]);
      } else {
        setActiveChannel(null);
      }
    }
  };

  const selectChannel = (channelId: string) => {
    if (activeServer) {
      const c = activeServer.channels.find((chan) => chan.id === channelId);
      if (c) {
        setActiveChannel(c);
      }
    }
  };

  const createServer = async (name: string, imageUrl?: string) => {
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, imageUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setServers((prev) => [...prev, data.server]);
        setActiveServer(data.server);
        
        // Select General channel
        const generalChan = data.server.channels.find((c: any) => c.id === "general");
        if (generalChan) setActiveChannel(generalChan);
        
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const editServer = async (name: string, imageUrl?: string) => {
    if (!activeServer) return { success: false, error: "No active server" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, imageUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveServer(data.server);
        setServers((prev) => prev.map((s) => (s._id === data.server._id ? data.server : s)));
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteServer = async () => {
    if (!activeServer) return { success: false, error: "No active server" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}`, { method: "DELETE" });
      if (res.ok) {
        const deletedId = activeServer._id;
        setActiveServer(null);
        setActiveChannel(null);
        setServers((prev) => prev.filter((s) => s._id !== deletedId));
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const joinServerByInvite = async (inviteCode: string) => {
    try {
      const res = await fetch("/api/servers/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();
      if (res.ok) {
        // Add to servers if not already there
        setServers((prev) => {
          if (prev.some((s) => s._id === data.server._id)) {
            return prev.map((s) => (s._id === data.server._id ? data.server : s));
          }
          return [...prev, data.server];
        });
        setActiveServer(data.server);
        
        // Select General
        const generalChan = data.server.channels.find((c: any) => c.id === "general");
        if (generalChan) setActiveChannel(generalChan);
        
        return { success: true, serverId: data.server._id };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const leaveServer = async (serverId: string) => {
    if (!user) return { success: false, error: "Unauthorized" };
    try {
      const res = await fetch(`/api/servers/${serverId}/members?memberUserId=${user._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeServer?._id === serverId) {
          setActiveServer(null);
          setActiveChannel(null);
        }
        setServers((prev) => prev.filter((s) => s._id !== serverId));
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const kickMember = async (serverId: string, memberUserId: string) => {
    try {
      const res = await fetch(`/api/servers/${serverId}/members?memberUserId=${memberUserId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        if (activeServer?._id === serverId) {
          setActiveServer(data.server);
        }
        setServers((prev) => prev.map((s) => (s._id === serverId ? data.server : s)));
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateMemberRole = async (serverId: string, memberUserId: string, role: "ADMIN" | "MODERATOR" | "GUEST") => {
    try {
      const res = await fetch(`/api/servers/${serverId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId, role }),
      });
      const data = await res.json();
      if (res.ok) {
        if (activeServer?._id === serverId) {
          setActiveServer(data.server);
        }
        setServers((prev) => prev.map((s) => (s._id === serverId ? data.server : s)));
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const createChannel = async (name: string, type: "TEXT" | "VOICE" | "VIDEO", category?: string) => {
    if (!activeServer) return { success: false, error: "No active server" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, category }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveServer(data.server);
        setServers((prev) => prev.map((s) => (s._id === data.server._id ? data.server : s)));
        if (data.channel) {
          setActiveChannel(data.channel);
        }
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const editChannel = async (channelId: string, name: string, type: "TEXT" | "VOICE" | "VIDEO", category?: string) => {
    if (!activeServer) return { success: false, error: "No active server" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/channels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, name, type, category }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveServer(data.server);
        setServers((prev) => prev.map((s) => (s._id === data.server._id ? data.server : s)));
        // Sync active channel
        const updatedChan = data.server.channels.find((c: any) => c.id === channelId);
        if (updatedChan) {
          setActiveChannel(updatedChan);
        }
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteChannel = async (channelId: string) => {
    if (!activeServer) return { success: false, error: "No active server" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/channels?channelId=${channelId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setActiveServer(data.server);
        setServers((prev) => prev.map((s) => (s._id === data.server._id ? data.server : s)));
        
        if (activeChannel?.id === channelId) {
          const generalChan = data.server.channels.find((c: any) => c.id === "general");
          if (generalChan) {
            setActiveChannel(generalChan);
          } else if (data.server.channels.length > 0) {
            setActiveChannel(data.server.channels[0]);
          } else {
            setActiveChannel(null);
          }
        }
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const sendMessage = async (content: string) => {
    if (!activeServer || !activeChannel) return { success: false, error: "No active conversation" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/channels/${activeChannel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, data.message]);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!activeServer || !activeChannel) return { success: false, error: "No active conversation" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/channels/${activeChannel.id}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m._id === messageId ? data.message : m)));
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeServer || !activeChannel) return { success: false, error: "No active conversation" };
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/channels/${activeChannel.id}/messages?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Voice controls
  const joinVoiceChannel = (channelId: string) => {
    setActiveVoiceChannel(channelId);
  };

  const leaveVoiceChannel = () => {
    setActiveVoiceChannel(null);
    setIsCameraOn(false);
    setIsScreenSharing(false);
  };

  const toggleMute = () => setIsMuted(!isMuted);
  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    if (!isDeafened) {
      setIsMuted(true);
    }
  };
  const toggleCamera = () => setIsCameraOn(!isCameraOn);
  const toggleScreenShare = () => setIsScreenSharing(!isScreenSharing);

  return (
    <ServerContext.Provider
      value={{
        servers,
        activeServer,
        activeChannel,
        messages,
        activeVoiceChannel,
        
        isMuted,
        isDeafened,
        isCameraOn,
        isScreenSharing,
        voiceParticipants,
        
        activeModal,
        modalTargetChannel,
        
        setActiveModal,
        setModalTargetChannel,
        selectServer,
        selectChannel,
        
        fetchServers,
        createServer,
        editServer,
        deleteServer,
        
        joinServerByInvite,
        leaveServer,
        kickMember,
        updateMemberRole,
        
        createChannel,
        editChannel,
        deleteChannel,
        
        sendMessage,
        editMessage,
        deleteMessage,
        
        joinVoiceChannel,
        leaveVoiceChannel,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        toggleScreenShare,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const context = useContext(ServerContext);
  if (context === undefined) {
    throw new Error("useServer must be used within a ServerProvider");
  }
  return context;
}
