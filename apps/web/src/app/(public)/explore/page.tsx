import { ExploreCatalog } from "@/components/ExploreCatalog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse rental items available near you.",
};

export default function ExplorePage() {
  return (
    <main id="main-content" className="content-section inventory-section">
      <p className="eyebrow">Tamil Nadu pilot</p>
      <h1>Explore rentals</h1>
      <ExploreCatalog />
    </main>
  );
}
