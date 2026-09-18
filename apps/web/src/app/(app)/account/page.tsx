import { AccountPanel } from "@/components/AccountPanel";

export default function AccountPage() {
  return (
    <main id="main-content" className="content-section inventory-section">
      <p className="eyebrow">Your account</p>
      <h1>Account</h1>
      <AccountPanel />
    </main>
  );
}
