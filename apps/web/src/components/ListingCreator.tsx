"use client";

import type { CategoryResponse, ListingResponse } from "@4by4/api-client";
import { apiClient } from "@/lib/api";
import { FormEvent, useEffect, useState } from "react";

export function ListingCreator() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [myListings, setMyListings] = useState<ListingResponse[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locality, setLocality] = useState("Nagercoil");
  const [price, setPrice] = useState("500");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [availableCategories, listings] = await Promise.all([
      apiClient.getCategories(),
      apiClient.getMyListings(),
    ]);
    setCategories(availableCategories);
    setCategoryId((current) => current || availableCategories[0]?.id || "");
    setMyListings(listings);
  }

  useEffect(() => {
    let active = true;
    Promise.all([apiClient.getCategories(), apiClient.getMyListings()])
      .then(([availableCategories, listings]) => {
        if (active) {
          setCategories(availableCategories);
          setCategoryId(availableCategories[0]?.id || "");
          setMyListings(listings);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Sign in to list items.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const csrf = sessionStorage.getItem("forhire_csrf") ?? undefined;
      const listing = await apiClient.createListing({
        attributes: {},
        category_id: categoryId,
        condition: "good",
        delivery_enabled: false,
        description,
        latitude: 8.1833,
        longitude: 77.4119,
        pickup_enabled: true,
        prices: [{ amount_minor: Math.round(Number(price) * 100), currency: "INR", deposit_minor: 0, unit: "day" }],
        public_locality: locality,
        quantity: 1,
        title,
      }, csrf);
      await apiClient.transitionListing(listing.id, "publish", csrf);
      setTitle("");
      setDescription("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the listing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="owner-layout">
      <form className="owner-form" onSubmit={submit}>
        <label><span>Category</span><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label><span>Title</span><input required minLength={3} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Description</span><textarea required minLength={10} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label><span>Pickup locality</span><input required value={locality} onChange={(event) => setLocality(event.target.value)} /></label>
        <label><span>Daily price (INR)</span><input required min="1" step="1" type="number" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy || !categoryId} type="submit">{busy ? "Publishing..." : "Create and publish"}</button>
      </form>
      <section className="owner-inventory">
        <p className="eyebrow">Your inventory</p>
        <h2>{myListings.length} listings</h2>
        {myListings.map((listing) => <article key={listing.id}><strong>{listing.title}</strong><span className={`status status-${listing.status}`}>{listing.status.replace("_", " ")}</span></article>)}
      </section>
    </div>
  );
}