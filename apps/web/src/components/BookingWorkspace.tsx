"use client";

import type {
  BookingResponse,
  HandoverChallengeResponse,
  MessageResponse,
  UserResponse,
} from "@4by4/api-client";
import { apiClient } from "@/lib/api";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  PackageCheck,
  Send,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amountMinor / 100);
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BookingWorkspace() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [message, setMessage] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [challengeCode, setChallengeCode] = useState("");
  const [issuedChallenge, setIssuedChallenge] = useState<HandoverChallengeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = bookings.find((booking) => booking.id === selectedId) ?? bookings[0];
  const csrf = () => sessionStorage.getItem("forhire_csrf") ?? undefined;

  useEffect(() => {
    let active = true;
    Promise.all([apiClient.getCurrentUser(), apiClient.listBookings()])
      .then(([profile, items]) => {
        if (!active) return;
        setUser(profile);
        setBookings(items);
        setSelectedId(items[0]?.id ?? "");
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load bookings.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      return;
    }
    let active = true;
    apiClient.listMessages(selected.id)
      .then((items) => active && setMessages(items))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Unable to load messages."));
    return () => {
      active = false;
    };
  }, [selected?.id]);

  function replaceBooking(updated: BookingResponse) {
    setBookings((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: "accept" | "reject" | "cancel") {
    if (!selected) return;
    await run(async () => {
      replaceBooking(await apiClient.transitionBooking(selected.id, action, csrf()));
    }, `Booking ${action}ed.`);
  }

  async function issueChallenge(purpose: "handover" | "return") {
    if (!selected) return;
    await run(async () => {
      const challenge = await apiClient.createHandoverChallenge(selected.id, purpose, csrf());
      setIssuedChallenge(challenge);
      setChallengeId(challenge.challenge_id);
      setChallengeCode(challenge.code);
      replaceBooking(await apiClient.getBooking(selected.id));
    }, `${purpose === "handover" ? "Handover" : "Return"} code created.`);
  }

  async function confirmChallenge() {
    if (!selected) return;
    await run(async () => {
      replaceBooking(await apiClient.confirmHandoverChallenge(
        selected.id,
        { challenge_id: challengeId, code: challengeCode },
        csrf(),
      ));
    }, "Confirmation recorded.");
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !message.trim()) return;
    await run(async () => {
      const sent = await apiClient.sendMessage(
        selected.id,
        { body: message.trim(), client_message_id: crypto.randomUUID() },
        csrf(),
      );
      setMessages((current) => [...current, sent]);
      setMessage("");
    }, "Message sent.");
  }

  if (loading) return <div className="account-loading">Loading your bookings...</div>;
  if (!user) {
    return (
      <div className="empty-inventory">
        <CalendarClock aria-hidden="true" size={28} />
        <div><h3>Sign in to manage bookings</h3><p>{error || "Your rental requests and owner decisions are private."}</p></div>
        <Link className="secondary-action" href="/login">Sign in</Link>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="empty-inventory">
        <CalendarClock aria-hidden="true" size={28} />
        <div><h3>No bookings yet</h3><p>Choose an active listing and request dates to begin.</p></div>
        <Link className="secondary-action" href="/explore">Explore items</Link>
      </div>
    );
  }

  const isOwner = selected.owner_user_id === user.id;
  const isRenter = selected.renter_user_id === user.id;

  return (
    <div className="booking-workspace">
      <aside className="booking-list" aria-label="Your bookings">
        {bookings.map((booking) => (
          <button
            className={booking.id === selected.id ? "booking-row selected" : "booking-row"}
            key={booking.id}
            onClick={() => {
              setSelectedId(booking.id);
              setIssuedChallenge(null);
              setNotice("");
            }}
            type="button"
          >
            <span>{booking.public_number}</span>
            <strong>{booking.status.replaceAll("_", " ")}</strong>
            <small>{booking.owner_user_id === user.id ? "You are lending" : "You are renting"}</small>
          </button>
        ))}
      </aside>

      <section className="booking-detail">
        <header className="booking-summary">
          <div>
            <p className="eyebrow">{isOwner ? "Owner workflow" : "Renter workflow"}</p>
            <h2>{selected.public_number}</h2>
            <p>{dateTime(selected.starts_at)} to {dateTime(selected.ends_at)}</p>
          </div>
          <span className={`status status-${selected.status}`}>{selected.status.replaceAll("_", " ")}</span>
        </header>

        <div className="booking-facts">
          <span><small>Rental</small><strong>{money(selected.rental_charge_minor, selected.currency)}</strong></span>
          <span><small>Deposit at handover</small><strong>{money(selected.deposit_minor, selected.currency)}</strong></span>
          <span><small>Method</small><strong>{selected.fulfillment_method.replaceAll("_", " ")}</strong></span>
        </div>

        <div className="booking-actions" aria-label="Available booking actions">
          {isOwner && selected.status === "requested" && <>
            <button disabled={busy} onClick={() => transition("accept")} type="button"><CheckCircle2 size={17} /> Accept</button>
            <button className="danger-action" disabled={busy} onClick={() => transition("reject")} type="button">Reject</button>
          </>}
          {isRenter && ["requested", "accepted"].includes(selected.status) &&
            <button className="danger-action" disabled={busy} onClick={() => transition("cancel")} type="button">Cancel request</button>}
          {isOwner && selected.status === "accepted" && <>
            <button disabled={busy} onClick={() => run(async () => {
              await apiClient.scheduleFulfillment(selected.id, { scheduled_at: selected.starts_at }, csrf());
            }, "Pickup scheduled.")} type="button"><CalendarClock size={17} /> Schedule pickup</button>
            <button disabled={busy} onClick={() => issueChallenge("handover")} type="button"><KeyRound size={17} /> Create handover code</button>
          </>}
          {selected.status === "active" && <>
            <button disabled={busy} onClick={() => run(async () => {
              await apiClient.acknowledgePayment(selected.id, { disagreement: false }, csrf());
            }, "Offline payment acknowledgement recorded.")} type="button"><PackageCheck size={17} /> Confirm offline payment</button>
            {isRenter && <button disabled={busy} onClick={() => run(async () => {
              replaceBooking(await apiClient.initiateReturn(selected.id, csrf()));
            }, "Return initiated.")} type="button">Initiate return</button>}
          </>}
          {isOwner && selected.status === "return_pending" &&
            <button disabled={busy} onClick={() => issueChallenge("return")} type="button"><KeyRound size={17} /> Create return code</button>}
          {isOwner && selected.status === "inspection" &&
            <button disabled={busy} onClick={() => run(async () => {
              replaceBooking(await apiClient.acceptInspection(selected.id, csrf()));
            }, "Inspection accepted and booking completed.")} type="button"><CheckCircle2 size={17} /> Accept inspection</button>}
          {selected.status === "completed" &&
            <button disabled={busy} onClick={() => run(async () => {
              await apiClient.createReview(selected.id, { rating: 5, text: "Smooth rental experience." }, csrf());
            }, "Review submitted.")} type="button">Leave 5-star review</button>}
          <button disabled={busy} onClick={() => run(async () => {
            await apiClient.createReport({
              description: "Please review this listing and related booking activity.",
              reason: "Customer review requested",
              target_id: selected.listing_id,
              target_type: "listing",
            }, csrf());
          }, "Report submitted to operations.")} type="button"><AlertTriangle size={17} /> Report listing</button>
          {!['rejected', 'cancelled'].includes(selected.status) &&
            <button disabled={busy} onClick={() => run(async () => {
              await apiClient.createDispute(selected.id, {
                description: "A participant requested staff review of this booking.",
                type: "payment_disagreement",
              }, csrf());
              replaceBooking(await apiClient.getBooking(selected.id));
            }, "Dispute opened for staff review.")} type="button">Open dispute</button>}
        </div>

        {(["ready_for_handover", "return_pending"].includes(selected.status) || issuedChallenge) && (
          <section className="challenge-panel" aria-labelledby="challenge-heading">
            <div><p className="eyebrow">Dual confirmation</p><h3 id="challenge-heading">Enter the shared six-digit code</h3></div>
            {issuedChallenge && <p className="challenge-code">Code <strong>{issuedChallenge.code}</strong></p>}
            <div className="challenge-inputs">
              <input aria-label="Challenge ID" onChange={(event) => setChallengeId(event.target.value)} placeholder="Challenge ID" value={challengeId} />
              <input aria-label="Six-digit code" inputMode="numeric" maxLength={6} onChange={(event) => setChallengeCode(event.target.value)} placeholder="000000" value={challengeCode} />
              <button disabled={busy || !challengeId || challengeCode.length !== 6} onClick={confirmChallenge} type="button">Confirm</button>
            </div>
          </section>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}

        <section className="message-panel" aria-labelledby="messages-heading">
          <div><p className="eyebrow">Private conversation</p><h3 id="messages-heading"><MessageSquare size={19} /> Messages</h3></div>
          <div className="message-list">
            {messages.length === 0 ? <p>No messages yet.</p> : messages.map((item) => (
              <article className={item.sender_user_id === user.id ? "message mine" : "message"} key={item.id}>
                <p>{item.body}</p><small>{dateTime(item.created_at)}</small>
              </article>
            ))}
          </div>
          <form className="message-compose" onSubmit={sendMessage}>
            <input aria-label="Message" maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about pickup or item use" value={message} />
            <button aria-label="Send message" disabled={busy || !message.trim()} type="submit"><Send size={18} /></button>
          </form>
        </section>
      </section>
    </div>
  );
}
