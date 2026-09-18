import { ListingCreator } from "@/components/ListingCreator";

export default function ListItemPage() {
  return (
    <main id="main-content" className="content-section inventory-section">
      <p className="eyebrow">Owner workspace</p>
      <h1>List an item</h1>
      <ListingCreator />
    </main>
  );
}
