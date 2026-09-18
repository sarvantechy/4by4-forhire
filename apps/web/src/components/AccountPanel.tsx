"use client";

import type { SessionResponse, UserResponse } from "@4by4/api-client";
import { apiClient } from "@/lib/api";
import { LogOut, MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AccountPanel() {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([apiClient.getCurrentUser(), apiClient.listSessions()])
      .then(([profile, activeSessions]) => {
        if (active) {
          setUser(profile);
          setSessions(activeSessions);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load the account.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    const csrfToken = sessionStorage.getItem("forhire_csrf") ?? undefined;
    try {
      await apiClient.logout(csrfToken);
    } finally {
      sessionStorage.removeItem("forhire_csrf");
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading) {
    return <div className="account-loading">Loading your private account...</div>;
  }

  if (!user) {
    return (
      <div className="empty-inventory">
        <UserRound aria-hidden="true" size={28} />
        <div>
          <h3>Sign in to manage your account</h3>
          <p>{error || "Profiles, addresses, sessions, and seller headers stay private."}</p>
        </div>
        <Link className="secondary-action" href="/login">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="account-grid">
      <section className="account-profile">
        <div className="profile-mark"><UserRound aria-hidden="true" size={30} /></div>
        <div>
          <p className="eyebrow">Signed in securely</p>
          <h2>{user.display_name}</h2>
          <p>Status: {user.status} · Language: {user.preferred_language.toUpperCase()}</p>
        </div>
        <button className="secondary-action" onClick={signOut} type="button">
          <LogOut aria-hidden="true" size={17} /> Sign out
        </button>
      </section>
      <section className="account-sessions" aria-labelledby="sessions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Security</p>
            <h2 id="sessions-heading">Active sessions</h2>
          </div>
          <ShieldCheck aria-hidden="true" size={25} />
        </div>
        <div className="session-list">
          {sessions.map((session) => (
            <article key={session.id}>
              <MonitorSmartphone aria-hidden="true" size={21} />
              <div>
                <strong>{session.device_label || session.client_type}</strong>
                <small>{session.revoked ? "Revoked" : `Expires ${new Date(session.expires_at).toLocaleDateString("en-IN")}`}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}