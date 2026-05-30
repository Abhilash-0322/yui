"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./invite.module.css";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const code = params.code as string;

  useEffect(() => {
    const joinServer = async () => {
      if (authLoading) return;
      
      // If user is not logged in, redirect them to login with a back redirect parameter
      if (!user) {
        router.push(`/login?redirect=/invite/${code}`);
        return;
      }

      try {
        const res = await fetch("/api/servers/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: code.toUpperCase() }),
        });
        
        const data = await res.json();
        
        if (res.ok && data.server) {
          router.push(`/channels/${data.server._id}/general`);
        } else {
          setError(data.error || "This invite link is invalid or has expired.");
          setLoading(false);
        }
      } catch (err) {
        setError("An error occurred while trying to join the server.");
        setLoading(false);
      }
    };

    joinServer();
  }, [user, authLoading, code, router]);

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <svg className={styles.logo} width="80" height="80" viewBox="0 0 127.14 96.36" fill="currentColor">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c2.06-1.5,4.07-3.12,6-4.82a75.14,75.14,0,0,0,86,0c1.9,1.7,3.91,3.32,6,4.82a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,111.42,96.36a105.73,105.73,0,0,0,31-18.83C145.47,54.65,139.95,31.58,107.7,8.07Z" />
        </svg>

        {loading ? (
          <>
            <h2 className={styles.title}>Accepting Server Invite...</h2>
            <p className={styles.subtitle}>Please wait while we add you to the server.</p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Invite Link Invalid</h2>
            <p className={styles.subtitle} style={{ color: "var(--accent-red)" }}>{error}</p>
            <button className={styles.button} onClick={() => router.push("/channels/@me")}>
              Go to Home Screen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
