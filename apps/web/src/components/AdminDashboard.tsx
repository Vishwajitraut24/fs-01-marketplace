import { useState } from "react";
import type { FormEvent } from "react";

import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  Users,
  Store,
  Package,
  RefreshCw,
  LogOut,
  TrendingUp,
} from "lucide-react";

import {
  loginCustomer,
  getAdminAnalytics,
} from "../lib/api";

import type {
  AdminAnalytics,
} from "../lib/api";

// Format paise into Indian Rupees.
function formatPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function AdminDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState<string | null>(null);

  const [analytics, setAnalytics] =
    useState<AdminAnalytics | null>(null);

  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Fetch analytics.
  async function loadAnalytics(accessToken: string) {
    setLoading(true);
    setError("");

    try {
      const result = await getAdminAnalytics(accessToken);
      setAnalytics(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Administrator login.
  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoginLoading(true);

    try {
      const result = await loginCustomer(
        email.trim(),
        password,
      );

      if (result.user.role !== "ADMIN") {
        throw new Error(
          "Access denied. Administrator account required.",
        );
      }

      setToken(result.accessToken);
      setEmail(result.user.email);
      setPassword("");

      setMessage("Administrator login successful.");

      await loadAnalytics(result.accessToken);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Administrator login failed.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  // Logout.
  function handleLogout() {
    setToken(null);
    setAnalytics(null);
    setPassword("");
    setError("");
    setMessage("");
  }

  const overview = analytics?.overview;

  const stats = [
    {
      label: "Total Revenue",
      value: formatPrice(overview?.totalRevenuePaise ?? 0),
      icon: CircleDollarSign,
      description: "Captured paid orders",
      style: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Total Orders",
      value: formatNumber(overview?.totalOrders ?? 0),
      icon: ClipboardList,
      description: `${overview?.paidOrders ?? 0} paid orders`,
      style: "bg-blue-50 text-blue-700",
    },
    {
      label: "Customers",
      value: formatNumber(overview?.totalCustomers ?? 0),
      icon: Users,
      description: "Registered customers",
      style: "bg-violet-50 text-violet-700",
    },
    {
      label: "Vendors",
      value: formatNumber(overview?.totalVendors ?? 0),
      icon: Store,
      description: `${overview?.approvedVendors ?? 0} approved vendors`,
      style: "bg-orange-50 text-orange-700",
    },
    {
      label: "Active Products",
      value: formatNumber(overview?.activeProducts ?? 0),
      icon: Package,
      description: "Published marketplace products",
      style: "bg-cyan-50 text-cyan-700",
    },
    {
      label: "Last 30 Days",
      value: formatPrice(
        overview?.last30Days.revenuePaise ?? 0,
      ),
      icon: TrendingUp,
      description: `${overview?.last30Days.orders ?? 0} orders`,
      style: "bg-pink-50 text-pink-700",
    },
  ];

  const maximumRevenue = Math.max(
    1,
    ...(analytics?.dailyRevenue.map(
      (day) => day.revenuePaise,
    ) ?? [1]),
  );

  return (
    <section
      id="admin-dashboard"
      className="mx-auto mt-12 w-full max-w-7xl scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* Dashboard heading */}
      <div className="mb-7">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-indigo-700">
          <BarChart3 className="h-4 w-4" />
          Platform Administration
        </div>

        <h2 className="mt-2 text-2xl font-bold text-[#172b4d] sm:text-3xl">
          Admin Analytics Dashboard
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Monitor marketplace performance, revenue, customers,
          vendors and orders.
        </p>
      </div>

      {/* Login */}
      {!token ? (
        <form
          onSubmit={handleLogin}
          className="mx-auto max-w-xl space-y-4 rounded-2xl bg-slate-50 p-6"
        >
          <h3 className="text-lg font-bold text-slate-800">
            Administrator Login
          </h3>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Email address
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter administrator password"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-600"
            />
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-xl bg-[#172b4d] px-5 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50"
          >
            {loginLoading
              ? "Signing in..."
              : "Access Admin Dashboard"}
          </button>

          <p className="text-xs text-slate-500">
            Only authorized administrator accounts can access
            marketplace analytics.
          </p>
        </form>
      ) : (
        <>
          {/* Admin toolbar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">
                Signed in as administrator
              </p>

              <p className="font-semibold text-slate-800">
                {email}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadAnalytics(token)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
              Loading marketplace analytics...
            </p>
          )}

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Analytics */}
          {analytics && !loading && (
            <>
              {/* Statistics cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <article
                      key={stat.label}
                      className="rounded-2xl border border-slate-200 p-5 transition hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">
                          {stat.label}
                        </span>

                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.style}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>

                      <p className="mt-4 text-2xl font-bold text-[#172b4d]">
                        {stat.value}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {stat.description}
                      </p>
                    </article>
                  );
                })}
              </div>

              {/* Revenue chart */}
              <div className="mt-8 rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-bold text-[#172b4d]">
                  Revenue — Last 7 Days
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Daily captured revenue
                </p>

                {analytics.dailyRevenue.length === 0 ? (
                  <p className="mt-8 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No paid orders recorded during this period.
                  </p>
                ) : (
                  <div className="mt-8 flex h-56 items-end gap-3 overflow-x-auto">
                    {analytics.dailyRevenue.map((day) => {
                      const height = Math.max(
                        6,
                        (day.revenuePaise / maximumRevenue) * 100,
                      );

                      return (
                        <div
                          key={day._id}
                          className="flex min-w-0 flex-1 flex-col items-center gap-2"
                          title={`${formatPrice(day.revenuePaise)} — ${day.orders} orders`}
                        >
                          <span className="text-[10px] font-semibold text-slate-600">
                            {formatPrice(day.revenuePaise)}
                          </span>

                          <div className="flex h-36 w-full items-end">
                            <div
                              className="w-full rounded-t-lg bg-indigo-600 transition-all hover:bg-indigo-800"
                              style={{ height: `${height}%` }}
                            />
                          </div>

                          <span className="text-[10px] text-slate-500">
                            {day._id.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top products and order statuses */}
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                {/* Top products */}
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-lg font-bold text-[#172b4d]">
                    Top Selling Products
                  </h3>

                  <div className="mt-4 space-y-4">
                    {analytics.topProducts.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                        No paid product sales recorded yet.
                      </p>
                    ) : (
                      analytics.topProducts.map((product) => (
                        <div
                          key={product._id}
                          className="border-b border-slate-100 pb-3 last:border-0"
                        >
                          <p className="font-semibold text-slate-800">
                            {product.productName}
                          </p>

                          <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                            <span>
                              {product.quantitySold} units sold
                            </span>

                            <span className="font-semibold text-emerald-700">
                              {formatPrice(product.revenuePaise)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Order statuses */}
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-lg font-bold text-[#172b4d]">
                    Order Status Overview
                  </h3>

                  <div className="mt-4 space-y-3">
                    {analytics.orderStatuses.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                        No orders available.
                      </p>
                    ) : (
                      analytics.orderStatuses.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                        >
                          <span className="text-sm font-medium text-slate-700">
                            {item._id.replaceAll("_", " ")}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#172b4d]">
                            {item.count}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {!analytics && !loading && !error && (
            <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
              No analytics data loaded.
            </p>
          )}
        </>
      )}

      {message && (
        <p className="mt-4 text-sm text-emerald-700">
          {message}
        </p>
      )}
    </section>
  );
}