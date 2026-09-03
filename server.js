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

const DATA_DIR = path.join(__dirname, "data");
const PURCHASE_FILE = path.join(DATA_DIR, "purchases.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(PURCHASE_FILE)) {
    fs.writeFileSync(PURCHASE_FILE, "[]");
}

app.use(cors({
    origin: FRONTEND_URL
}));

// ===============================
// RAZORPAY WEBHOOK
// IMPORTANT: RAW BODY MUST COME FIRST
// ===============================

app.post(
    "/api/razorpay/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {

        try {

            console.log("Webhook received");

            const signature =
                req.headers["x-razorpay-signature"];

            const eventId =
                req.headers["x-razorpay-event-id"];

            if (!signature) {
                console.log("Missing Razorpay signature");

                return res.status(400).json({
                    success: false,
                    message: "Missing signature"
                });
            }

            const secret =
                process.env.RAZORPAY_WEBHOOK_SECRET;

            if (!secret) {
                console.log("Webhook secret missing");

                return res.status(500).json({
                    success: false,
                    message: "Webhook secret not configured"
                });
            }

            // Verify Razorpay signature
            const expectedSignature =
                crypto
                    .createHmac("sha256", secret)
                    .update(req.body)
                    .digest("hex");

            if (
                expectedSignature.length !== signature.length ||
                !crypto.timingSafeEqual(
                    Buffer.from(expectedSignature),
                    Buffer.from(signature)
                )
            ) {

                console.log("Invalid webhook signature");

                return res.status(400).json({
                    success: false,
                    message: "Invalid signature"
                });
            }

            console.log("Webhook signature verified");

            // Parse only AFTER signature verification
            const event =
                JSON.parse(req.body.toString());

            console.log("Event:", event.event);

            let purchases =
                JSON.parse(
                    fs.readFileSync(
                        PURCHASE_FILE,
                        "utf8"
                    )
                );

            // Prevent duplicate events
            if (
                eventId &&
                purchases.some(
                    item =>
                        item.webhookEventId === eventId
                )
            ) {

                console.log("Duplicate webhook ignored");

                return res.status(200).json({
                    success: true
                });
            }

            // Payment Link Paid
            if (event.event === "payment_link.paid") {

                const paymentLink =
                    event.payload?.payment_link?.entity;

                const payment =
                    event.payload?.payment?.entity;

                const order =
                    event.payload?.order?.entity;

                const record = {

                    webhookEventId:
                        eventId || null,

                    event:
                        event.event,

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

                    status:
                        "PAID",

                    course:
                        "Data Analytics Full Course",

                    createdAt:
                        new Date().toISOString()
                };

                purchases.push(record);

                fs.writeFileSync(
                    PURCHASE_FILE,
                    JSON.stringify(
                        purchases,
                        null,
                        2
                    )
                );

                console.log(
                    "Payment received:",
                    record
                );
            }

            return res.status(200).json({
                success: true,
                message: "Webhook processed"
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
// JSON FOR NORMAL API ROUTES
// ===============================

app.use(express.json());

app.get("/", (req, res) => {

    res.json({
        success: true,
        message:
            "Data Analytics Hub Backend is running!"
    });

});
// ===============================
// PREMIUM ACCESS CHECK
// ===============================

app.get("/api/premium-access", (req, res) => {

    try {

        const purchases = JSON.parse(
            fs.readFileSync(PURCHASE_FILE, "utf8")
        );

        const paid = purchases.some(
            purchase =>
                purchase.status === "PAID" &&
                purchase.course === "Data Analytics Full Course"
        );

        if (paid) {
            return res.json({
                success: true,
                access: true,
                message: "Premium access granted"
            });
        }

        return res.status(403).json({
            success: false,
            access: false,
            message: "Payment required"
        });

    } catch (error) {

        console.error("Premium access error:", error);

        return res.status(500).json({
            success: false,
            access: false,
            message: "Server error"
        });
    }

});
app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});
