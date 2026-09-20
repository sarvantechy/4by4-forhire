import type {
  BookingResponse,
  DisputeRequest,
  ListingResponse,
  MessageResponse,
  UserResponse,
} from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors, radius } from '@/theme';
import { DetailSkeleton } from '@/components/Skeleton';

function rupees(amountMinor: number): string {
  return `Rs. ${Math.round(amountMinor / 100).toLocaleString('en-IN')}`;
}

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function titleCase(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [token, setToken] = useState('');
  const [user, setUser] = useState<UserResponse | null>(null);
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [listing, setListing] = useState<ListingResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [message, setMessage] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeCode, setChallengeCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [disputing, setDisputing] = useState(false);
  const [disputeType, setDisputeType] = useState<DisputeRequest['type']>('item_different');
  const [disputeDescription, setDisputeDescription] = useState('');

  useEffect(() => {
    let active = true;
    getAccessToken()
      .then(async (accessToken) => {
        if (!accessToken) throw new Error('Sign in from Account to view this booking.');
        const [profile, item] = await Promise.all([
          apiClient.getCurrentUser(accessToken),
          apiClient.getBooking(id, accessToken),
        ]);
        if (!active) return;
        setToken(accessToken);
        setUser(profile);
        setBooking(item);
        apiClient
          .getListing(item.listing_id)
          .then((result) => active && setListing(result))
          .catch(() => undefined);
      })
      .catch((error_) => active && setError(error_ instanceof Error ? error_.message : 'Unable to load this booking.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!booking?.id || !token) return;
    let active = true;
    apiClient
      .listMessages(booking.id, token)
      .then((items) => active && setMessages(items))
      .catch((error_) => active && setError(error_ instanceof Error ? error_.message : 'Unable to load messages.'));
    return () => {
      active = false;
    };
  }, [booking?.id, token]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to complete this action.');
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: 'accept' | 'reject' | 'cancel') {
    if (!booking) return;
    await run(async () => {
      setBooking(await apiClient.transitionBooking(booking.id, action, undefined, token));
    }, `Booking ${action}ed.`);
  }

  async function issueChallenge(purpose: 'handover' | 'return') {
    if (!booking) return;
    await run(async () => {
      const challenge = await apiClient.createHandoverChallenge(booking.id, purpose, undefined, token);
      setChallengeId(challenge.challenge_id);
      setChallengeCode(challenge.code);
      setBooking(await apiClient.getBooking(booking.id, token));
    }, `${purpose === 'handover' ? 'Handover' : 'Return'} code created.`);
  }

  async function confirmChallenge() {
    if (!booking) return;
    await run(async () => {
      setBooking(
        await apiClient.confirmHandoverChallenge(
          booking.id,
          { challenge_id: challengeId, code: challengeCode },
          undefined,
          token,
        ),
      );
    }, 'Confirmation recorded.');
  }

  async function sendMessage() {
    if (!booking || !message.trim()) return;
    await run(async () => {
      const sent = await apiClient.sendMessage(
        booking.id,
        { body: message.trim(), client_message_id: randomUUID() },
        undefined,
        token,
      );
      setMessages((current) => [...current, sent]);
      setMessage('');
    }, 'Message sent.');
  }

  async function fileDispute() {
    if (!booking || disputeDescription.trim().length < 10) {
      setError('Describe the issue in at least 10 characters.');
      return;
    }
    await run(async () => {
      await apiClient.createDispute(
        booking.id,
        { description: disputeDescription.trim(), type: disputeType },
        undefined,
        token,
      );
      setDisputing(false);
      setDisputeDescription('');
    }, 'Dispute filed. Our team will review it.');
  }

  async function blockOtherParty() {
    if (!booking || !user) return;
    const otherUserId = booking.owner_user_id === user.id ? booking.renter_user_id : booking.owner_user_id;
    await run(async () => {
      await apiClient.blockUser(otherUserId, undefined, token);
    }, 'User blocked. They can no longer contact you.');
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!booking || !user) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={34} color={colors.signal} />
          <Text style={styles.emptyTitle}>Booking not found</Text>
          <Text style={styles.emptyMessage}>{error || 'This booking could not be loaded.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = booking.owner_user_id === user.id;
  const isRenter = booking.renter_user_id === user.id;
  const conditionPhase = ['active', 'return_pending', 'inspection', 'overdue'].includes(booking.status)
    ? 'return'
    : 'handover';
  const image = listing?.images[0];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
          {booking.public_number}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {listing ? (
          <Pressable onPress={() => router.push(`/listing/${listing.id}`)} style={styles.listingCard}>
            {image ? (
              <Image source={{ uri: image.url }} style={styles.listingImage} />
            ) : (
              <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
                <Ionicons name="image-outline" size={22} color={colors.muted} />
              </View>
            )}
            <View style={styles.listingInfo}>
              <Text numberOfLines={1} style={styles.listingTitle}>{listing.title}</Text>
              <Text numberOfLines={1} style={styles.listingMeta}>
                {listing.category.name} \u00b7 {titleCase(listing.condition)}
              </Text>
              {listing.public_locality ? <Text style={styles.listingLocality}>{listing.public_locality}</Text> : null}
            </View>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        ) : null}

        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryRole}>{isOwner ? 'Owner workflow' : 'Renter workflow'}</Text>
            <Text style={styles.status}>{booking.status.replaceAll('_', ' ')}</Text>
          </View>
          <Text style={styles.summaryNumber}>{booking.public_number}</Text>

          <View style={styles.detailGrid}>
            <DetailRow label="Rental charge" value={rupees(booking.rental_charge_minor)} />
            <DetailRow label="Deposit at handover" value={rupees(booking.deposit_minor)} />
            <DetailRow label="Quantity" value={String(booking.quantity)} />
            <DetailRow label="Fulfillment" value={titleCase(booking.fulfillment_method)} />
            <DetailRow label="Currency" value={booking.currency} />
            <DetailRow label="Starts" value={dateTimeLabel(booking.starts_at)} />
            <DetailRow label="Ends" value={dateTimeLabel(booking.ends_at)} />
            <DetailRow label="Booked on" value={dateTimeLabel(booking.created_at)} />
          </View>
        </View>

        {challengeId && challengeCode ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Share this code</Text>
            <Text style={styles.meta}>Give this code to the other party to confirm in person.</Text>
            <Text style={styles.challengeCode}>{challengeCode}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {isOwner && booking.status === 'requested' && (
            <>
              <Action label="Accept request" onPress={() => transition('accept')} />
              <Action danger label="Reject" onPress={() => transition('reject')} />
            </>
          )}
          {isRenter && ['requested', 'accepted'].includes(booking.status) && (
            <Action danger label="Cancel request" onPress={() => transition('cancel')} />
          )}
          {isOwner && booking.status === 'accepted' && (
            <Action label="Create handover code" onPress={() => issueChallenge('handover')} />
          )}
          {booking.status === 'active' && (
            <>
              <Action
                label="Confirm offline payment"
                onPress={() => run(async () => {
                  await apiClient.acknowledgePayment(booking.id, { disagreement: false }, undefined, token);
                }, 'Offline payment acknowledgement recorded.')}
              />
              {isRenter && (
                <Action
                  label="Initiate return"
                  onPress={() => run(async () => {
                    setBooking(await apiClient.initiateReturn(booking.id, undefined, token));
                  }, 'Return initiated.')}
                />
              )}
            </>
          )}
          {isOwner && booking.status === 'return_pending' && (
            <Action label="Create return code" onPress={() => issueChallenge('return')} />
          )}
          {isOwner && booking.status === 'inspection' && (
            <Action
              label="Accept inspection"
              onPress={() => run(async () => {
                setBooking(await apiClient.acceptInspection(booking.id, undefined, token));
              }, 'Booking completed.')}
            />
          )}
          {['accepted', 'ready_for_handover', 'active', 'return_pending', 'inspection'].includes(booking.status) && (
            <Action
              label={`Record ${conditionPhase} condition`}
              onPress={() => run(async () => {
                await apiClient.addConditionReport(booking.id, {
                  checklist: { condition_confirmed: true },
                  notes: 'Condition confirmed in the mobile handover workflow.',
                  phase: conditionPhase,
                }, undefined, token);
              }, 'Condition report recorded.')}
            />
          )}
          {booking.status === 'completed' && (
            <Action
              label="Leave 5-star review"
              onPress={() => run(async () => {
                await apiClient.createReview(booking.id, { rating: 5, text: 'Smooth rental experience.' }, undefined, token);
              }, 'Review submitted.')}
            />
          )}
          <Action
            label="Report listing"
            onPress={() => run(async () => {
              await apiClient.createReport({
                description: 'Please review this listing and related booking activity.',
                reason: 'Customer review requested',
                target_id: booking.listing_id,
                target_type: 'listing',
              }, undefined, token);
            }, 'Report submitted.')}
          />
          <Action label="File a dispute" onPress={() => setDisputing((current) => !current)} />
          <Action danger label="Block user" onPress={blockOtherParty} />
        </View>

        {disputing ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>File a dispute</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.disputeTypeRow}>
              {DISPUTE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setDisputeType(type)}
                  style={[styles.disputeTypeChip, disputeType === type && styles.disputeTypeChipActive]}
                >
                  <Text style={[styles.disputeTypeText, disputeType === type && styles.disputeTypeTextActive]}>
                    {type.replaceAll('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              multiline
              numberOfLines={4}
              onChangeText={setDisputeDescription}
              placeholder="Describe what happened (minimum 10 characters)"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.disputeInput]}
              value={disputeDescription}
            />
            <Pressable disabled={busy} onPress={fileDispute} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Submit dispute</Text>
            </Pressable>
          </View>
        ) : null}

        {['ready_for_handover', 'return_pending'].includes(booking.status) ? (
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

function DetailRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Action({
  danger = false,
  label,
  onPress,
}: Readonly<{
  danger?: boolean;
  label: string;
  onPress: () => void;
}>) {
  return (
    <Pressable onPress={onPress} style={[styles.action, danger && styles.actionDanger]}>
      <Text style={[styles.actionText, danger && styles.actionDangerText]}>{label}</Text>
    </Pressable>
  );
}

const DISPUTE_TYPES: DisputeRequest['type'][] = [
  'item_not_received',
  'item_different',
  'damage',
  'missing_parts',
  'late_return',
  'non_return',
  'payment_disagreement',
  'unsafe_behavior',
  'abusive_communication',
];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  headerTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  content: { padding: 20, paddingBottom: 80 },
  listingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    padding: 12,
  },
  listingImage: { borderRadius: radius.sm, height: 56, width: 56 },
  listingImagePlaceholder: { alignItems: 'center', backgroundColor: colors.paper, justifyContent: 'center' },
  listingInfo: { flex: 1, gap: 2 },
  listingTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  listingMeta: { color: colors.muted, fontSize: 12 },
  listingLocality: { color: colors.muted, fontSize: 12 },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  summaryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryRole: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  summaryNumber: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  status: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F6F3',
    color: colors.teal,
    fontSize: 11,
    fontWeight: '900',
    padding: 7,
    textTransform: 'uppercase',
  },
  detailGrid: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { color: colors.muted, fontSize: 13 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  challengeCode: { color: colors.ink, fontSize: 28, fontWeight: '900', letterSpacing: 6, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
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
  disputeTypeRow: { gap: 8, paddingBottom: 4 },
  disputeTypeChip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disputeTypeChipActive: { backgroundColor: colors.signal, borderColor: colors.ink },
  disputeTypeText: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  disputeTypeTextActive: { color: colors.ink },
  disputeInput: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
});
