
import { Router } from "express";

import {
  getPublicProducts,
  getPublicProductById,
} from "../services/catalog.service.js";

const router = Router();

// GET PUBLIC PRODUCT CATALOG
// Example: /api/v1/catalog/products?page=1&limit=20
router.get("/products", async (request, response) => {
  const result = await getPublicProducts(request.query);

  response.status(200).json({
    success: true,
    message: "Products retrieved successfully",
    data: result,
  });
});

// GET SINGLE PRODUCT DETAILS
// Example: /api/v1/catalog/products/PRODUCT_ID
router.get("/products/:productId", async (request, response) => {
  const product = await getPublicProductById(
    request.params.productId,
  );

  response.status(200).json({
    success: true,
    message: "Product details retrieved successfully",
    data: product,
  });
});

export default router;
