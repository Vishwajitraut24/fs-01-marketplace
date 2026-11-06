
import mongoose, { Schema } from "mongoose";

// Structure of each item inside the shopping cart.
export interface CartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
}

// Complete shopping cart structure.
export interface Cart {
  user: mongoose.Types.ObjectId;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

// Cart item schema.
const cartItemSchema = new Schema<CartItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Cart quantity must be a whole number.",
      },
    },
  },
  {
    _id: false,
  },
);

// Main cart schema.
const cartSchema = new Schema<Cart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// One cart per customer.
cartSchema.index({ user: 1 }, { unique: true });

export const CartModel =
  mongoose.models.Cart ||
  mongoose.model<Cart>("Cart", cartSchema);
