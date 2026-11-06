
import { Router } from "express";

import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../services/cart.service.js";

import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Customers and approved vendors can use shopping carts.
router.use(
  authenticate,
  requireRoles("CUSTOMER", "VENDOR"),
);

// GET SHOPPING CART
router.get("/", async (request, response) => {
  const result = await getCart(request.auth!.userId);

  response.status(200).json({
    success: true,
    message: "Shopping cart retrieved successfully",
    data: result,
  });
});

// ADD PRODUCT TO CART
router.post("/items", async (request, response) => {
  const result = await addToCart(
    request.auth!.userId,
    request.body,
  );

  response.status(200).json({
    success: true,
    message: "Product added to cart successfully",
    data: result,
  });
});

// UPDATE PRODUCT QUANTITY
router.patch("/items/:productId", async (request, response) => {
  const result = await updateCartItem(
    request.auth!.userId,
    request.params.productId,
    request.body,
  );

  response.status(200).json({
    success: true,
    message: "Cart quantity updated successfully",
    data: result,
  });
});

// REMOVE ONE PRODUCT FROM CART
router.delete("/items/:productId", async (request, response) => {
  const result = await removeFromCart(
    request.auth!.userId,
    request.params.productId,
  );

  response.status(200).json({
    success: true,
    message: "Product removed from cart successfully",
    data: result,
  });
});

// CLEAR ENTIRE CART
router.delete("/", async (request, response) => {
  const result = await clearCart(request.auth!.userId);

  response.status(200).json({
    success: true,
    message: "Shopping cart cleared successfully",
    data: result,
  });
});

export default router;
