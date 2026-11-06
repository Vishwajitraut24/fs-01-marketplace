export type DependencyStatus = "up" | "down";

export interface ReadinessResponse {
  success: boolean;
  data: {
    status: "ready" | "not_ready";
    checks: {
      mongodb: DependencyStatus;
      redis: DependencyStatus;
      elasticsearch: DependencyStatus;
    };
  };
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export async function getReadiness(signal?: AbortSignal): Promise<ReadinessResponse> {
  const response = await fetch(`${API_BASE_URL}/health/ready`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal
  });

  const payload = (await response.json()) as ReadinessResponse;
  if (!response.ok && response.status !== 503) {
    throw new Error(`API returned HTTP ${response.status}`);
  }
  return payload;
}

// API response wrapper.
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

// Customer login response.
export interface CustomerLoginData {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

// Customer order information.
export interface CustomerOrder {
  _id: string;
  orderNumber: string;
  status: string;
  totalPaise: number;
  currency: string;
  payment: {
    method: string;
    status: string;
  };
}

// Razorpay gateway order response.
export interface RazorpayOrderData {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

// Razorpay Checkout success response.
export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Payment verification response.
export interface PaymentVerificationData {
  success: boolean;
  message: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentId: string;
  totalPaise: number;
  currency: string;
}

// Reusable API request helper.
async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.error?.message ??
        payload.message ??
        `API request failed with HTTP ${response.status}`,
    );
  }

  return payload.data;
}

// Customer login.
export function loginCustomer(
  email: string,
  password: string,
) {
  return apiRequest<CustomerLoginData>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

// Retrieve customer orders.
export function getCustomerOrders(token: string) {
  return apiRequest<{
    items: CustomerOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>("/orders?page=1&limit=50", { token });
}
// ==========================================
// CUSTOMER CHECKOUT AND ORDER CREATION
// ==========================================

export type CustomerPaymentMethod =
  | "CASH_ON_DELIVERY"
  | "RAZORPAY";

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateCustomerOrderInput {
  paymentMethod: CustomerPaymentMethod;
  shippingAddress: ShippingAddressInput;
}

// ==========================================
// CUSTOMER CHECKOUT AND ORDER CREATION
// ==========================================

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateCustomerOrderInput {
  paymentMethod: CustomerPaymentMethod;
  shippingAddress: ShippingAddressInput;
}

// Create a new order from the customer's cart.
export function createCustomerOrder(
  token: string,
  input: CreateCustomerOrderInput,
) {
  return apiRequest<CustomerOrder>("/orders", {
    method: "POST",
    token,
    body: input,
  });
}
// Create Razorpay gateway order.
export function createRazorpayOrder(
  token: string,
  orderId: string,
) {
  return apiRequest<RazorpayOrderData>(
    "/payments/razorpay/order",
    {
      method: "POST",
      token,
      body: { orderId },
    },
  );
}

// Verify Razorpay payment on the backend.
export function verifyRazorpayPayment(
  token: string,
  orderId: string,
  payment: RazorpayCheckoutResponse,
) {
  return apiRequest<PaymentVerificationData>(
    "/payments/razorpay/verify",
    {
      method: "POST",
      token,
      body: {
        orderId,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      },
    },
  );
}

// ==========================================
// PUBLIC PRODUCT CATALOG API
// ==========================================

// Product information returned by the public API.
export interface PublicProduct {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  brand?: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  currency: string;

  images: {
    url: string;
    altText: string;
  }[];

  inStock: boolean;

  vendor?: {
    _id: string;
    storeName: string;
    storeSlug: string;
  };
}

// Product catalog response.
export interface PublicProductCatalog {
  items: PublicProduct[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Product search and filtering options.
export interface ProductCatalogFilters {
  q?: string;
  category?: string;

  sort?: "newest" | "price_asc" | "price_desc";

  page?: number;
  limit?: number;
}

// Retrieve products from the public marketplace catalog.
export function getPublicProducts(
  filters: ProductCatalogFilters = {},
) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  params.set("sort", filters.sort ?? "newest");
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 12));

  return apiRequest<PublicProductCatalog>(
    `/catalog/products?${params.toString()}`,
  );
}

// ==========================================
// CUSTOMER CART API
// ==========================================

export interface CustomerCartItem {
  productId: string;
  quantity: number;
  available: boolean;

  name?: string;
  reason?: string;

  product?: {
    name: string;
    slug: string;
    category: string;
    images: {
      url: string;
      altText?: string;
    }[];
  };

  vendor?: {
    storeName: string;
    storeSlug: string;
  };

  pricePaise?: number;
  lineTotalPaise?: number;
  availableStock?: number;
}

export interface CustomerCart {
  items: CustomerCartItem[];
  itemCount: number;
  subtotalPaise: number;
  currency: string;
  canCheckout: boolean;
}

export function getCustomerCart(token: string) {
  return apiRequest<CustomerCart>("/cart", { token });
}

export function addCustomerCartItem(
  token: string,
  productId: string,
  quantity = 1,
) {
  return apiRequest<CustomerCart>("/cart/items", {
    method: "POST",
    token,
    body: { productId, quantity },
  });
}

export function updateCustomerCartItem(
  token: string,
  productId: string,
  quantity: number,
) {
  return apiRequest<CustomerCart>(`/cart/items/${productId}`, {
    method: "PATCH",
    token,
    body: { quantity },
  });
}

export function removeCustomerCartItem(
  token: string,
  productId: string,
) {
  return apiRequest<CustomerCart>(`/cart/items/${productId}`, {
    method: "DELETE",
    token,
  });
}

export function clearCustomerCart(token: string) {
  return apiRequest<CustomerCart>("/cart", {
    method: "DELETE",
    token,
  });
}
// ==========================================
// VENDOR ORDER MANAGEMENT API
// ==========================================

export type VendorFulfillmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface VendorOrderItem {
  productId: string;
  vendorId: string;
  productName: string;
  productSlug: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface VendorSellerOrder {
  _id?: string;
  vendorId: string;
  storeName: string;
  storeSlug: string;
  fulfillmentStatus: VendorFulfillmentStatus;
  items: VendorOrderItem[];
  subtotalPaise: number;
}

export interface VendorOrder {
  _id: string;
  orderNumber: string;
  orderStatus: string;

  payment: {
    method: string;
    status: string;
  };

  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  sellerOrder: VendorSellerOrder;
  createdAt: string;
}

export interface VendorOrdersResponse {
  items: VendorOrder[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VendorOrderStatusUpdate {
  orderId: string;
  orderNumber: string;
  orderStatus: string;

  sellerOrder: {
    vendorId: string;
    storeName: string;
    fulfillmentStatus: VendorFulfillmentStatus;
    subtotalPaise: number;
    items: VendorOrderItem[];
  };
}

// Retrieve orders belonging to the logged-in vendor.
export function getVendorOrders(token: string) {
  return apiRequest<VendorOrdersResponse>(
    "/vendor/orders?page=1&limit=100",
    { token },
  );
}

// Update the fulfillment status of a vendor order.
export function updateVendorOrderStatus(
  token: string,
  orderId: string,
  status: VendorFulfillmentStatus,
) {
  return apiRequest<VendorOrderStatusUpdate>(
    `/vendor/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      token,
      body: { status },
    },
  );
}