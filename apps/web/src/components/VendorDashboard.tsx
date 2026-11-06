import { useState } from "react";
import type { FormEvent } from "react";

import {
  loginCustomer,
  getVendorOrders,
  updateVendorOrderStatus,
} from "../lib/api";

import type {
  VendorOrder,
  VendorFulfillmentStatus,
} from "../lib/api";

function formatPrice(pricePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(pricePaise / 100);
}

// Only permit the next status in the backend's transition sequence.
const nextStatus: Record<
  VendorFulfillmentStatus,
  VendorFulfillmentStatus | null
> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

function getActionLabel(status: VendorFulfillmentStatus): string {
  const labels: Record<VendorFulfillmentStatus, string> = {
    PENDING: "Confirm order",
    CONFIRMED: "Start processing",
    PROCESSING: "Mark as shipped",
    SHIPPED: "Mark as delivered",
    DELIVERED: "Completed",
    CANCELLED: "Cancelled",
  };

  return labels[status];
}

function statusStyle(status: VendorFulfillmentStatus): string {
  const styles: Record<VendorFulfillmentStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-indigo-100 text-indigo-800",
    SHIPPED: "bg-violet-100 text-violet-800",
    DELIVERED: "bg-emerald-100 text-emerald-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return styles[status];
}

export default function VendorDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const [orders, setOrders] = useState<VendorOrder[]>([]);

  const [loginLoading, setLoginLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==========================================
  // LOAD VENDOR ORDERS
  // ==========================================

  async function loadOrders(accessToken: string) {
    setOrdersLoading(true);
    setError("");

    try {
      const result = await getVendorOrders(accessToken);
      setOrders(result.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve vendor orders.",
      );
      throw err;
    } finally {
      setOrdersLoading(false);
    }
  }

  // ==========================================
  // VENDOR LOGIN
  // ==========================================

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoginLoading(true);

    try {
      const result = await loginCustomer(email.trim(), password);

      if (result.user.role !== "VENDOR") {
        throw new Error(
          "This account is not an approved vendor account.",
        );
      }

      setToken(result.accessToken);
      setEmail(result.user.email);
      setPassword("");

      setMessage("Vendor login successful.");

      try {
        await loadOrders(result.accessToken);
      } catch {
        // Keep the successful login even if order loading fails.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in to the vendor dashboard.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  // ==========================================
  // UPDATE FULFILLMENT STATUS
  // ==========================================

  async function handleStatusUpdate(
    orderId: string,
    status: VendorFulfillmentStatus,
  ) {
    if (!token || busyOrderId) return;

    setBusyOrderId(orderId);
    setError("");
    setMessage("");

    try {
      const result = await updateVendorOrderStatus(
        token,
        orderId,
        status,
      );

      setMessage(
        `${result.orderNumber}: fulfillment updated to ${result.sellerOrder.fulfillmentStatus}.`,
      );

      await loadOrders(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the order status.",
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  function handleLogout() {
    setToken(null);
    setOrders([]);
    setPassword("");
    setMessage("");
    setError("");
  }

  // ==========================================
  // DASHBOARD SUMMARY
  // ==========================================

  const pendingCount = orders.filter(
    (order) => order.sellerOrder.fulfillmentStatus === "PENDING",
  ).length;

  const processingCount = orders.filter((order) =>
    ["CONFIRMED", "PROCESSING"].includes(
      order.sellerOrder.fulfillmentStatus,
    ),
  ).length;

  const shippedCount = orders.filter((order) =>
    ["SHIPPED", "DELIVERED"].includes(
      order.sellerOrder.fulfillmentStatus,
    ),
  ).length;

  // ==========================================
  // UI
  // ==========================================

  return (
    <section
      id="vendor-dashboard"
      className="mx-auto mt-14 w-full max-w-7xl scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* Header */}
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Seller workspace
        </p>

        <h2 className="mt-2 text-2xl font-bold text-[#172b4d] sm:text-3xl">
          Vendor order dashboard
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Manage customer orders and update your store's fulfillment progress.
        </p>
      </div>

      {/* Login form */}
      {!token ? (
        <form
          onSubmit={handleLogin}
          className="mx-auto max-w-2xl space-y-4 rounded-2xl bg-slate-50 p-5 sm:p-7"
        >
          <h3 className="text-lg font-semibold text-slate-800">
            Vendor sign in
          </h3>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Vendor email
            </label>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vendor@example.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Password
            </label>

            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter vendor password"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-xl bg-[#172b4d] px-5 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50"
          >
            {loginLoading ? "Signing in..." : "Sign in to vendor dashboard"}
          </button>
        </form>
      ) : (
        <>
          {/* Vendor account bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                Signed in as approved vendor
              </p>

              <p className="font-semibold text-slate-800">
                {email}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadOrders(token).catch(() => {})}
                disabled={ordersLoading}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-white disabled:opacity-50"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Pending orders</p>
              <p className="mt-2 text-3xl font-bold text-amber-700">
                {pendingCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Processing</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">
                {processingCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <p className="text-sm text-slate-500">Shipped / delivered</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">
                {shippedCount}
              </p>
            </div>
          </div>

          {/* Orders */}
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-[#172b4d]">
                Incoming orders
              </h3>

              <span className="text-sm text-slate-500">
                {orders.length} orders found
              </span>
            </div>

            {ordersLoading ? (
              <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                Loading vendor orders...
              </p>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-10 text-center">
                <p className="font-semibold text-slate-800">
                  No eligible orders yet.
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  New COD orders and successfully paid online orders for your
                  store will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {orders.map((order) => {
                  const seller = order.sellerOrder;
                  const currentStatus = seller.fulfillmentStatus;
                  const next = nextStatus[currentStatus];
                  const isBusy = busyOrderId === order._id;

                  return (
                    <article
                      key={order._id}
                      className="overflow-hidden rounded-2xl border border-slate-200"
                    >
                      {/* Order heading */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:p-5">
                        <div>
                          <p className="font-bold text-slate-900">
                            {order.orderNumber}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(order.createdAt).toLocaleString("en-IN")}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(currentStatus)}`}
                        >
                          {currentStatus.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
                        {/* Customer details */}
                        <div>
                          <h4 className="mb-3 font-semibold text-[#172b4d]">
                            Delivery details
                          </h4>

                          <p className="font-semibold text-slate-800">
                            {order.shippingAddress.fullName}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {order.shippingAddress.phone}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {order.shippingAddress.addressLine1}
                            {order.shippingAddress.addressLine2
                              ? `, ${order.shippingAddress.addressLine2}`
                              : ""}
                            {order.shippingAddress.landmark
                              ? `, Near ${order.shippingAddress.landmark}`
                              : ""}
                            <br />
                            {order.shippingAddress.city},{" "}
                            {order.shippingAddress.state} -{" "}
                            {order.shippingAddress.postalCode}
                            <br />
                            {order.shippingAddress.country}
                          </p>

                          <div className="mt-4 rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">
                              Payment method
                            </p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {order.payment.method.replaceAll("_", " ")}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Payment status: {order.payment.status}
                            </p>
                          </div>
                        </div>

                        {/* Seller products */}
                        <div>
                          <h4 className="mb-3 font-semibold text-[#172b4d]">
                            Your products
                          </h4>

                          <div className="space-y-3">
                            {seller.items.map((item) => (
                              <div
                                key={`${item.productId}-${item.sku}`}
                                className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    className="h-14 w-14 rounded-lg bg-slate-100 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                                    No image
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-800">
                                    {item.productName}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    SKU: {item.sku}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Quantity: {item.quantity}
                                  </p>
                                </div>

                                <p className="text-sm font-bold text-slate-900">
                                  {formatPrice(item.lineTotalPaise)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="font-semibold text-slate-700">
                              Seller subtotal
                            </span>

                            <span className="text-lg font-bold text-[#172b4d]">
                              {formatPrice(seller.subtotalPaise)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fulfillment action */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 sm:p-5">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {getActionLabel(currentStatus)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {next
                              ? `Next status: ${next}`
                              : "No further status updates available."}
                          </p>
                        </div>

                        {next && (
                          <button
                            type="button"
                            disabled={busyOrderId !== null}
                            onClick={() =>
                              void handleStatusUpdate(order._id, next)
                            }
                            className="rounded-xl bg-[#172b4d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? "Updating..." : next.replaceAll("_", " ")}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Feedback */}
      {message && (
        <div
          role="status"
          className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-slate-400">
        Vendor access is restricted to your approved store. Only eligible orders
        are shown, and the server validates every fulfillment update.
      </p>
    </section>
  );
}