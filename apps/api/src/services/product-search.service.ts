
import { elasticsearch } from "../infrastructure/elasticsearch.js";
import { logger } from "../infrastructure/logger.js";
import { ProductModel } from "../models/product.model.js";
import { VendorModel } from "../models/vendor.model.js";

// Dedicated Elasticsearch index for marketplace products.
export const PRODUCT_SEARCH_INDEX = "fs01_products";

// Create the product search index if it does not exist.
export async function ensureProductSearchIndex(): Promise<void> {
  const exists = await elasticsearch.indices.exists({
    index: PRODUCT_SEARCH_INDEX,
  });

  if (exists) {
    logger.info("Product search index already exists");
    return;
  }

  await elasticsearch.indices.create({
    index: PRODUCT_SEARCH_INDEX,

    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },

    mappings: {
      properties: {
        name: {
          type: "text",
          fields: {
            keyword: { type: "keyword" },
          },
        },

        slug: {
          type: "keyword",
        },

        description: {
          type: "text",
        },

        category: {
          type: "text",
          fields: {
            keyword: { type: "keyword" },
          },
        },

        brand: {
          type: "text",
          fields: {
            keyword: { type: "keyword" },
          },
        },

        vendorId: {
          type: "keyword",
        },

        vendorStoreName: {
          type: "text",
        },

        vendorStoreSlug: {
          type: "keyword",
        },

        pricePaise: {
          type: "integer",
        },

        compareAtPricePaise: {
          type: "integer",
        },

        currency: {
          type: "keyword",
        },

        inventoryQuantity: {
          type: "integer",
        },

        inStock: {
          type: "boolean",
        },

        status: {
          type: "keyword",
        },

        publishedAt: {
          type: "date",
        },

        createdAt: {
          type: "date",
        },
      },
    },
  });

  logger.info("Product search index created successfully");
}

// Remove a product from Elasticsearch.
async function removeProductFromIndex(
  productId: string,
): Promise<void> {
  try {
    await elasticsearch.delete({
      index: PRODUCT_SEARCH_INDEX,
      id: productId,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "meta" in error
        ? (
            error as {
              meta?: { statusCode?: number };
            }
          ).meta?.statusCode
        : undefined;

    // A missing document is already in the desired state.
    if (statusCode !== 404) {
      throw error;
    }
  }
}

// Convert a MongoDB product into an Elasticsearch document.
function createSearchDocument(
  product: {
    _id: unknown;
    vendor: unknown;
    name: string;
    slug: string;
    description: string;
    category: string;
    brand?: string;
    pricePaise: number;
    compareAtPricePaise?: number;
    currency: string;
    inventoryQuantity: number;
    status: string;
    publishedAt?: Date;
    createdAt: Date;
  },
  vendor: {
    storeName: string;
    storeSlug: string;
  },
) {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    brand: product.brand ?? "",

    vendorId: String(product.vendor),
    vendorStoreName: vendor.storeName,
    vendorStoreSlug: vendor.storeSlug,

    pricePaise: product.pricePaise,
    compareAtPricePaise: product.compareAtPricePaise,
    currency: product.currency,

    inventoryQuantity: product.inventoryQuantity,
    inStock: product.inventoryQuantity > 0,

    status: product.status,

    publishedAt: product.publishedAt ?? product.createdAt,
    createdAt: product.createdAt,
  };
}

// Synchronize one product with Elasticsearch.
export async function syncProductToSearch(
  productId: string,
): Promise<void> {
  try {
    const product = await ProductModel.findById(productId)
      .lean()
      .exec();

    if (!product || product.status !== "ACTIVE") {
      await removeProductFromIndex(productId);
      return;
    }

    const vendor = await VendorModel.findById(product.vendor)
      .select("status storeName storeSlug")
      .lean()
      .exec();

    if (!vendor || vendor.status !== "APPROVED") {
      await removeProductFromIndex(productId);
      return;
    }

    await elasticsearch.index({
      index: PRODUCT_SEARCH_INDEX,
      id: String(product._id),

      document: createSearchDocument(
        product,
        vendor,
      ),
    });

    logger.info(
      { productId },
      "Product synchronized with Elasticsearch",
    );
  } catch (error) {
    // Do not fail a successful MongoDB product operation
    // just because Elasticsearch synchronization failed.
    logger.error(
      { error, productId },
      "Product Elasticsearch synchronization failed",
    );
  }
}

// Synchronize all active products belonging to one vendor.
export async function syncVendorProducts(
  vendorId: string,
): Promise<void> {
  try {
    const vendor = await VendorModel.findById(vendorId)
      .select("status storeName storeSlug")
      .lean()
      .exec();

    if (!vendor || vendor.status !== "APPROVED") {
      await elasticsearch.deleteByQuery({
        index: PRODUCT_SEARCH_INDEX,
        query: {
          term: {
            vendorId,
          },
        },
      });

      logger.info(
        { vendorId },
        "Vendor products removed from Elasticsearch",
      );

      return;
    }

    const products = await ProductModel.find({
      vendor: vendor._id,
      status: "ACTIVE",
    })
      .lean()
      .exec();

    for (const product of products) {
      await elasticsearch.index({
        index: PRODUCT_SEARCH_INDEX,
        id: String(product._id),

        document: createSearchDocument(
          product,
          vendor,
        ),
      });
    }

    logger.info(
      {
        vendorId,
        indexedProducts: products.length,
      },
      "Vendor products synchronized with Elasticsearch",
    );
  } catch (error) {
    logger.error(
      { error, vendorId },
      "Vendor Elasticsearch synchronization failed",
    );
  }
}
// Index all active products from approved vendors.
export async function syncAllApprovedVendorProducts(): Promise<void> {
  try {
    const approvedVendors = await VendorModel.find({
      status: "APPROVED",
    })
      .select("_id")
      .lean();

    for (const vendor of approvedVendors) {
      await syncVendorProducts(String(vendor._id));
    }

    logger.info(
      `Elasticsearch product backfill completed for ${approvedVendors.length} approved vendors`,
    );
  } catch (error) {
    logger.error(
      { err: error },
      "Failed to backfill products into Elasticsearch",
    );
    throw error;
  }
}
// Search product IDs using Elasticsearch.
export async function searchProductIds(
  query: string,
): Promise<string[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  try {
    const response = await elasticsearch.search({
      index: PRODUCT_SEARCH_INDEX,
      size: 10000,
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: normalizedQuery,
                fields: [
                  "name^3",
                  "brand^2",
                  "category^2",
                  "description",
                ],
                type: "best_fields",
                fuzziness: "AUTO",
              },
            },
          ],
          filter: [
            {
              term: {
                status: "ACTIVE",
              },
            },
          ],
        },
      },
    });

  return response.hits.hits
  .map((hit) => hit._id)
  .filter((id): id is string => typeof id === "string");
  } catch (error) {
    logger.error(
      { err: error },
      "Elasticsearch product search failed",
    );

    return [];
  }
}