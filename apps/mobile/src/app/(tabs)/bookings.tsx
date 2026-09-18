import type { BookingResponse, MessageResponse, UserResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors } from '@/theme';

export default function BookingsScreen() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<UserResponse | null>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [message, setMessage] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeCode, setChallengeCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = bookings.find((item) => item.id === selectedId) ?? bookings[0];

  useEffect(() => {
    let active = true;
    getAccessToken()
      .then(async (accessToken) => {
        if (!accessToken) throw new Error('Sign in from Account to view bookings.');
        const [profile, items] = await Promise.all([
          apiClient.getCurrentUser(accessToken),
          apiClient.listBookings(accessToken),
        ]);
        if (!active) return;
        setToken(accessToken);
        setUser(profile);
        setBookings(items);
        setSelectedId(items[0]?.id ?? '');
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Unable to load bookings.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected?.id || !token) return;
    let active = true;
    apiClient.listMessages(selected.id, token)
      .then((items) => active && setMessages(items))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Unable to load messages.'));
    return () => {
      active = false;
    };
  }, [selected?.id, token]);

  function replaceBooking(updated: BookingResponse) {
    setBookings((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to complete this action.');
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: 'accept' | 'reject' | 'cancel') {
    if (!selected) return;
    await run(async () => {
      replaceBooking(await apiClient.transitionBooking(selected.id, action, undefined, token));
    }, `Booking ${action}ed.`);
  }

  async function issueChallenge(purpose: 'handover' | 'return') {
    if (!selected) return;
    await run(async () => {
      const challenge = await apiClient.createHandoverChallenge(
        selected.id,
        purpose,
        undefined,
        token,
      );
      setChallengeId(challenge.challenge_id);
      setChallengeCode(challenge.code);
      replaceBooking(await apiClient.getBooking(selected.id, token));
    }, `${purpose === 'handover' ? 'Handover' : 'Return'} code created.`);
  }

  async function confirmChallenge() {
    if (!selected) return;
    await run(async () => {
      replaceBooking(await apiClient.confirmHandoverChallenge(
        selected.id,
        { challenge_id: challengeId, code: challengeCode },
        undefined,
        token,
      ));
    }, 'Confirmation recorded.');
  }

  async function sendMessage() {
    if (!selected || !message.trim()) return;
    await run(async () => {
      const sent = await apiClient.sendMessage(
        selected.id,
        { body: message.trim(), client_message_id: randomUUID() },
        undefined,
        token,
      );
      setMessages((current) => [...current, sent]);
      setMessage('');
    }, 'Message sent.');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.teal} size="large" style={styles.loading} />
      </SafeAreaView>
    );
  }

  if (!selected || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={34} color={colors.teal} />
          <Text style={styles.emptyTitle}>No bookings to show</Text>
          <Text style={styles.emptyMessage}>
            {error || 'Request dates from an active listing to begin.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = selected.owner_user_id === user.id;
  const isRenter = selected.renter_user_id === user.id;
  const conditionPhase = ['active', 'return_pending', 'inspection', 'overdue'].includes(
    selected.status,
  ) ? 'return' : 'handover';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Renting and lending</Text>
        <Text accessibilityRole="header" style={styles.title}>Bookings</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookingTabs}>
          {bookings.map((booking) => (
            <Pressable
              key={booking.id}
              onPress={() => {
                setSelectedId(booking.id);
                setNotice('');
              }}
              style={[styles.bookingTab, booking.id === selected.id && styles.bookingTabActive]}
            >
              <Text style={styles.bookingNumber}>{booking.public_number}</Text>
              <Text style={styles.bookingRole}>{booking.owner_user_id === user.id ? 'Lending' : 'Renting'}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryRole}>{isOwner ? 'Owner workflow' : 'Renter workflow'}</Text>
            <Text style={styles.summaryNumber}>{selected.public_number}</Text>
          </View>
          <Text style={styles.status}>{selected.status.replaceAll('_', ' ')}</Text>
          <Text style={styles.amount}>Rs. {Math.round(selected.rental_charge_minor / 100).toLocaleString('en-IN')}</Text>
          <Text style={styles.meta}>Deposit at handover: Rs. {Math.round(selected.deposit_minor / 100).toLocaleString('en-IN')}</Text>
        </View>

        <View style={styles.actions}>
          {isOwner && selected.status === 'requested' && <>
            <Action label="Accept request" onPress={() => transition('accept')} />
            <Action danger label="Reject" onPress={() => transition('reject')} />
          </>}
          {isRenter && ['requested', 'accepted'].includes(selected.status) && <Action danger label="Cancel request" onPress={() => transition('cancel')} />}
          {isOwner && selected.status === 'accepted' && <Action label="Create handover code" onPress={() => issueChallenge('handover')} />}
          {selected.status === 'active' && <>
            <Action label="Confirm offline payment" onPress={() => run(async () => {
              await apiClient.acknowledgePayment(selected.id, { disagreement: false }, undefined, token);
            }, 'Offline payment acknowledgement recorded.')} />
            {isRenter && <Action label="Initiate return" onPress={() => run(async () => {
              replaceBooking(await apiClient.initiateReturn(selected.id, undefined, token));
            }, 'Return initiated.')} />}
          </>}
          {isOwner && selected.status === 'return_pending' && <Action label="Create return code" onPress={() => issueChallenge('return')} />}
          {isOwner && selected.status === 'inspection' && <Action label="Accept inspection" onPress={() => run(async () => {
            replaceBooking(await apiClient.acceptInspection(selected.id, undefined, token));
          }, 'Booking completed.')} />}
          {['accepted', 'ready_for_handover', 'active', 'return_pending', 'inspection'].includes(selected.status) &&
            <Action label={`Record ${conditionPhase} condition`} onPress={() => run(async () => {
              await apiClient.addConditionReport(selected.id, {
                checklist: { condition_confirmed: true },
                notes: 'Condition confirmed in the mobile handover workflow.',
                phase: conditionPhase,
              }, undefined, token);
            }, 'Condition report recorded.')} />}
          {selected.status === 'completed' && <Action label="Leave 5-star review" onPress={() => run(async () => {
            await apiClient.createReview(selected.id, { rating: 5, text: 'Smooth rental experience.' }, undefined, token);
          }, 'Review submitted.')} />}
          <Action label="Report listing" onPress={() => run(async () => {
            await apiClient.createReport({
              description: 'Please review this listing and related booking activity.',
              reason: 'Customer review requested',
              target_id: selected.listing_id,
              target_type: 'listing',
            }, undefined, token);
          }, 'Report submitted.')} />
        </View>

        {['ready_for_handover', 'return_pending'].includes(selected.status) ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Dual confirmation</Text>
            <TextInput onChangeText={setChallengeId} placeholder="Challenge ID" placeholderTextColor={colors.muted} style={styles.input} value={challengeId} />
            <TextInput keyboardType="number-pad" maxLength={6} onChangeText={setChallengeCode} placeholder="Six-digit code" placeholderTextColor={colors.muted} style={styles.input} value={challengeCode} />
            <Pressable disabled={busy || !challengeId || challengeCode.length !== 6} onPress={confirmChallenge} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Confirm code</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Private messages</Text>
          {messages.length === 0 ? <Text style={styles.meta}>No messages yet.</Text> : messages.map((item) => (
            <View key={item.id} style={[styles.message, item.sender_user_id === user.id && styles.messageMine]}>
              <Text style={styles.messageText}>{item.body}</Text>
            </View>
          ))}
          <View style={styles.compose}>
            <TextInput onChangeText={setMessage} placeholder="Ask about pickup or item use" placeholderTextColor={colors.muted} style={[styles.input, styles.composeInput]} value={message} />
            <Pressable accessibilityLabel="Send message" disabled={busy || !message.trim()} onPress={sendMessage} style={styles.sendButton}>
              <Ionicons name="send" size={18} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  danger = false,
  label,
  onPress,
}: {
  danger?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.action, danger && styles.actionDanger]}>
      <Text style={[styles.actionText, danger && styles.actionDangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 80 },
  loading: { marginTop: 80 },
  eyebrow: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4 },
  bookingTabs: { gap: 8, paddingVertical: 18 },
  bookingTab: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    minWidth: 145,
    padding: 12,
  },
  bookingTabActive: { borderColor: colors.teal, borderLeftWidth: 4 },
  bookingNumber: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  bookingRole: { color: colors.muted, fontSize: 11, marginTop: 3 },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  summaryRole: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  summaryNumber: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 3 },
  status: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F6F3',
    color: colors.teal,
    fontSize: 11,
    fontWeight: '900',
    padding: 7,
    textTransform: 'uppercase',
  },
  amount: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: {
    backgroundColor: colors.signal,
    borderColor: colors.ink,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 13,
  },
  actionDanger: { backgroundColor: colors.surface, borderColor: colors.danger },
  actionText: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  actionDangerText: { color: colors.danger },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 10,
    marginTop: 16,
    padding: 16,
  },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: { color: colors.ink, fontWeight: '900' },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    marginTop: 14,
    padding: 12,
  },
  notice: {
    backgroundColor: '#E8F6F3',
    borderLeftColor: colors.teal,
    borderLeftWidth: 3,
    color: colors.teal,
    marginTop: 14,
    padding: 12,
  },
  message: {
    alignSelf: 'flex-start',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    maxWidth: '85%',
    padding: 10,
  },
  messageMine: { alignSelf: 'flex-end', backgroundColor: '#E8F6F3' },
  messageText: { color: colors.ink, lineHeight: 19 },
  compose: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  composeInput: { flex: 1 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  empty: { alignItems: 'center', gap: 10, marginTop: 90, padding: 28 },
  emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  emptyMessage: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
});
