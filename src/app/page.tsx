"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/channels/@me");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-tertiary)", flexDirection: "column", gap: "16px" }}>
      <svg width="80" height="80" viewBox="0 0 127.14 96.36" fill="var(--accent-blurple)">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c2.06-1.5,4.07-3.12,6-4.82a75.14,75.14,0,0,0,86,0c1.9,1.7,3.91,3.32,6,4.82a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,111.42,96.36a105.73,105.73,0,0,0,31-18.83C145.47,54.65,139.95,31.58,107.7,8.07Z" />
      </svg>
      <h2 style={{ color: "var(--header-primary)", fontWeight: "600", fontSize: "20px" }}>Redirecting to Discord...</h2>
    </div>
  );
}
