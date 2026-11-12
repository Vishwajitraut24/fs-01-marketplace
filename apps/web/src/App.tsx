import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";

import { StatusPill } from "./components/StatusPill";
import ShoppingExperience from "./components/ShoppingExperience";
import { RazorpayTestCheckout } from "./components/RazorpayTestCheckout";
import { getReadiness, type ReadinessResponse } from "./lib/api";
import VendorDashboard from "./components/VendorDashboard";
import AdminDashboard from "./components/AdminDashboard";

const categories = [
  "All finds",
  "Home & living",
  "Fashion",
  "Electronics",
  "Beauty",
  "Accessories",
];

const services = [
  {
    key: "mongodb",
    label: "MongoDB",
    detail: "Primary data store",
  },
  {
    key: "redis",
    label: "Redis",
    detail: "Cache and cart layer",
  },
  {
    key: "elasticsearch",
    label: "Elasticsearch",
    detail: "Product discovery",
  },
] as const;

const collections = [
  {
    label: "Thoughtful homeware",
    count: "Curated by independent makers",
    tone: "from-orange-100 to-amber-50",
    icon: "⌂",
  },
  {
    label: "Everyday essentials",
    count: "Useful things, made better",
    tone: "from-sky-100 to-cyan-50",
    icon: "✳",
  },
  {
    label: "Personal style",
    count: "Pieces with a point of view",
    tone: "from-violet-100 to-fuchsia-50",
    icon: "◈",
  },
];

export default function App() {
  const [activeCategory, setActiveCategory] = useState("All finds");
  const [health, setHealth] = useState<ReadinessResponse | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getReadiness(controller.signal)
      .then((result) => {
        setHealth(result);
        setHealthError(false);
      })
      .catch(() => {
        setHealthError(true);
      });

    return () => controller.abort();
  }, []);

  const apiReady = health?.success === true;

  const scrollToLogin = () => {
    setMobileMenu(false);

    document
      .getElementById("customer-login")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToProducts = () => {
    document
      .getElementById("products")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      id="top"
      className="min-h-screen bg-[#fbfaf8] text-slate-900"
    >
      {/* Announcement bar */}
      <div className="border-b border-slate-200 bg-[#172b4d] px-4 py-2 text-center text-xs font-medium tracking-wide text-white sm:text-sm">
        A better way to shop independent. Discover something different today.
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#fbfaf8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">

          {/* Logo */}
          <a
            className="flex items-center gap-2.5"
            href="#top"
            aria-label="FS-01 home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#172b4d] text-sm font-black tracking-tight text-white">
              FS
            </span>

            <span className="text-lg font-extrabold tracking-tight">
              market
              <span className="text-blue-700">place.</span>
            </span>
          </a>

          {/* Desktop navigation */}
          <nav
            className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"
            aria-label="Main navigation"
          >
            <a
              className="transition hover:text-blue-700"
              href="#discover"
            >
              Discover
            </a>

            <a
              className="transition hover:text-blue-700"
              href="#collections"
            >
              Collections
            </a>

            <a
              className="transition hover:text-blue-700"
              href="#products"
            >
              Products
            </a>

            <a
              className="transition hover:text-blue-700"
              href="#sell"
            >
              Sell with us
            </a>
          </nav>

          {/* Search bar */}
          <div className="hidden flex-1 justify-center lg:flex">
            <label className="flex w-full max-w-md items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
              <Search className="h-4 w-4" />

              <input
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Search products, brands and more"
                aria-label="Search products"
              />

              <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px]">
                ⌘ K
              </kbd>
            </label>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">

            {/* Wishlist */}
            <button
              type="button"
              className="hidden rounded-full p-2.5 text-slate-600 transition hover:bg-slate-100 sm:inline-flex"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
            </button>

            {/* Shopping bag */}
            <button
              type="button"
              onClick={scrollToProducts}
              className="relative rounded-full p-2.5 text-slate-700 transition hover:bg-slate-100"
              aria-label="Go to shopping and cart"
            >
              <ShoppingBag className="h-5 w-5" />
            </button>

            {/* Sign in */}
            <button
              type="button"
              onClick={scrollToLogin}
              className="ml-1 hidden rounded-full bg-[#172b4d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 sm:inline-flex"
            >
              Sign in
            </button>

            {/* Mobile menu button */}
            <button
              type="button"
              className="rounded-lg p-2 md:hidden"
              onClick={() => setMobileMenu((value) => !value)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenu}
            >
              {mobileMenu ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenu && (
          <div className="border-t border-slate-200 px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium">

              <a
                href="#discover"
                onClick={() => setMobileMenu(false)}
              >
                Discover
              </a>

              <a
                href="#collections"
                onClick={() => setMobileMenu(false)}
              >
                Collections
              </a>

              <a
                href="#products"
                onClick={() => setMobileMenu(false)}
              >
                Products
              </a>

              <a
                href="#sell"
                onClick={() => setMobileMenu(false)}
              >
                Sell with us
              </a>

              <button
                type="button"
                onClick={scrollToLogin}
                className="w-fit font-semibold text-blue-700"
              >
                Sign in
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-7 lg:px-8">

        {/* Hero section */}
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#e9eff8] px-7 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">

          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />

          <div className="relative z-10 max-w-2xl">

            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/75 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-800">
              <Sparkles className="h-3.5 w-3.5" />
              The independent marketplace
            </span>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#172b4d] sm:text-5xl lg:text-6xl">
              Good finds.
              <br />
              <span className="text-blue-700">Good people.</span>
              <br />
              One marketplace.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Shop distinctive products from independent sellers. Find the
              things you love, support the people who make them.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <a
                href="#products"
                className="inline-flex items-center gap-2 rounded-full bg-[#172b4d] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-900"
              >
                Explore marketplace
                <ArrowRight className="h-4 w-4" />
              </a>

              <a
                href="#sell"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Become a seller
              </a>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-slate-600">

              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                Secure checkout
              </span>

              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-blue-700" />
                Independent sellers
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-blue-700" />
                Order tracking
              </span>
            </div>
          </div>

          <div className="hero-stamp" aria-hidden="true">
            <span>MADE TO</span>
            <strong>DISCOVER</strong>
            <span>MADE TO LAST</span>
            <div className="stamp-star">✳</div>
          </div>

          <div className="absolute bottom-0 right-0 hidden h-64 w-[34%] rounded-tl-[10rem] bg-gradient-to-br from-[#cbdaf0] to-[#91acd1] opacity-70 lg:block" />
        </section>

        {/* Discover section */}
        <section id="discover" className="pt-14">

          <div className="flex flex-wrap items-end justify-between gap-4">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                Start exploring
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Find your kind of good
              </h2>
            </div>

            <a
              href="#products"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:text-blue-600"
            >
              Browse all
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Category buttons */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  activeCategory === category
                    ? "border-[#172b4d] bg-[#172b4d] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        {/* Collections section */}
        <section id="collections" className="pt-10">

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Made for your everyday
            </h2>

            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-slate-500"
            >
              Featured
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {collections.map((item, index) => (
              <article
                key={item.label}
                className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5"
              >
                <div
                  className={`collection-art bg-gradient-to-br ${item.tone}`}
                >
                  <span className="collection-symbol">
                    {item.icon}
                  </span>

                  <span className="collection-index">
                    0{index + 1} / 03
                  </span>

                  <div className="collection-shape" />
                </div>

                <div className="flex items-center justify-between p-5">

                  <div>
                    <h3 className="font-semibold">
                      {item.label}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.count}
                    </p>
                  </div>

                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition group-hover:border-[#172b4d] group-hover:bg-[#172b4d] group-hover:text-white">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Shopping experience: login, products and cart */}
        <section id="products" className="pt-12">
          <ShoppingExperience />
        </section>

        {/* Seller section */}
        <section
          id="sell"
          className="mt-14 overflow-hidden rounded-3xl bg-[#172b4d] px-7 py-9 text-white sm:px-10 sm:py-11"
        >
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-center">

            <div className="max-w-xl">

              <div className="flex items-center gap-2 text-sm font-semibold text-blue-200">
                <Store className="h-4 w-4" />
                For independent sellers
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Your products deserve a bigger stage.
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Create your store, reach new customers and manage your orders
                from one seller dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
              document
              .getElementById("vendor-dashboard")
              ?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#172b4d] transition hover:bg-blue-50"
              >
              Open vendor dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
        <VendorDashboard />
        <AdminDashboard />

        {/* Developer panel */}
        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Developer panel
              </p>

              <h2 className="mt-1 text-lg font-semibold">
                Platform infrastructure
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setShowHealth((value) => !value)}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              {showHealth ? "Hide details" : "View service status"}
            </button>
          </div>

          {/* API status */}
          <div className="mt-4 flex flex-wrap items-center gap-3">

            <span
              className={`h-2.5 w-2.5 rounded-full ${
                apiReady ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />

            <span className="text-sm text-slate-600">
              {apiReady
                ? "API and dependencies are ready"
                : healthError
                  ? "API is not reachable yet"
                  : "Checking API and dependencies…"}
            </span>
          </div>

          {/* Service details */}
          {showHealth && (
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">

              {services.map((service) => {
                const status =
                  health?.data.checks[service.key] ??
                  (healthError ? "down" : "loading");

                return (
                  <div
                    key={service.key}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {service.label}
                      </p>

                      <p className="text-xs text-slate-500">
                        {service.detail}
                      </p>
                    </div>

                    <StatusPill status={status} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Razorpay test checkout */}
        <RazorpayTestCheckout />

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center lg:px-8">

          <span>
            © 2026 FS-01 Marketplace. Built for independent commerce.
          </span>

          <span>
            Customer-first shopping · Seller-powered growth
          </span>
        </div>
      </footer>
    </div>
  );
}