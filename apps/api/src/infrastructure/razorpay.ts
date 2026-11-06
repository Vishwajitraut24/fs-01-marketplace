
import Razorpay from "razorpay";

import { env } from "../config/env.js";

// Initialize Razorpay using server-side credentials.
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});
