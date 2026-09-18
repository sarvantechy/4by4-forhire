"use client";

import type { CategoryResponse, ListingResponse, QuoteRequest } from "@4by4/api-client";
import { apiClient } from "@/lib/api";
import { CalendarPlus, MapPin, Search, Truck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

function formatPrice(listing: ListingResponse): string {
  const price = listing.prices[0];
  if (!price) return "Price unavailable";
  return `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price.amount_minor / 100)} / ${price.unit}`;
}

export function ExploreCatalog() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [query, setQuery] = useState("");
  const [bookingListingId, setBookingListingId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiClient.getCategories(), apiClient.searchListings()])
      .then(([availableCategories, availableListings]) => {
        setCategories(availableCategories);
        setListings(availableListings);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load inventory."))
      .finally(() => setLoading(false));
  }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      setListings(await apiClient.searchListings(query));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function requestBooking(event: FormEvent, listing: ListingResponse) {
    event.preventDefault();
    const priceUnit = listing.prices[0]?.unit;
    if (!startsOn || !endsOn || !["hour", "day", "week", "month"].includes(priceUnit ?? "")) {
      setError("Choose valid start and end dates.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const quote = await apiClient.createQuote(
        listing.id,
        {
          ends_at: new Date(`${endsOn}T17:00:00`).toISOString(),
          quantity: 1,
          starts_at: new Date(`${startsOn}T09:00:00`).toISOString(),
          unit: priceUnit as QuoteRequest["unit"],
        },
        sessionStorage.getItem("forhire_csrf") ?? undefined,
      );
      const booking = await apiClient.createBooking(
        { fulfillment_method: "pickup", quote_id: quote.id },
        sessionStorage.getItem("forhire_csrf") ?? undefined,
      );
      setNotice(`${booking.public_number} sent to the owner for approval.`);
      setBookingListingId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request this booking.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="catalog-search" onSubmit={search}>
        <Search aria-hidden="true" size={20} />
        <input aria-label="Search rentals" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools, cleaning equipment, event supplies..." />
        <button type="submit">Search</button>
      </form>
      <div className="filter-row" aria-label="Available categories">
        {categories.map((category) => <span key={category.id}>{category.name}</span>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {loading ? (
        <p className="account-loading">Loading approved inventory...</p>
      ) : listings.length === 0 ? (
        <div className="empty-inventory">
          <Search aria-hidden="true" size={25} />
          <div><h3>No matching active listings</h3><p>Try a broader search or list an item for your area.</p></div>
        </div>
      ) : (
        <div className="listing-grid">
          {listings.map((listing) => (
            <article className="listing-card" key={listing.id}>
              <div className="listing-visual"><span>{listing.category.name}</span></div>
              <div className="listing-body">
                <p className="eyebrow">{listing.condition.replace("_", " ")}</p>
                <h2>{listing.title}</h2>
                <p>{listing.description}</p>
                <div className="listing-meta">
                  <span><MapPin size={15} /> {listing.public_locality}</span>
                  {listing.delivery_enabled && <span><Truck size={15} /> Owner delivery</span>}
                </div>
                <strong>{formatPrice(listing)}</strong>
                {bookingListingId === listing.id ? (
                  <form className="listing-booking-form" onSubmit={(event) => requestBooking(event, listing)}>
                    <label><span>From</span><input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
                    <label><span>To</span><input required type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label>
                    <button disabled={loading} type="submit">Send request</button>
                  </form>
                ) : (
                  <button className="listing-booking-button" onClick={() => setBookingListingId(listing.id)} type="button">
                    <CalendarPlus size={17} /> Request dates
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}