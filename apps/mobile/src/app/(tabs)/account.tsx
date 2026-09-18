import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function AccountScreen() {
  return (
    <PlaceholderScreen
      eyebrow="Private by default"
      icon="person-outline"
      message="Profiles, addresses, sessions, and seller headers will be managed here."
      title="Account"
      actionHref="/login"
      actionLabel="Sign in"
    />
  );
}
