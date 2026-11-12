import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  getProductReviews,
  createProductReview,
} from "../lib/api";

import type {
  ProductReviewsResponse,
} from "../lib/api";

interface Props {
  productId: string;
  token: string | null;
}

export default function ProductReviews({
  productId,
  token,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);

  const [reviews, setReviews] =
    useState<ProductReviewsResponse | null>(null);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadReviews() {
      setLoading(true);
      setError("");

      try {
        const result = await getProductReviews(productId);

        if (!cancelled) {
          setReviews(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load reviews.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [open, productId, reload]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("Please sign in before submitting a review.");
      return;
    }

    setError("");
    setMessage("");

    try {
      await createProductReview(token, productId, {
        rating,
        title,
        comment,
      });

      setTitle("");
      setComment("");
      setRating(5);

      setMessage("Your review was submitted successfully.");
      setReload((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your review.",
      );
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
      >
        {open ? "Hide Reviews" : "View Ratings & Reviews"}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {loading && (
            <p className="text-sm text-slate-500">
              Loading reviews...
            </p>
          )}

          {reviews && (
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-lg font-bold text-amber-700">
                ★ {reviews.statistics.averageRating.toFixed(1)} / 5
              </p>
              <p className="text-xs text-slate-600">
                {reviews.statistics.totalReviews} customer reviews
              </p>
            </div>
          )}

          {reviews?.reviews.map((review) => (
            <article
              key={review._id}
              className="rounded-xl border border-slate-200 p-3"
            >
              <p className="font-semibold text-amber-600">
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </p>

              <h4 className="mt-1 text-sm font-semibold">
                {review.title}
              </h4>

              <p className="mt-1 text-sm text-slate-600">
                {review.comment}
              </p>

              {review.verifiedPurchase && (
                <span className="mt-2 inline-block text-xs font-semibold text-emerald-700">
                  ✓ Verified Purchase
                </span>
              )}
            </article>
          ))}

          {reviews && reviews.reviews.length === 0 && (
            <p className="text-sm text-slate-500">
              No reviews yet. Be the first to review this product after purchase and delivery.
            </p>
          )}

          {token ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 rounded-xl bg-slate-50 p-4"
            >
              <h4 className="font-semibold text-slate-800">
                Write a Review
              </h4>

              <label className="block text-sm font-medium">
                Rating

                <select
                  value={rating}
                  onChange={(event) =>
                    setRating(Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} Stars
                    </option>
                  ))}
                </select>
              </label>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Review title"
                required
                minLength={3}
                maxLength={120}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
              />

              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Share your experience..."
                required
                minLength={10}
                maxLength={2000}
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
              />

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Submit Review
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500">
              Sign in to submit a review.
            </p>
          )}

          {message && (
            <p className="text-sm text-emerald-700">{message}</p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}