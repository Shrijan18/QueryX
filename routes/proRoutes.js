
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import db from "../config/db.js";

const router = express.Router();

const PLAN_AMOUNT = 9900; // ₹99 in paise
const PLAN_DURATION_DAYS = 30;

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

function requireLogin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Please log in first." });
    }
    next();
}

// Get current user's Pro status
router.get("/api/pro/status", requireLogin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT plan, started_at, expires_at
             FROM subscriptions
             WHERE user_id = $1`,
            [req.user.id]
        );

        const subscription = result.rows[0];

        const isPro = Boolean(
            subscription &&
            subscription.plan === "pro" &&
            subscription.expires_at &&
            new Date(subscription.expires_at) > new Date()
        );

        res.json({
            isPro,
            plan: isPro ? "pro" : "free",
            expiresAt: isPro ? subscription.expires_at : null
        });
    } catch (error) {
        console.error("Pro status error:", error);
        res.status(500).json({ error: "Could not fetch subscription status." });
    }
});

// Create Razorpay order
router.post("/api/pro/create-order", requireLogin, async (req, res) => {
    try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ error: "Payment gateway is not configured." });
        }

        const order = await razorpay.orders.create({
            amount: PLAN_AMOUNT,
            currency: "INR",
            receipt: `qx_${req.user.id}_${Date.now()}`,
            notes: {
                user_id: String(req.user.id),
                plan: "queryx_pro",
                duration_days: String(PLAN_DURATION_DAYS)
            }
        });

        await db.query(
            `INSERT INTO pro_orders
             (user_id, razorpay_order_id, amount, currency, status)
             VALUES ($1, $2, $3, $4, 'created')`,
            [req.user.id, order.id, PLAN_AMOUNT, "INR"]
        );

        res.json({
            orderId: order.id,
            amount: PLAN_AMOUNT,
            currency: "INR",
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({ error: "Unable to create payment order." });
    }
});

// Verify payment and activate Pro
router.post("/api/pro/verify-payment", requireLogin, async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing payment details." });
    }

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        // Find the order belonging to this logged-in user.
        const orderResult = await client.query(
            `SELECT * FROM pro_orders
             WHERE razorpay_order_id = $1 AND user_id = $2
             FOR UPDATE`,
            [razorpay_order_id, req.user.id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error("Payment order not found.");
        }

        const savedOrder = orderResult.rows[0];

        // Prevent a second activation for an already processed order.
        if (savedOrder.status === "paid") {
            await client.query("ROLLBACK");
            return res.json({ success: true, message: "Pro is already activated." });
        }

        // Verify Razorpay's HMAC signature using the order ID saved on our server.
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${savedOrder.razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const signatureBuffer = Buffer.from(expectedSignature, "hex");
        const receivedBuffer = Buffer.from(razorpay_signature, "hex");

        if (
            signatureBuffer.length !== receivedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, receivedBuffer)
        ) {
            throw new Error("Invalid payment signature.");
        }

        // Verify the actual payment status with Razorpay.
        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        if (
            payment.status !== "captured" ||
            payment.order_id !== savedOrder.razorpay_order_id ||
            payment.amount !== PLAN_AMOUNT ||
            payment.currency !== "INR"
        ) {
            throw new Error("Payment is not captured or payment details do not match.");
        }

        // Extend an existing active Pro subscription rather than losing its remaining days.
        const currentResult = await client.query(
            `SELECT plan, expires_at
             FROM subscriptions
             WHERE user_id = $1
             FOR UPDATE`,
            [req.user.id]
        );

        const current = currentResult.rows[0];
        const now = new Date();

        const currentExpiry = current?.expires_at
            ? new Date(current.expires_at)
            : null;

        const startDate =
            current?.plan === "pro" && currentExpiry > now
                ? currentExpiry
                : now;

        const expiryDate = new Date(startDate);
        expiryDate.setDate(expiryDate.getDate() + PLAN_DURATION_DAYS);

        await client.query(
            `INSERT INTO subscriptions
             (user_id, plan, started_at, expires_at, updated_at)
             VALUES ($1, 'pro', $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id)
             DO UPDATE SET
                plan = 'pro',
                started_at = EXCLUDED.started_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, startDate, expiryDate]
        );

        await client.query(
            `UPDATE pro_orders
             SET status = 'paid',
                 razorpay_payment_id = $1,
                 paid_at = CURRENT_TIMESTAMP
             WHERE razorpay_order_id = $2`,
            [razorpay_payment_id, savedOrder.razorpay_order_id]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "QueryX Pro activated successfully!",
            expiresAt: expiryDate
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Payment verification error:", error);
        res.status(400).json({
            error: error.message || "Payment verification failed."
        });
    } finally {
        client.release();
    }
});

export default router;
