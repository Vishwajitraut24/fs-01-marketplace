import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import { getPublicProducts } from "../lib/api";

import type {
  PublicProduct,
  ProductCatalogFilters,
} from "../lib/api";

import ProductReviews from "./ProductReviews";

// Available product categories.
const categories = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Beauty",
  "Books",
  "Sports",
];

// Default pagination.
const defaultPagination = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0,
};

// Convert paise into Indian Rupees.
function formatPrice(pricePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pricePaise / 100);
}

interface ProductCatalogProps {
  onAddToCart: (productId: string) => void | Promise<void>;
  addingProductId: string | null;
  token: string | null;
}

export default function ProductCatalog({
  onAddToCart,
  addingProductId,
  token,
}: ProductCatalogProps) {
  const [products, setProducts] = useState<PublicProduct[]>([]);

  const [pagination, setPagination] = useState(defaultPagination);

  const [searchInput, setSearchInput] = useState("");

  const [filters, setFilters] = useState<ProductCatalogFilters>({
    sort: "newest",
    page: 1,
    limit: 12,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch products whenever filters change.
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await getPublicProducts(filters);

        if (cancelled) return;

        setProducts(response.items ?? []);
        setPagination(response.pagination ?? defaultPagination);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load products. Please try again.",
        );

        setProducts([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [filters, reloadKey]);

  // Search products.
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFilters((current) => ({
      ...current,
      q: searchInput.trim() || undefined,
      page: 1,
    }));
  }

  // Change category.
  function handleCategoryChange(value: string) {
    setFilters((current) => ({
      ...current,
      category: value || undefined,
      page: 1,
    }));
  }

  // Change sorting.
  function handleSortChange(value: string) {
    const sort = value as ProductCatalogFilters["sort"];

    setFilters((current) => ({
      ...current,
      sort,
      page: 1,
    }));
  }

  // Change page.
  function handlePageChange(page: number) {
    setFilters((current) => ({
      ...current,
      page,
    }));

    document
      .getElementById("products")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // Reset all filters.
  function clearFilters() {
    setSearchInput("");

    setFilters({
      sort: "newest",
      page: 1,
      limit: 12,
    });
  }

  const hasFilters = Boolean(filters.q || filters.category);

  return (
    <section
      id="products"
      className="scroll-mt-24 bg-gray-50 px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">

        {/* Section heading */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
            <Package className="h-4 w-4" />
            Marketplace
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Explore Products
              </h2>

              <p className="mt-2 max-w-2xl text-gray-600">
                Discover products from our marketplace sellers.
                Find what you need at great prices.
              </p>
            </div>

            <p className="text-sm text-gray-500">
              {pagination.total} products available
            </p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">

            {/* Search form */}
            <form
              onSubmit={handleSearch}
              className="relative md:col-span-6"
            >
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search products, brands..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <button type="submit" className="sr-only">
                Search
              </button>
            </form>

            {/* Category filter */}
            <div className="md:col-span-3">
              <select
                value={filters.category ?? ""}
                onChange={(event) =>
                  handleCategoryChange(event.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All Categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Sorting */}
            <div className="md:col-span-3">
              <select
                value={filters.sort ?? "newest"}
                onChange={(event) =>
                  handleSortChange(event.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Product results heading */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-gray-500" />

            <h3 className="text-lg font-semibold text-gray-900">
              All Products
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-indigo-600 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white"
              >
                <div className="h-52 bg-gray-200" />

                <div className="space-y-3 p-5">
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-5 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
            <p className="font-semibold text-red-700">
              Unable to load products
            </p>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No products found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Try another search term or select a different category.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              View All Products
            </button>
          </div>
        )}

        {/* Product cards */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
                const image = product.images?.[0];

                return (
                  <article
                    key={product._id}
                    className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    {/* Product image */}
                    <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gray-100">
                      {image?.url ? (
                        <img
                          src={image.url}
                          alt={image.altText || product.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <Package className="h-16 w-16 text-gray-300" />
                      )}

                      <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                        {product.category}
                      </span>

                      <span
                        className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                          product.inStock
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {product.inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    {/* Product information */}
                    <div className="p-5">
                      {product.brand && (
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {product.brand}
                        </p>
                      )}

                      <h3 className="line-clamp-1 text-lg font-semibold text-gray-900">
                        {product.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">
                        {product.description}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xl font-bold text-gray-900">
                            {formatPrice(product.pricePaise)}
                          </p>

                          {product.compareAtPricePaise &&
                            product.compareAtPricePaise >
                              product.pricePaise && (
                              <p className="text-sm text-gray-400 line-through">
                                {formatPrice(product.compareAtPricePaise)}
                              </p>
                            )}
                        </div>

                        <span className="text-xs text-gray-500">
                          {product.vendor?.storeName ?? "Marketplace seller"}
                        </span>
                      </div>

                      {/* Add to cart */}
                      <button
                        type="button"
                        onClick={() => void onAddToCart(product._id)}
                        disabled={
                          !product.inStock ||
                          addingProductId === product._id
                        }
                        className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {addingProductId === product._id
                          ? "Adding..."
                          : product.inStock
                            ? "Add to Cart"
                            : "Out of Stock"}
                      </button>

                      {/* Product reviews and ratings */}
                      <ProductReviews
                        productId={product._id}
                        token={token}
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-indigo-500 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-indigo-500 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}