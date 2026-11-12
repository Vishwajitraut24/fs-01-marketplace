import { OrderModel } from "../models/order.model.js";
import { UserModel } from "../models/user.model.js";
import { VendorModel } from "../models/vendor.model.js";
import { ProductModel } from "../models/product.model.js";

export async function getAdminAnalytics() {
  const now = new Date();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalOrders,
    paidOrders,
    totalCustomers,
    totalVendors,
    approvedVendors,
    activeProducts,
    revenueResult,
    recentRevenue,
    dailyRevenue,
    topProducts,
    orderStatuses,
  ] = await Promise.all([
    OrderModel.countDocuments(),

    OrderModel.countDocuments({
      "payment.status": "PAID",
    }),

    UserModel.countDocuments({
      role: "CUSTOMER",
    }),

    VendorModel.countDocuments(),

    VendorModel.countDocuments({
      status: "APPROVED",
    }),

    ProductModel.countDocuments({
      status: "ACTIVE",
    }),

    OrderModel.aggregate([
      {
        $match: {
          "payment.status": "PAID",
          status: { $ne: "CANCELLED" },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenuePaise: {
            $sum: "$totalPaise",
          },
        },
      },
    ]),

    OrderModel.aggregate([
      {
        $match: {
          "payment.status": "PAID",
          status: { $ne: "CANCELLED" },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          revenuePaise: { $sum: "$totalPaise" },
          orders: { $sum: 1 },
        },
      },
    ]),

    OrderModel.aggregate([
      {
        $match: {
          "payment.status": "PAID",
          status: { $ne: "CANCELLED" },
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          revenuePaise: {
            $sum: "$totalPaise",
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    OrderModel.aggregate([
      {
        $match: {
          "payment.status": "PAID",
          status: { $ne: "CANCELLED" },
        },
      },
      { $unwind: "$sellerOrders" },
      { $unwind: "$sellerOrders.items" },
      {
        $group: {
          _id: "$sellerOrders.items.productId",
          productName: {
            $first: "$sellerOrders.items.productName",
          },
          quantitySold: {
            $sum: "$sellerOrders.items.quantity",
          },
          revenuePaise: {
            $sum: "$sellerOrders.items.lineTotalPaise",
          },
        },
      },
      { $sort: { revenuePaise: -1 } },
      { $limit: 5 },
    ]),

    OrderModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    overview: {
      totalOrders,
      paidOrders,
      totalCustomers,
      totalVendors,
      approvedVendors,
      activeProducts,

      totalRevenuePaise:
        revenueResult[0]?.totalRevenuePaise ?? 0,

      last30Days: {
        revenuePaise:
          recentRevenue[0]?.revenuePaise ?? 0,
        orders:
          recentRevenue[0]?.orders ?? 0,
      },
    },

    dailyRevenue,

    topProducts,

    orderStatuses,
  };
}