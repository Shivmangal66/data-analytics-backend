require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_URL =
    process.env.FRONTEND_URL || "https://shivmangal66.github.io";

// ===============================
// DATA FILE
// ===============================

const DATA_DIR = path.join(__dirname, "data");
const PURCHASE_FILE = path.join(DATA_DIR, "purchases.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(PURCHASE_FILE)) {
    fs.writeFileSync(PURCHASE_FILE, "[]");
}

// ===============================
// CORS
// ===============================

app.use(
    cors({
        origin: FRONTEND_URL
    })
);

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Data Analytics Hub Backend is running!"
    });
});

// ===============================
// RAZORPAY WEBHOOK
// ===============================

app.post(
    "/api/razorpay/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {
        try {
            const webhookSignature =
                req.headers["x-razorpay-signature"];

            const webhookEventId =
                req.headers["x-razorpay-event-id"];

            // Signature missing
            if (!webhookSignature) {
                return res.status(400).json({
                    success: false,
                    message: "Missing Razorpay signature"
                });
            }

            // Webhook secret check
            if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
                return res.status(500).json({
                    success: false,
                    message: "Webhook secret is not configured"
                });
            }

            // Generate expected signature
            const expectedSignature = crypto
                .createHmac(
                    "sha256",
                    process.env.RAZORPAY_WEBHOOK_SECRET
                )
                .update(req.body)
                .digest("hex");

            // Compare signatures safely
            const expectedBuffer = Buffer.from(
                expectedSignature,
                "utf8"
            );

            const receivedBuffer = Buffer.from(
                webhookSignature,
                "utf8"
            );

            if (
                expectedBuffer.length !== receivedBuffer.length ||
                !crypto.timingSafeEqual(
                    expectedBuffer,
                    receivedBuffer
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid webhook signature"
                });
            }

            // Convert body to JSON
            const event = JSON.parse(req.body.toString());

            // Read existing purchases
            let purchases = JSON.parse(
                fs.readFileSync(PURCHASE_FILE, "utf8")
            );

            // Prevent duplicate webhook
            if (
                webhookEventId &&
                purchases.some(
                    item =>
                        item.webhookEventId === webhookEventId
                )
            ) {
                return res.status(200).json({
                    success: true,
                    message: "Duplicate event ignored"
                });
            }

            // ===============================
            // PAYMENT LINK PAID
            // ===============================

            if (event.event === "payment_link.paid") {
                const paymentLink =
                    event.payload?.payment_link?.entity;

                const payment =
                    event.payload?.payment?.entity;

                const order =
                    event.payload?.order?.entity;

                const record = {
                    webhookEventId:
                        webhookEventId || null,

                    event: event.event,

                    paymentLinkId:
                        paymentLink?.id || null,

                    paymentId:
                        payment?.id || null,

                    orderId:
                        order?.id || null,

                    amount:
                        payment?.amount || 0,

                    currency:
                        payment?.currency || "INR",

                    status: "PAID",

                    course:
                        "Data Analytics Full Course",

                    createdAt:
                        new Date().toISOString()
                };

                purchases.push(record);

                fs.writeFileSync(
                    PURCHASE_FILE,
                    JSON.stringify(purchases, null, 2)
                );

                console.log(
                    "Payment received:",
                    record
                );
            }

            return res.status(200).json({
                success: true,
                message: "Webhook received successfully"
            });

        } catch (error) {

            console.error(
                "Webhook Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Webhook processing failed"
            });
        }
    }
);

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log(
        `Data Analytics Hub Backend running on port ${PORT}`
    );
});
