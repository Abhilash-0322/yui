"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import styles from "./login.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("All fields are required");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || "Invalid credentials");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* Left Form Column */}
        <div className={styles.formSection}>
          <h2 className={styles.title}>Welcome back!</h2>
          <p className={styles.subtitle}>We're so excited to see you again!</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Email or Phone Number<span className={styles.required}>*</span>
              </label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Password<span className={styles.required}>*</span>
              </label>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <Link href="#" className={styles.forgotLink}>
                Forgot your password?
              </Link>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log In"}
            </button>

            <div className={styles.footer}>
              Need an account?
              <Link href="/register" className={styles.registerLink}>
                Register
              </Link>
            </div>
          </form>
        </div>

        {/* Right QR Code Column */}
        <div className={styles.qrSection}>
          <div className={styles.qrContainer}>
            {/* Standard QR Code SVG representation */}
            <svg width="100%" height="100%" viewBox="0 0 100 100" fill="currentColor">
              <rect x="10" y="10" width="20" height="20" fill="#2b2d31" />
              <rect x="15" y="15" width="10" height="10" fill="white" />
              <rect x="70" y="10" width="20" height="20" fill="#2b2d31" />
              <rect x="75" y="15" width="10" height="10" fill="white" />
              <rect x="10" y="70" width="20" height="20" fill="#2b2d31" />
              <rect x="15" y="75" width="10" height="10" fill="white" />
              {/* Random block patterns */}
              <rect x="35" y="10" width="5" height="15" fill="#2b2d31" />
              <rect x="45" y="20" width="10" height="5" fill="#2b2d31" />
              <rect x="60" y="15" width="5" height="25" fill="#2b2d31" />
              <rect x="35" y="35" width="20" height="10" fill="#2b2d31" />
              <rect x="15" y="45" width="15" height="5" fill="#2b2d31" />
              <rect x="70" y="45" width="15" height="15" fill="#2b2d31" />
              <rect x="45" y="55" width="10" height="10" fill="#2b2d31" />
              <rect x="35" y="70" width="15" height="5" fill="#2b2d31" />
              <rect x="55" y="75" width="25" height="15" fill="#2b2d31" />
              <rect x="35" y="85" width="5" height="5" fill="#2b2d31" />
            </svg>
            <div className={styles.qrOverlayLogo}>
              <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="#5865f2">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c2.06-1.5,4.07-3.12,6-4.82a75.14,75.14,0,0,0,86,0c1.9,1.7,3.91,3.32,6,4.82a68.43,68.43,0,0,1-10.5,5A77.7,77.7,0,0,0,111.42,96.36a105.73,105.73,0,0,0,31-18.83C145.47,54.65,139.95,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
              </svg>
            </div>
          </div>
          <h3 className={styles.qrTitle}>Log In with QR Code</h3>
          <p className={styles.qrSubtitle}>
            Scan this with the <strong>Discord mobile app</strong> to log in instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
