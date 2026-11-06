
import mongoose from "mongoose";
import { z } from "zod";

import { CartModel } from "../models/cart.model.js";
import type { CartItem } from "../models/cart.model.js";
import { ProductModel } from "../models/product.model.js";
import { VendorModel } from "../models/vendor.model.js";
import { AppError } from "../middleware/app-error.js";

// Validate adding a product to the cart.
const addCartItemSchema = z.object({
  productId: z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    "Invalid product ID.",
  ),
  quantity: z.number().int().min(1).max(99).default(1),
});

// Validate quantity updates.
const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

// Check for duplicate MongoDB errors.
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

// Check whether a product is active and its vendor is approved.
async function getAvailableProduct(productId: string) {
  const product = await ProductModel.findOne({
    _id: new mongoose.Types.ObjectId(productId),
    status: "ACTIVE",
  });

  if (!product) {
    throw new AppError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product is not available.",
    );
  }

  const vendor = await VendorModel.findOne({
    _id: product.vendor,
    status: "APPROVED",
  }).select("_id");

  if (!vendor) {
    throw new AppError(
      404,
      "PRODUCT_NOT_AVAILABLE",
      "This product is currently unavailable.",
    );
  }

  return product;
}

// Get an existing cart or create a new one.
async function getOrCreateCart(userId: string) {
  let cart = await CartModel.findOne({ user: userId });

  if (cart) {
    return cart;
  }

  try {
    cart = await CartModel.create({
      user: userId,
      items: [],
    });

    return cart;
  } catch (error) {
    // Handle simultaneous requests creating the same cart.
    if (isDuplicateKeyError(error)) {
      const existingCart = await CartModel.findOne({
        user: userId,
      });

      if (existingCart) {
        return existingCart;
      }
    }

    throw error;
  }
}

// GET COMPLETE CART WITH CURRENT PRODUCT PRICES.
export async function getCart(userId: string) {
  const cart = await CartModel.findOne({ user: userId });

  if (!cart) {
    return {
      items: [],
      itemCount: 0,
      subtotalPaise: 0,
      currency: "INR",
      canCheckout: false,
    };
  }

  // Explicitly type cart items to avoid implicit-any errors.
  const cartItems: CartItem[] = cart.items as CartItem[];

  const productIds = cartItems.map(
    (item: CartItem) => item.product,
  );

  const products = await ProductModel.find({
    _id: { $in: productIds },
  }).lean();

  const vendorIds = products.map(
    (product) => product.vendor,
  );

  const vendors = await VendorModel.find({
    _id: { $in: vendorIds },
    status: "APPROVED",
  })
    .select("_id storeName storeSlug")
    .lean();

  const productMap = new Map(
    products.map((product) => [
      product._id.toString(),
      product,
    ]),
  );

  const vendorMap = new Map(
    vendors.map((vendor) => [
      vendor._id.toString(),
      vendor,
    ]),
  );

  let subtotalPaise = 0;
  let itemCount = 0;
  let allItemsAvailable = true;

  const items = cartItems.map((cartItem: CartItem) => {
    const productId = cartItem.product.toString();

    const product = productMap.get(productId);

    itemCount += cartItem.quantity;

    // Product no longer exists.
    if (!product) {
      allItemsAvailable = false;

      return {
        productId,
        quantity: cartItem.quantity,
        available: false,
        reason: "PRODUCT_NOT_FOUND",
      };
    }

    const vendor = vendorMap.get(
      product.vendor.toString(),
    );

    // Product or vendor is no longer available.
    if (product.status !== "ACTIVE" || !vendor) {
      allItemsAvailable = false;

      return {
        productId,
        quantity: cartItem.quantity,
        available: false,
        reason: "PRODUCT_UNAVAILABLE",
        name: product.name,
      };
    }

    // Check available inventory.
    if (product.inventoryQuantity < cartItem.quantity) {
      allItemsAvailable = false;

      return {
        productId,
        quantity: cartItem.quantity,
        available: false,
        reason: "INSUFFICIENT_STOCK",
        name: product.name,
        availableStock: product.inventoryQuantity,
        pricePaise: product.pricePaise,
      };
    }

    const lineTotalPaise =
      product.pricePaise * cartItem.quantity;

    subtotalPaise += lineTotalPaise;

    return {
      productId,
      quantity: cartItem.quantity,
      available: true,
      product: {
        name: product.name,
        slug: product.slug,
        category: product.category,
        images: product.images,
      },
      vendor: {
        storeName: vendor.storeName,
        storeSlug: vendor.storeSlug,
      },
      pricePaise: product.pricePaise,
      lineTotalPaise,
      availableStock: product.inventoryQuantity,
    };
  });

  return {
    items,
    itemCount,
    subtotalPaise,
    currency: "INR",
    canCheckout: items.length > 0 && allItemsAvailable,
  };
}

// ADD PRODUCT TO CART.
export async function addToCart(
  userId: string,
  input: unknown,
) {
  const data = addCartItemSchema.parse(input);

  const product = await getAvailableProduct(data.productId);

  const cart = await getOrCreateCart(userId);

  const cartItems: CartItem[] = cart.items as CartItem[];

  const existingItem = cartItems.find(
    (item: CartItem) =>
      item.product.toString() === data.productId,
  );

  const newQuantity =
    (existingItem?.quantity ?? 0) + data.quantity;

  if (newQuantity > 99) {
    throw new AppError(
      400,
      "QUANTITY_LIMIT_EXCEEDED",
      "Maximum quantity per product is 99.",
    );
  }

  if (newQuantity > product.inventoryQuantity) {
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Only ${product.inventoryQuantity} units are available.`,
    );
  }

  if (existingItem) {
    existingItem.quantity = newQuantity;
  } else {
    cartItems.push({
      product: product._id,
      quantity: data.quantity,
    });
  }

  await cart.save();

  return getCart(userId);
}

// UPDATE PRODUCT QUANTITY IN CART.
export async function updateCartItem(
  userId: string,
  productId: string,
  input: unknown,
) {
  const data = updateCartItemSchema.parse(input);

  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError(
      400,
      "INVALID_PRODUCT_ID",
      "The provided product ID is invalid.",
    );
  }

  const cart = await CartModel.findOne({ user: userId });

  if (!cart) {
    throw new AppError(
      404,
      "CART_NOT_FOUND",
      "Shopping cart not found.",
    );
  }

  const cartItems: CartItem[] = cart.items as CartItem[];

  const cartItem = cartItems.find(
    (item: CartItem) =>
      item.product.toString() === productId,
  );

  if (!cartItem) {
    throw new AppError(
      404,
      "CART_ITEM_NOT_FOUND",
      "Product was not found in your cart.",
    );
  }

  const product = await getAvailableProduct(productId);

  if (data.quantity > product.inventoryQuantity) {
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Only ${product.inventoryQuantity} units are available.`,
    );
  }

  cartItem.quantity = data.quantity;

  await cart.save();

  return getCart(userId);
}

// REMOVE ONE PRODUCT FROM CART.
export async function removeFromCart(
  userId: string,
  productId: string,
) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError(
      400,
      "INVALID_PRODUCT_ID",
      "The provided product ID is invalid.",
    );
  }

  const cart = await CartModel.findOne({ user: userId });

  if (!cart) {
    throw new AppError(
      404,
      "CART_NOT_FOUND",
      "Shopping cart not found.",
    );
  }

  const cartItems: CartItem[] = cart.items as CartItem[];

  const originalLength = cartItems.length;

  const remainingItems = cartItems.filter(
    (item: CartItem) =>
      item.product.toString() !== productId,
  );

  if (remainingItems.length === originalLength) {
    throw new AppError(
      404,
      "CART_ITEM_NOT_FOUND",
      "Product was not found in your cart.",
    );
  }

  cart.set("items", remainingItems);

  await cart.save();

  return getCart(userId);
}

// CLEAR ENTIRE SHOPPING CART.
export async function clearCart(userId: string) {
  const cart = await CartModel.findOne({ user: userId });

  if (!cart) {
    return {
      items: [],
      itemCount: 0,
      subtotalPaise: 0,
      currency: "INR",
      canCheckout: false,
    };
  }

  cart.set("items", []);

  await cart.save();

  return getCart(userId);
}
