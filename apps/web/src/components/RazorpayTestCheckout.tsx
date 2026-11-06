
import { useEffect, useState } from "react";

import {
  loginCustomer,
  getCustomerOrders,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../lib/api";

import type {
  CustomerOrder,
  RazorpayCheckoutResponse,
} from "../lib/api";

// Razorpay Checkout configuration.
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    email: string;
  };
  theme: {
    color: string;
  };
  handler: (
    response: RazorpayCheckoutResponse,
  ) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

// Razorpay payment failure response.
interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
}

// Razorpay Checkout instance.
interface RazorpayInstance {
  open: () => void;
  on: (
    event: "payment.failed",
    callback: (response: RazorpayFailureResponse) => void,
  ) => void;
}

// Razorpay global browser constructor.
declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions,
    ) => RazorpayInstance;
  }
}

const RAZORPAY_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

// Load Razorpay Checkout script.
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");

    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (window.Razorpay) {
        resolve();
      } else {
        reject(
          new Error("Razorpay Checkout could not initialize."),
        );
      }
    };

    script.onerror = () => {
      reject(
        new Error("Unable to load Razorpay Checkout."),
      );
    };

    document.body.appendChild(script);
  });
}

export function RazorpayTestCheckout() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState<string | null>(null);

  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load customer orders after login.
  async function refreshOrders(accessToken: string) {
    setLoadingOrders(true);

    try {
      const result = await getCustomerOrders(accessToken);
      setOrders(result.items);
    } finally {
      setLoadingOrders(false);
    }
  }

  // Customer login.
  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoadingLogin(true);

    try {
      const result = await loginCustomer(email, password);

      if (result.user.role !== "CUSTOMER" &&
          result.user.role !== "VENDOR") {
        throw new Error(
          "This account cannot make customer purchases.",
        );
      }

      setToken(result.accessToken);
      setPassword("");

      await refreshOrders(result.accessToken);

      setMessage("Login successful. Your orders are ready.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed.",
      );
    } finally {
      setLoadingLogin(false);
    }
  }

  // Load orders whenever the authenticated user changes.
  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    getCustomerOrders(token)
      .then((result) => {
        if (active) {
          setOrders(result.items);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve orders.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  // Open Razorpay Checkout for an existing pending order.
  async function handlePayment(order: CustomerOrder) {
    if (!token) {
      setError("Please log in before making payment.");
      return;
    }

    setBusyOrderId(order._id);
    setError("");
    setMessage("");

    try {
      // Create or retrieve Razorpay gateway order.
      const gatewayOrder = await createRazorpayOrder(
        token,
        order._id,
      );

      // Load Razorpay Checkout.
      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout is unavailable.");
      }

      const options: RazorpayOptions = {
        key: gatewayOrder.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        name: "FS-01 Marketplace",
        description: `Payment for ${order.orderNumber}`,
        order_id: gatewayOrder.razorpayOrderId,

        prefill: {
          email,
        },

        theme: {
          color: "#172b4d",
        },

        // Verify the payment on our own backend.
        handler: async (response) => {
          try {
            setMessage("Verifying payment with the server...");

            const verification =
              await verifyRazorpayPayment(
                token,
                order._id,
                response,
              );

            setMessage(
              `Payment successful! Order ${verification.orderNumber} is ${verification.orderStatus}.`,
            );

            await refreshOrders(token);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Payment verification failed.",
            );
          } finally {
            setBusyOrderId(null);
          }
        },

        modal: {
          ondismiss: () => {
            setBusyOrderId(null);
            setMessage("Payment window closed. You can retry.");
          },
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", (response) => {
        setError(
          response.error?.description ??
            "Payment failed. Please try again.",
        );

        setBusyOrderId(null);
      });

      checkout.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start Razorpay Checkout.",
      );

      setBusyOrderId(null);
    }
  }

  // Logout from this test component.
  function handleLogout() {
    setToken(null);
    setOrders([]);
    setEmail("");
    setPassword("");
    setError("");
    setMessage("");
  }

  const pendingOrders = orders.filter(
    (order) =>
      order.payment.method === "RAZORPAY" &&
      order.payment.status === "PENDING" &&
      order.status === "PENDING_PAYMENT",
  );

  return (
    <section className="mx-auto my-12 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Secure payment
        </p>

        <h2 className="mt-2 text-2xl font-bold text-[#172b4d]">
          Razorpay Test Checkout
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Sign in to view pending online payments and complete
          your test transaction.
        </p>
      </div>

      {!token ? (
        <form onSubmit={handleLogin} className="space-y-4">

          <div>
            <label
              htmlFor="customer-email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Customer email
            </label>

            <input
              id="customer-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="customer-password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <input
              id="customer-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loadingLogin}
            className="w-full rounded-xl bg-[#172b4d] px-5 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingLogin ? "Signing in..." : "Sign in"}
          </button>

        </form>
      ) : (
        <div className="space-y-5">

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                Signed in as
              </p>

              <p className="font-semibold text-slate-800">
                {email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-semibold text-red-600 hover:text-red-800"
            >
              Sign out
            </button>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                Your pending Razorpay orders
              </h3>

              <button
                type="button"
                onClick={() => refreshOrders(token)}
                disabled={loadingOrders}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Refresh
              </button>
            </div>

            {loadingOrders ? (
              <p className="text-sm text-slate-500">
                Loading your orders...
              </p>
            ) : pendingOrders.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                No pending Razorpay orders found.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div
                    key={order._id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">

                      <div>
                        <p className="font-semibold text-slate-800">
                          {order.orderNumber}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {order.status} · {order.payment.status}
                        </p>
                      </div>

                      <p className="text-lg font-bold text-[#172b4d]">
                        ₹{(order.totalPaise / 100).toFixed(2)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePayment(order)}
                      disabled={busyOrderId !== null}
                      className="mt-4 w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyOrderId === order._id
                        ? "Processing..."
                        : "Pay Now"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

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
        Test integration only. Payment is marked successful only
        after backend signature and payment-status verification.
      </p>

    </section>
  );
}

export default RazorpayTestCheckout;
