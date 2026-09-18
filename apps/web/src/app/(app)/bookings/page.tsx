import { BookingWorkspace } from "@/components/BookingWorkspace";

export default function BookingsPage() {
  return (
    <main id="main-content" className="content-section inventory-section">
      <p className="eyebrow">Renting and lending</p>
      <h1>Bookings</h1>
      <BookingWorkspace />
    </main>
  );
}
