import Link from "next/link";
import { Crosshair, Plus, Search } from "lucide-react";
import { translate } from "@4by4/i18n";

const categories = [
  {
    name: "Tools & repair",
    detail: "Drills, grinders, ladders",
    image:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Cleaning",
    detail: "Vacuums, washers, pumps",
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Events",
    detail: "Seating, audio, lighting",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Garden & farm",
    detail: "Cutters, tillers, sprayers",
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80",
  },
];

export default function Home() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="4by4 For Hire home">
          <span className="brand-mark">4×4</span>
          <span>For Hire</span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link aria-current="page" href="/">
            Home
          </Link>
          <Link href="/explore">Explore</Link>
          <Link href="/bookings">Bookings</Link>
        </nav>
        <div className="topbar-actions">
          <Link className="text-action" href="/login">
            Sign in
          </Link>
          <Link className="primary-action" href="/list-item">
            <Plus aria-hidden="true" size={18} /> List an item
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className="search-band" aria-labelledby="find-heading">
          <div className="search-copy">
            <p className="location-label">Kanyakumari pilot</p>
            <h1 id="find-heading">{translate("en", "home.heroTitle")}</h1>
            <p>Borrow useful equipment nearby. Pay at handover.</p>
          </div>
          <form className="search-panel" action="/explore" method="get">
            <label>
              <span>Search items</span>
              <input name="q" placeholder="Drill, ladder, speaker..." type="search" />
            </label>
            <label>
              <span>Near</span>
              <input name="location" defaultValue="Nagercoil" />
            </label>
            <button type="submit">
              <Search aria-hidden="true" size={18} /> Search
            </button>
          </form>
        </section>

        <section className="content-section" aria-labelledby="category-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Browse locally</p>
              <h2 id="category-heading">{translate("en", "home.popularCategories")}</h2>
            </div>
            <Link href="/explore">View all</Link>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <Link
                className="category-tile"
                href={`/explore?category=${encodeURIComponent(category.name)}`}
                key={category.name}
                style={{ backgroundImage: `url(${category.image})` }}
              >
                <span className="category-overlay" />
                <span className="category-content">
                  <strong>{category.name}</strong>
                  <small>{category.detail}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="content-section inventory-section" aria-labelledby="nearby-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Available around you</p>
              <h2 id="nearby-heading">Nearby items</h2>
            </div>
          </div>
          <div className="empty-inventory">
            <span className="empty-icon" aria-hidden="true">
              <Crosshair size={24} />
            </span>
            <div>
              <h3>{translate("en", "home.nearbyEmpty")}</h3>
              <p>The Kanyakumari inventory will appear here as owners publish items.</p>
            </div>
            <Link className="secondary-action" href="/list-item">
              List the first item
            </Link>
          </div>
        </section>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <Link aria-current="page" href="/">Home</Link>
        <Link href="/explore">Explore</Link>
        <Link className="mobile-list" href="/list-item" aria-label="List an item">
          <Plus aria-hidden="true" size={25} />
        </Link>
        <Link href="/bookings">Bookings</Link>
        <Link href="/account">Account</Link>
      </nav>
    </div>
  );
}
