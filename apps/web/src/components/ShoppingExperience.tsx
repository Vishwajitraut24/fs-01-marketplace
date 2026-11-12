import { useState } from "react";
import type { FormEvent } from "react";

import {
  loginCustomer,
  getCustomerCart,
  addCustomerCartItem,
  updateCustomerCartItem,
  removeCustomerCartItem,
  clearCustomerCart,
  createCustomerOrder,
  getCustomerOrders,
  downloadCustomerInvoice,
} from "../lib/api";

import type {
  CustomerCart,
  CustomerOrder,
  CustomerPaymentMethod,
  ShippingAddressInput,
} from "../lib/api";

import ProductCatalog from "./ProductCatalog";

function formatPrice(pricePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(pricePaise / 100);
}

export default function ShoppingExperience() {
  // Authentication
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);

  // Cart
  const [cart, setCart] = useState<CustomerCart | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [cartActionId, setCartActionId] = useState<string | null>(null);

  // Login
  const [loginLoading, setLoginLoading] = useState(false);

  // Checkout
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod>("CASH_ON_DELIVERY");

  const [couponCode, setCouponCode] = useState("");

  const [downloadingInvoiceId, setDownloadingInvoiceId] =
  useState<string | null>(null);

  const [shippingAddress, setShippingAddress] =
    useState<ShippingAddressInput>({
      fullName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
    });

  // Order history
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] =
    useState<CustomerOrder | null>(null);

  // Feedback
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==========================================
  // CART FUNCTIONS
  // ==========================================

  async function loadCart(accessToken: string) {
    setCartLoading(true);

    try {
      const result = await getCustomerCart(accessToken);
      setCart(result);
    } finally {
      setCartLoading(false);
    }
  }

  async function loadOrders(accessToken: string) {
    setOrdersLoading(true);

    try {
      const result = await getCustomerOrders(accessToken);
      setOrders(result.items);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function handleDownloadInvoice(orderId: string) {
  if (!token) return;

  setDownloadingInvoiceId(orderId);
  setError("");

  try {
    await downloadCustomerInvoice(token, orderId);
    setMessage("Invoice downloaded successfully.");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to download invoice.",
    );
  } finally {
    setDownloadingInvoiceId(null);
  }
}

  // ==========================================
  // CUSTOMER LOGIN
  // ==========================================

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoginLoading(true);

    try {
      const result = await loginCustomer(email.trim(), password);

      if (
        result.user.role !== "CUSTOMER" &&
        result.user.role !== "VENDOR"
      ) {
        throw new Error(
          "This account cannot use customer shopping.",
        );
      }

      setToken(result.accessToken);
      setEmail(result.user.email);
      setPassword("");

      setMessage("Sign in successful.");

      try {
        await loadCart(result.accessToken);
      } catch (cartError) {
        setError(
          cartError instanceof Error
            ? `Signed in, but unable to load cart: ${cartError.message}`
            : "Signed in, but unable to load cart.",
        );
      }

      try {
        await loadOrders(result.accessToken);
      } catch (ordersError) {
        setError(
          ordersError instanceof Error
            ? `Signed in, but unable to load order history: ${ordersError.message}`
            : "Unable to load order history.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  // ==========================================
  // ADD PRODUCT TO CART
  // ==========================================

  async function handleAddToCart(productId: string) {
    if (!token) {
      setError("Please sign in before adding products to your cart.");

      document
        .getElementById("customer-login")
        ?.scrollIntoView({ behavior: "smooth" });

      return;
    }

    setAddingProductId(productId);
    setError("");
    setMessage("");

    try {
      const updatedCart = await addCustomerCartItem(
        token,
        productId,
        1,
      );

      setCart(updatedCart);
      setMessage("Product added to your cart.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add this product.",
      );
    } finally {
      setAddingProductId(null);
    }
  }

  // ==========================================
  // UPDATE QUANTITY
  // ==========================================

  async function handleQuantityChange(
    productId: string,
    quantity: number,
  ) {
    if (!token || cartActionId) return;

    setCartActionId(productId);
    setError("");
    setMessage("");

    try {
      if (quantity <= 0) {
        const updatedCart = await removeCustomerCartItem(
          token,
          productId,
        );

        setCart(updatedCart);
        setMessage("Product removed from your cart.");
      } else {
        const updatedCart = await updateCustomerCartItem(
          token,
          productId,
          quantity,
        );

        setCart(updatedCart);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your cart.",
      );
    } finally {
      setCartActionId(null);
    }
  }

  // ==========================================
  // REMOVE PRODUCT
  // ==========================================

  async function handleRemove(productId: string) {
    if (!token || cartActionId) return;

    setCartActionId(productId);
    setError("");
    setMessage("");

    try {
      const updatedCart = await removeCustomerCartItem(
        token,
        productId,
      );

      setCart(updatedCart);
      setMessage("Product removed from your cart.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove this product.",
      );
    } finally {
      setCartActionId(null);
    }
  }

  // ==========================================
  // CLEAR CART
  // ==========================================

  async function handleClearCart() {
    if (!token) return;

    setError("");
    setMessage("");

    try {
      const updatedCart = await clearCustomerCart(token);
      setCart(updatedCart);
      setMessage("Your cart has been cleared.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to clear your cart.",
      );
    }
  }

  // ==========================================
  // SHIPPING ADDRESS UPDATE
  // ==========================================

  function handleAddressChange(
  field: keyof ShippingAddressInput,
  value: string,
): void {
  setShippingAddress((current: ShippingAddressInput) => ({
    ...current,
    [field]: value,
  }));
}

  // ==========================================
  // CREATE CUSTOMER ORDER
  // ==========================================

  async function handleCreateOrder(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!token) {
      setError("Please sign in before placing an order.");
      return;
    }

    if (!cart || cart.items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!cart.canCheckout) {
      setError(
        "Some products are unavailable or have insufficient stock.",
      );
      return;
    }

    setCreatingOrder(true);
    setError("");
    setMessage("");
    setLastCreatedOrder(null);

    try {
     const order = await createCustomerOrder(token, {
  paymentMethod,
  couponCode: couponCode.trim().toUpperCase() || undefined,
  shippingAddress: {
          ...shippingAddress,
          addressLine2:
            shippingAddress.addressLine2?.trim() || undefined,
          landmark:
            shippingAddress.landmark?.trim() || undefined,
        },
      });

      setLastCreatedOrder(order);
      setCouponCode("");

      // The backend clears the cart after successful order creation.
      setCart({
        items: [],
        itemCount: 0,
        subtotalPaise: 0,
        currency: "INR",
        canCheckout: false,
      });

      if (paymentMethod === "CASH_ON_DELIVERY") {
        setMessage(
          `Order ${order.orderNumber} placed successfully. Payment is due on delivery.`,
        );
      } else {
        setMessage(
          `Order ${order.orderNumber} created. Complete payment through the Razorpay Test Checkout section below.`,
        );
      }

      // Refresh cart and order history independently.
      try {
        await Promise.all([
          loadCart(token),
          loadOrders(token),
        ]);
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Order created, but refreshing the page data failed: ${refreshError.message}`
            : "Order created, but page data could not be refreshed.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your order.",
      );
    } finally {
      setCreatingOrder(false);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  function handleLogout() {
    setToken(null);
    setCart(null);
    setOrders([]);
    setPassword("");
    setMessage("");
    setError("");
    setLastCreatedOrder(null);
  }

  const cartCount =
    cart?.items.reduce(
      (total, item) => total + item.quantity,
      0,
    ) ?? 0;

  // ==========================================
  // UI
  // ==========================================

  return (
    <>
      {/* CUSTOMER LOGIN */}
      <section
        id="customer-login"
        className="mx-auto mt-12 w-full max-w-4xl scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Customer account
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[#172b4d]">
            {token
              ? "Welcome to your marketplace account"
              : "Sign in to shop"}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to add products, manage your cart and place orders.
          </p>
        </div>

        {token ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="font-semibold text-slate-800">{email}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleLogin}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="shopping-email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="shopping-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="shopping-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="shopping-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-xl bg-[#172b4d] px-5 py-3 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginLoading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        )}

        {message && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </section>

      {/* PRODUCT CATALOG */}
        <ProductCatalog
        onAddToCart={handleAddToCart}
        addingProductId={addingProductId}
        token={token}
       />

      {/* SHOPPING CART */}
      <section
        id="cart"
        className="mx-auto mt-12 w-full max-w-5xl scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Your shopping bag
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#172b4d]">
              Shopping Cart ({cartCount})
            </h2>
          </div>

          {token && cartCount > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              className="text-sm font-semibold text-red-600 hover:text-red-800"
            >
              Clear cart
            </button>
          )}
        </div>

        {!token ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            Sign in above to view and manage your shopping cart.
          </p>
        ) : cartLoading ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            Loading your cart...
          </p>
        ) : !cart || cart.items.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-5 py-10 text-center">
            <p className="font-semibold text-slate-800">
              Your shopping cart is empty.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Explore the products above and add something you like.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {cart.items.map((item) => {
                const productName =
                  item.product?.name ??
                  item.name ??
                  "Unavailable product";

                const productImage = item.product?.images?.[0];

                return (
                  <div
                    key={item.productId}
                    className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                      {productImage?.url ? (
                        <img
                          src={productImage.url}
                          alt={productImage.altText || productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          No image
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">
                        {productName}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {item.vendor?.storeName ?? "Marketplace seller"}
                      </p>

                      <p className="mt-1 font-semibold text-[#172b4d]">
                        {typeof item.pricePaise === "number"
                          ? formatPrice(item.pricePaise)
                          : "Price unavailable"}
                      </p>

                      {!item.available && (
                        <p className="mt-1 text-xs text-amber-700">
                          {item.reason === "INSUFFICIENT_STOCK"
                            ? `Only ${item.availableStock ?? 0} units available.`
                            : "This product is currently unavailable."}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={cartActionId === item.productId}
                        onClick={() =>
                          void handleQuantityChange(
                            item.productId,
                            item.quantity - 1,
                          )
                        }
                        aria-label={`Decrease quantity of ${productName}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        −
                      </button>

                      <span className="min-w-6 text-center font-semibold">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        disabled={cartActionId === item.productId}
                        onClick={() =>
                          void handleQuantityChange(
                            item.productId,
                            item.quantity + 1,
                          )
                        }
                        aria-label={`Increase quantity of ${productName}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:w-32 sm:flex-col sm:items-end">
                      <p className="font-bold text-slate-900">
                        {typeof item.lineTotalPaise === "number"
                          ? formatPrice(item.lineTotalPaise)
                          : "—"}
                      </p>

                      <button
                        type="button"
                        disabled={cartActionId === item.productId}
                        onClick={() => void handleRemove(item.productId)}
                        className="text-sm font-medium text-red-600 transition hover:text-red-800 disabled:opacity-40"
                      >
                        {cartActionId === item.productId
                          ? "Updating..."
                          : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between text-lg font-bold text-[#172b4d]">
                <span>Subtotal</span>
                <span>{formatPrice(cart.subtotalPaise)}</span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Shipping and final charges are calculated during checkout.
              </p>

              {!cart.canCheckout && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Some products are unavailable or have insufficient stock.
                  Review your cart before checkout.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* CUSTOMER CHECKOUT FORM */}
      {token && cart && cart.items.length > 0 && (
        <section
          id="checkout"
          className="mx-auto mt-12 w-full max-w-5xl scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Secure checkout
            </p>

            <h2 className="mt-2 text-2xl font-bold text-[#172b4d]">
              Delivery information
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Enter your delivery address and select a payment method.
            </p>
          </div>

          <form onSubmit={handleCreateOrder} className="space-y-6">
            {/* Address fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Full name *
                </label>

                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={shippingAddress.fullName}
                  onChange={(event) =>
                    handleAddressChange("fullName", event.target.value)
                  }
                  placeholder="Enter recipient's full name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Phone number *
                </label>

                <input
                  type="tel"
                  required
                  minLength={7}
                  maxLength={20}
                  value={shippingAddress.phone}
                  onChange={(event) =>
                    handleAddressChange("phone", event.target.value)
                  }
                  placeholder="Enter contact number"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold">
                  Address line 1 *
                </label>

                <input
                  required
                  minLength={5}
                  maxLength={200}
                  value={shippingAddress.addressLine1}
                  onChange={(event) =>
                    handleAddressChange("addressLine1", event.target.value)
                  }
                  placeholder="House number, building, street"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Address line 2
                </label>

                <input
                  maxLength={200}
                  value={shippingAddress.addressLine2}
                  onChange={(event) =>
                    handleAddressChange("addressLine2", event.target.value)
                  }
                  placeholder="Area, locality (optional)"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Landmark
                </label>

                <input
                  maxLength={120}
                  value={shippingAddress.landmark}
                  onChange={(event) =>
                    handleAddressChange("landmark", event.target.value)
                  }
                  placeholder="Nearby landmark (optional)"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  City *
                </label>

                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={shippingAddress.city}
                  onChange={(event) =>
                    handleAddressChange("city", event.target.value)
                  }
                  placeholder="City"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  State *
                </label>

                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={shippingAddress.state}
                  onChange={(event) =>
                    handleAddressChange("state", event.target.value)
                  }
                  placeholder="State"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Postal code *
                </label>

                <input
                  required
                  minLength={3}
                  maxLength={12}
                  value={shippingAddress.postalCode}
                  onChange={(event) =>
                    handleAddressChange("postalCode", event.target.value)
                  }
                  placeholder="PIN code"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Country *
                </label>

                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={shippingAddress.country}
                  onChange={(event) =>
                    handleAddressChange("country", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600"
                />
              </div>
            </div>
                  {/* COUPON CODE */}
<div className="border-t border-slate-100 pt-6">
  <h3 className="mb-3 text-lg font-semibold text-[#172b4d]">
    Apply Coupon
  </h3>

  <input
    type="text"
    value={couponCode}
    onChange={(event) =>
      setCouponCode(event.target.value.toUpperCase())
    }
    placeholder="Enter coupon code"
    maxLength={40}
    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none focus:border-blue-600 md:max-w-md"
  />

  <p className="mt-2 text-xs text-slate-500">
    Available discounts will be validated automatically during checkout.
  </p>
</div>
            {/* Payment method */}
            <div className="border-t border-slate-100 pt-6">
              <h3 className="mb-4 text-lg font-semibold text-[#172b4d]">
                Select payment method
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    paymentMethod === "CASH_ON_DELIVERY"
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CASH_ON_DELIVERY"
                      checked={paymentMethod === "CASH_ON_DELIVERY"}
                      onChange={() =>
                        setPaymentMethod("CASH_ON_DELIVERY")
                      }
                      className="mt-1"
                    />

                    <div>
                      <p className="font-semibold text-slate-900">
                        Cash on Delivery
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Pay when your order arrives.
                      </p>
                    </div>
                  </div>
                </label>

                <label
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    paymentMethod === "RAZORPAY"
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="RAZORPAY"
                      checked={paymentMethod === "RAZORPAY"}
                      onChange={() => setPaymentMethod("RAZORPAY")}
                      className="mt-1"
                    />

                    <div>
                      <p className="font-semibold text-slate-900">
                        Razorpay
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Pay online using the test checkout integration.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Order total */}
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Items subtotal
                </span>

                <span className="font-semibold text-slate-900">
                  {formatPrice(cart.subtotalPaise)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="font-bold text-[#172b4d]">
                  Total payable
                </span>

                <span className="text-xl font-bold text-[#172b4d]">
                  {formatPrice(cart.subtotalPaise)}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Shipping and discounts are currently set to zero by the backend.
              </p>
            </div>

            <button
              type="submit"
              disabled={creatingOrder || !cart.canCheckout}
              className="w-full rounded-xl bg-[#172b4d] px-5 py-4 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingOrder
                ? "Creating your order..."
                : paymentMethod === "CASH_ON_DELIVERY"
                  ? "Place COD Order"
                  : "Create Razorpay Order"}
            </button>
          </form>

          {lastCreatedOrder && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-800">
                Order created successfully
              </p>

              <p className="mt-2 text-sm text-emerald-700">
                Order number: {lastCreatedOrder.orderNumber}
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                Status: {lastCreatedOrder.status}
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                Payment: {lastCreatedOrder.payment.status}
              </p>
              {(lastCreatedOrder.discountPaise ?? 0) > 0 && (
  <div className="mt-2 text-sm text-emerald-800">
    <p>
      Coupon applied: {lastCreatedOrder.couponCode}
    </p>
    <p>
      Discount: {formatPrice(lastCreatedOrder.discountPaise!)}
    </p>
    <p>
      Final amount: {formatPrice(lastCreatedOrder.totalPaise)}
    </p>
  </div>
)}

              {lastCreatedOrder.payment.method === "RAZORPAY" && (
                <p className="mt-3 text-sm text-emerald-800">
                  Go to the Razorpay Test Checkout section below to complete
                  your online test payment.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* CUSTOMER ORDER HISTORY */}
      {token && (
        <section
          id="order-history"
          className="mx-auto mt-12 w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Your purchases
              </p>

              <h2 className="mt-2 text-2xl font-bold text-[#172b4d]">
                Order history
              </h2>
            </div>

            <button
              type="button"
              onClick={() => void loadOrders(token)}
              disabled={ordersLoading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {ordersLoading ? "Refreshing..." : "Refresh orders"}
            </button>
          </div>

          {ordersLoading ? (
            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              Loading your order history...
            </p>
          ) : orders.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              You have not placed any orders yet.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {order.orderNumber}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {order.payment.method.replaceAll("_", " ")}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Order status: {order.status}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Payment status: {order.payment.status}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-[#172b4d]">
                      {formatPrice(order.totalPaise)}
                    </p>

                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.status}
                    </span>
                  </div>
                  {order.status !== "PENDING_PAYMENT" &&
  order.status !== "CANCELLED" && (
    <button
      type="button"
      onClick={() => void handleDownloadInvoice(order._id)}
      disabled={downloadingInvoiceId === order._id}
      className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
    >
      {downloadingInvoiceId === order._id
        ? "Downloading..."
        : "Download Invoice"}
    </button>
  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}