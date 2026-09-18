import type { CategoryResponse, ListingResponse } from '@4by4/api-client';
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

export default function ListItemScreen() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('500');
  const [created, setCreated] = useState<ListingResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient.getCategories()
      .then((items) => active && setCategories(items))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Unable to load categories.'));
    return () => {
      active = false;
    };
  }, []);

  async function publish() {
    const token = await getAccessToken();
    if (!token) {
      setError('Sign in from Account before listing an item.');
      return;
    }
    const category = categories[categoryIndex];
    if (!category) return;
    setBusy(true);
    setError('');
    try {
      const listing = await apiClient.createListing({
        attributes: {},
        category_id: category.id,
        condition: 'good',
        delivery_enabled: false,
        description,
        latitude: 8.1833,
        longitude: 77.4119,
        pickup_enabled: true,
        prices: [{ amount_minor: Math.round(Number(price) * 100), currency: 'INR', deposit_minor: 0, unit: 'day' }],
        public_locality: 'Nagercoil',
        quantity: 1,
        title,
      }, undefined, token);
      setCreated(await apiClient.transitionListing(listing.id, 'publish', undefined, token));
      setTitle('');
      setDescription('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish this item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Owner workspace</Text>
        <Text accessibilityRole="header" style={styles.title}>List an item</Text>
        <Text style={styles.subtitle}>Listings remain tied to your account. Phone and exact address stay private.</Text>

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((category, index) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryIndex(index)}
              style={[styles.category, index === categoryIndex && styles.categoryActive]}
            >
              <Text style={styles.categoryText}>{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Title</Text>
        <TextInput onChangeText={setTitle} placeholder="Cordless drill kit" style={styles.input} value={title} />
        <Text style={styles.label}>Description</Text>
        <TextInput
          multiline
          onChangeText={setDescription}
          placeholder="Condition, included accessories, and safe-use notes"
          style={[styles.input, styles.description]}
          value={description}
        />
        <Text style={styles.label}>Daily price (INR)</Text>
        <TextInput keyboardType="number-pad" onChangeText={setPrice} style={styles.input} value={price} />

        {created ? (
          <View style={styles.success}>
            <Text style={styles.successTitle}>Listing submitted</Text>
            <Text style={styles.successMessage}>Status: {created.status.replace('_', ' ')}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy || title.length < 3 || description.length < 10} onPress={publish} style={styles.submit}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitText}>Create and publish</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 22, paddingBottom: 50 },
  eyebrow: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 22, marginBottom: 7 },
  categories: { gap: 8 },
  category: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, padding: 11 },
  categoryActive: { borderColor: colors.teal, borderWidth: 2 },
  categoryText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  description: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  submit: { alignItems: 'center', backgroundColor: colors.signal, justifyContent: 'center', marginTop: 24, minHeight: 52 },
  submitText: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  success: { backgroundColor: '#E8F6F3', borderLeftColor: colors.teal, borderLeftWidth: 3, marginTop: 20, padding: 14 },
  successTitle: { color: colors.ink, fontWeight: '900' },
  successMessage: { color: colors.teal, marginTop: 4 },
  error: { backgroundColor: '#FFF2F0', borderLeftColor: colors.danger, borderLeftWidth: 3, color: colors.danger, marginTop: 20, padding: 12 },
});
