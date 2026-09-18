"use client";

import { apiClient } from "@/lib/api";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthPanelProps = {
  initialMode: "login" | "register";
};

export function AuthPanel({ initialMode }: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "verify">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        const challenge = await apiClient.registerEmail({
          display_name: displayName,
          email,
          password,
        });
        setChallengeId(challenge.challenge_id);
        setMode("verify");
      } else if (mode === "verify") {
        const session = await apiClient.verifyEmail({
          challenge_id: challengeId,
          client_type: "customer_web",
          code,
          device_label: "Customer web",
        });
        if (session.csrf_token) {
          sessionStorage.setItem("forhire_csrf", session.csrf_token);
        }
        router.push("/account");
        router.refresh();
      } else {
        const session = await apiClient.loginEmail({
          client_type: "customer_web",
          device_label: "Customer web",
          email,
          password,
        });
        if (session.csrf_token) {
          sessionStorage.setItem("forhire_csrf", session.csrf_token);
        }
        router.push("/account");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  const heading = mode === "login"
    ? "Welcome back"
    : mode === "verify"
      ? "Check your inbox"
      : "Create your account";

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <p className="eyebrow">Private by default</p>
        <h1>{heading}</h1>
        <p>Rent and list useful items without exposing your phone number or email address.</p>
        <ul>
          <li><CheckCircle2 size={18} /> Owner approval for every booking</li>
          <li><CheckCircle2 size={18} /> Payment only at handover</li>
          <li><CheckCircle2 size={18} /> Private in-app communication</li>
        </ul>
      </section>

      <form className="auth-form" onSubmit={submit}>
        {mode !== "verify" && (
          <>
            {mode === "register" && (
              <label>
                <span>Display name</span>
                <input
                  required
                  minLength={2}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            )}
            <label>
              <span>Email</span>
              <div className="input-with-icon">
                <Mail aria-hidden="true" size={18} />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>
            <label>
              <span>Password</span>
              <div className="input-with-icon">
                <KeyRound aria-hidden="true" size={18} />
                <input
                  required
                  minLength={mode === "register" ? 10 : 1}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>
          </>
        )}
        {mode === "verify" && (
          <>
            <p className="form-note">
              Enter the six-digit code sent to {email}. Local codes are available in the{" "}
              <a href="http://127.0.0.1:18080" target="_blank" rel="noreferrer">
                development inbox
              </a>.
            </p>
            <label>
              <span>Verification code</span>
              <input
                required
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">
          {busy
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : "Verify and continue"}
        </button>
        {mode !== "verify" && (
          <p className="auth-switch">
            {mode === "login" ? "New to For Hire?" : "Already registered?"}{" "}
            <Link href={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
