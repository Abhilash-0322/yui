"use client";

import React, { useState, useEffect } from "react";
import { useServer } from "@/context/ServerContext";
import { useAuth } from "@/context/AuthContext";
import { X, Copy, RefreshCw, Trash2, Shield, UserMinus } from "lucide-react";

export default function Modals() {
  const { user, updateProfile, logout } = useAuth();
  const {
    activeServer,
    activeModal,
    modalTargetChannel,
    setActiveModal,
    createServer,
    editServer,
    deleteServer,
    createChannel,
    editChannel,
    deleteChannel,
    updateMemberRole,
    kickMember,
    fetchServers,
  } = useServer();

  // Common UI State
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [channelType, setChannelType] = useState<"TEXT" | "VOICE" | "VIDEO">("TEXT");
  const [channelCategory, setChannelCategory] = useState("");
  
  // Invite state
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  // User Settings state
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [status, setStatus] = useState<"online" | "idle" | "dnd" | "offline">("online");
  const [customStatus, setCustomStatus] = useState("");

  // Error/Loading states
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync inputs with modal targets
  useEffect(() => {
    setError(null);
    if (activeModal === "createServer") {
      setName("");
      setImageUrl("");
    } else if (activeModal === "editServer" && activeServer) {
      setName(activeServer.name);
      setImageUrl(activeServer.imageUrl);
    } else if (activeModal === "createChannel") {
      setName("");
      setChannelType("TEXT");
      setChannelCategory("TEXT CHANNELS");
    } else if (activeModal === "editChannel" && modalTargetChannel) {
      setName(modalTargetChannel.name);
      setChannelType(modalTargetChannel.type);
      setChannelCategory(modalTargetChannel.category);
    } else if (activeModal === "invite" && activeServer) {
      setInviteCode(activeServer.inviteCode);
      setCopied(false);
    } else if (activeModal === "userSettings" && user) {
      setUsername(user.username);
      setAvatarUrl(user.avatarUrl);
      setStatus(user.status);
      setCustomStatus(user.customStatus);
    }
  }, [activeModal, activeServer, modalTargetChannel, user]);

  if (!activeModal) return null;

  const handleClose = () => {
    if (loading) return;
    setActiveModal(null);
    setError(null);
  };

  // Submit operations
  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Server name is required");
    setLoading(true);
    const res = await createServer(name, imageUrl);
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to create server");
  };

  const handleEditServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Server name is required");
    setLoading(true);
    const res = await editServer(name, imageUrl);
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to update server");
  };

  const handleDeleteServer = async () => {
    if (!confirm("Are you absolutely sure you want to delete this server? This action cannot be undone.")) return;
    setLoading(true);
    const res = await deleteServer();
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to delete server");
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Channel name is required");
    setLoading(true);
    const res = await createChannel(name, channelType, channelCategory);
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to create channel");
  };

  const handleEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTargetChannel) return;
    if (!name.trim()) return setError("Channel name is required");
    setLoading(true);
    const res = await editChannel(modalTargetChannel.id, name, channelType, channelCategory);
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to edit channel");
  };

  const handleDeleteChannel = async () => {
    if (!modalTargetChannel) return;
    if (!confirm(`Are you sure you want to delete #${modalTargetChannel.name}?`)) return;
    setLoading(true);
    const res = await deleteChannel(modalTargetChannel.id);
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to delete channel");
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateInvite = async () => {
    if (!activeServer) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${activeServer._id}/invite`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setInviteCode(data.inviteCode);
        fetchServers(); // Refresh list to sync code
      } else {
        setError("Failed to regenerate link");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return setError("Username is required");
    setLoading(true);
    const res = await updateProfile({ username, avatarUrl, status, customStatus });
    setLoading(false);
    if (res.success) handleClose();
    else setError(res.error || "Failed to update profile");
  };

  const handleMemberRoleUpdate = async (memberId: string, role: "ADMIN" | "MODERATOR" | "GUEST") => {
    if (!activeServer) return;
    setLoading(true);
    const res = await updateMemberRole(activeServer._id, memberId, role);
    setLoading(false);
    if (!res.success) setError(res.error || "Failed to update member role");
  };

  const handleMemberKick = async (memberId: string) => {
    if (!activeServer) return;
    if (!confirm("Are you sure you want to kick this member?")) return;
    setLoading(true);
    const res = await kickMember(activeServer._id, memberId);
    setLoading(false);
    if (!res.success) setError(res.error || "Failed to kick member");
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "24px", gap: "16px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--header-primary)" }}>
            {activeModal === "createServer" && "Create a Server"}
            {activeModal === "editServer" && "Server Settings"}
            {activeModal === "createChannel" && "Create Channel"}
            {activeModal === "editChannel" && "Channel Settings"}
            {activeModal === "invite" && "Invite Friends"}
            {activeModal === "userSettings" && "User Settings"}
            {activeModal === "members" && "Manage Members"}
          </h2>
          <button onClick={handleClose} style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ color: "var(--accent-red)", background: "rgba(242, 63, 67, 0.1)", padding: "8px", borderRadius: "4px", fontSize: "14px", border: "1px solid rgba(242, 63, 67, 0.2)" }}>
            {error}
          </div>
        )}

        {/* Modal-specific forms */}

        {/* 1. Create Server */}
        {activeModal === "createServer" && (
          <form onSubmit={handleCreateServer} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Your server is where you and your friends hang out. Make yours and start talking.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Server Name</label>
              <input
                type="text"
                placeholder="My Awesome Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Icon Image URL (Optional)</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ background: "var(--accent-blurple)", color: "white", padding: "12px", borderRadius: "4px", fontWeight: "600", marginTop: "8px" }}>
              {loading ? "Creating..." : "Create Server"}
            </button>
          </form>
        )}

        {/* 2. Edit Server */}
        {activeModal === "editServer" && (
          <form onSubmit={handleEditServer} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Server Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Icon Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
              <button type="submit" disabled={loading} style={{ background: "var(--accent-blurple)", color: "white", padding: "12px", borderRadius: "4px", fontWeight: "600" }}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
              {activeServer?.ownerId === user?._id && (
                <button type="button" onClick={handleDeleteServer} disabled={loading} style={{ background: "none", border: "1px solid var(--accent-red)", color: "var(--accent-red)", padding: "10px", borderRadius: "4px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Trash2 size={16} /> Delete Server
                </button>
              )}
            </div>
          </form>
        )}

        {/* 3. Create Channel */}
        {activeModal === "createChannel" && (
          <form onSubmit={handleCreateChannel} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Channel Type</label>
              <select
                value={channelType}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setChannelType(val);
                  setChannelCategory(val === "TEXT" ? "TEXT CHANNELS" : "VOICE CHANNELS");
                }}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
              >
                <option value="TEXT">Text (# Chat)</option>
                <option value="VOICE">Voice (🔊 Speaking)</option>
                <option value="VIDEO">Video (📹 Screen share & Camera)</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Channel Name</label>
              <input
                type="text"
                placeholder={channelType === "TEXT" ? "new-channel" : "New Channel"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Category (Optional)</label>
              <input
                type="text"
                value={channelCategory}
                onChange={(e) => setChannelCategory(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ background: "var(--accent-blurple)", color: "white", padding: "12px", borderRadius: "4px", fontWeight: "600", marginTop: "8px" }}>
              {loading ? "Creating..." : "Create Channel"}
            </button>
          </form>
        )}

        {/* 4. Edit Channel */}
        {activeModal === "editChannel" && (
          <form onSubmit={handleEditChannel} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Channel Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Category</label>
              <input
                type="text"
                value={channelCategory}
                onChange={(e) => setChannelCategory(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
              <button type="submit" disabled={loading} style={{ background: "var(--accent-blurple)", color: "white", padding: "12px", borderRadius: "4px", fontWeight: "600" }}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
              {modalTargetChannel?.id !== "general" && (
                <button type="button" onClick={handleDeleteChannel} disabled={loading} style={{ background: "none", border: "1px solid var(--accent-red)", color: "var(--accent-red)", padding: "10px", borderRadius: "4px", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Trash2 size={16} /> Delete Channel
                </button>
              )}
            </div>
          </form>
        )}

        {/* 5. Invite Modal */}
        {activeModal === "invite" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Share this link with others to grant them instant access to your server!
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/invite/${inviteCode}`}
                style={{ flex: 1, background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "14px", border: "1px solid rgba(0,0,0,0.2)", color: "var(--header-primary)" }}
              />
              <button onClick={copyInviteLink} style={{ background: copied ? "var(--accent-green)" : "var(--accent-blurple)", color: "white", padding: "10px 16px", borderRadius: "4px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.15s ease", minWidth: "90px", justifyContent: "center" }}>
                {copied ? "Copied!" : <><Copy size={16} /> Copy</>}
              </button>
            </div>
            <button onClick={regenerateInvite} disabled={loading} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-link)", alignSelf: "flex-start", fontSize: "14px" }}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Regenerate Link
            </button>
          </div>
        )}

        {/* 6. User Settings */}
        {activeModal === "userSettings" && (
          <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
                required
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Avatar URL</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }}
              >
                <option value="online">🟢 Online</option>
                <option value="idle">🌙 Idle</option>
                <option value="dnd">🔴 Do Not Disturb</option>
                <option value="offline">⚪ Invisible</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Custom Status Info</label>
              <input
                type="text"
                placeholder="What's on your mind?"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                style={{ background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "4px", fontSize: "15px", border: "1px solid rgba(0,0,0,0.2)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
              <button type="submit" disabled={loading} style={{ background: "var(--accent-blurple)", color: "white", padding: "12px", borderRadius: "4px", fontWeight: "600" }}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={logout} style={{ background: "var(--accent-red)", color: "white", padding: "12px", borderRadius: "4px", fontWeight: "600" }}>
                Log Out
              </button>
            </div>
          </form>
        )}

        {/* 7. Manage Server Members */}
        {activeModal === "members" && activeServer && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "400px", overflowY: "auto" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Change user roles or kick members from this server. Only Server Admins/Owners have access.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeServer.members.map((m) => {
                if (!m.userId) return null;
                const isOwner = activeServer.ownerId === m.userId._id;
                const isSelf = m.userId._id === user?._id;
                return (
                  <div key={m.userId._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary-alt)", padding: "10px", borderRadius: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img src={m.userId.avatarUrl} alt="Avatar" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--header-primary)" }}>
                          {m.userId.username} {isOwner && "👑"} {isSelf && "(You)"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.userId.email}</span>
                      </div>
                    </div>

                    {!isOwner && !isSelf && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <select
                          value={m.role}
                          onChange={(e) => handleMemberRoleUpdate(m.userId._id, e.target.value as any)}
                          style={{ background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", border: "1px solid rgba(0,0,0,0.1)" }}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MODERATOR">Moderator</option>
                          <option value="GUEST">Guest</option>
                        </select>
                        <button onClick={() => handleMemberKick(m.userId._id)} style={{ color: "var(--accent-red)", padding: "4px" }} title="Kick Member">
                          <UserMinus size={16} />
                        </button>
                      </div>
                    )}
                    {isOwner && <span style={{ fontSize: "12px", color: "#f0b232", fontWeight: "600", marginRight: "8px" }}><Shield size={14} style={{ verticalAlign: "middle", marginRight: "4px" }} /> Owner</span>}
                    {isSelf && !isOwner && <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", marginRight: "8px" }}>{m.role}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
