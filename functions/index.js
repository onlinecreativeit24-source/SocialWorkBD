"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const SSLCOMMERZ_STORE_ID = defineString("SSLCOMMERZ_STORE_ID");
const SSLCOMMERZ_STORE_PASSWORD = defineString(
  "SSLCOMMERZ_STORE_PASSWORD"
);

const FRONTEND_URL =
  "https://onlinecreativeit24-source.github.io/SocialWorkBD/";

const SSLCOMMERZ_INIT_URL =
  "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

const ALLOWED_ORIGIN =
  "https://onlinecreativeit24-source.github.io";

function setCors(res) {
  res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message: message
  });
}

function createTransactionId(uid) {
  const timestamp = Date.now();

  const randomPart = Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase();

  return `SWB_${uid.substring(0, 8)}_${timestamp}_${randomPart}`;
}

function isValidAmount(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return false;
  }

  if (value < 10) {
    return false;
  }

  if (value > 500000) {
    return false;
  }

  return true;
}

function cleanString(value, maxLength) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().substring(0, maxLength);
}

async function initializePayment(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return sendError(
      res,
      405,
      "Only POST requests are allowed."
    );
  }

  try {
    const body = req.body || {};

    const uid = cleanString(body.uid, 128);
    const amount = Number(body.amount);

    const customerName = cleanString(
      body.customerName,
      100
    );

    const customerEmail = cleanString(
      body.customerEmail,
      150
    );

    const customerPhone = cleanString(
      body.customerPhone,
      30
    );

    const customerAddress = cleanString(
      body.customerAddress,
      200
    );

    const customerCity = cleanString(
      body.customerCity,
      100
    );

    if (!uid) {
      return sendError(
        res,
        400,
        "User ID is required."
      );
    }

    if (!isValidAmount(amount)) {
      return sendError(
        res,
        400,
        "Payment amount must be between 10 and 500000 BDT."
      );
    }

    if (!customerName) {
      return sendError(
        res,
        400,
        "Customer name is required."
      );
    }

    if (!customerEmail) {
      return sendError(
        res,
        400,
        "Customer email is required."
      );
    }

    const userRef = db.collection("users").doc(uid);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return sendError(
        res,
        404,
        "User account was not found."
      );
    }

    const userData = userSnapshot.data() || {};

    if (userData.status === "suspended") {
      return sendError(
        res,
        403,
        "This account is suspended."
      );
    }

    const transactionId = createTransactionId(uid);

    const paymentRef = db
      .collection("payments")
      .doc(transactionId);

    await paymentRef.set({
      transactionId: transactionId,
      uid: uid,
      amount: Number(amount.toFixed(2)),
      currency: "BDT",
      paymentMethod: "SSLCommerz",
      environment: "sandbox",
      status: "initiated",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    const storeId = SSLCOMMERZ_STORE_ID.value();
    const storePassword =
      SSLCOMMERZ_STORE_PASSWORD.value();

    if (!storeId || !storePassword) {
      await paymentRef.update({
        status: "configuration_error",
        updatedAt: FieldValue.serverTimestamp()
      });

      return sendError(
        res,
        500,
        "Payment gateway configuration is incomplete."
      );
    }

    const paymentData = new URLSearchParams();

    paymentData.append("store_id", storeId);
    paymentData.append("store_passwd", storePassword);

    paymentData.append(
      "total_amount",
      amount.toFixed(2)
    );

    paymentData.append("currency", "BDT");

    paymentData.append(
      "tran_id",
      transactionId
    );

    paymentData.append(
      "success_url",
      `${FRONTEND_URL}payment-success.html`
    );

    paymentData.append(
      "fail_url",
      `${FRONTEND_URL}payment-failed.html`
    );

    paymentData.append(
      "cancel_url",
      `${FRONTEND_URL}payment-cancelled.html`
    );

    paymentData.append(
      "ipn_url",
      `${FRONTEND_URL}payment-ipn.html`
    );

    paymentData.append(
      "cus_name",
      customerName
    );

    paymentData.append(
      "cus_email",
      customerEmail
    );

    paymentData.append(
      "cus_add1",
      customerAddress || "Bangladesh"
    );

    paymentData.append(
      "cus_city",
      customerCity || "Dhaka"
    );

    paymentData.append(
      "cus_state",
      customerCity || "Dhaka"
    );

    paymentData.append(
      "cus_postcode",
      "1200"
    );

    paymentData.append(
      "cus_country",
      "Bangladesh"
    );

    paymentData.append(
      "cus_phone",
      customerPhone || "0000000000"
    );

    paymentData.append(
      "shipping_method",
      "NO"
    );

    paymentData.append(
      "product_name",
      "SocialWorkBD Wallet Deposit"
    );

    paymentData.append(
      "product_category",
      "Wallet"
    );

    paymentData.append(
      "product_profile",
      "general"
    );

    const sslResponse = await fetch(
      SSLCOMMERZ_INIT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: paymentData.toString()
      }
    );

    const sslText = await sslResponse.text();

    let sslData;

    try {
      sslData = JSON.parse(sslText);
    } catch (parseError) {
      console.error(
        "Invalid SSLCommerz response:",
        sslText
      );

      await paymentRef.update({
        status: "gateway_error",
        updatedAt: FieldValue.serverTimestamp()
      });

      return sendError(
        res,
        502,
        "Invalid response received from payment gateway."
      );
    }

    if (
      !sslResponse.ok ||
      !sslData.GatewayPageURL
    ) {
      console.error(
        "SSLCommerz initialization failed:",
        sslData
      );

      await paymentRef.update({
        status: "gateway_error",
        gatewayResponse: {
          status: sslData.status || "",
          failedreason:
            sslData.failedreason || ""
        },
        updatedAt: FieldValue.serverTimestamp()
      });

      return sendError(
        res,
        502,
        sslData.failedreason ||
          "Unable to initialize payment."
      );
    }

    await paymentRef.update({
      status: "gateway_initialized",
      sessionKey: sslData.sessionkey || "",
      gatewayResponse: {
        status: sslData.status || "",
        sessionkey: sslData.sessionkey || "",
        tran_date: sslData.tran_date || ""
      },
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      transactionId: transactionId,
      gatewayPageURL: sslData.GatewayPageURL
    });
  } catch (error) {
    console.error(
      "SSLCommerz payment initialization error:",
      error
    );

    return sendError(
      res,
      500,
      "Payment initialization failed."
    );
  }
}

exports.initializeSslcommerzPayment = onRequest(
  {
    region: "asia-south1",
    cors: false,
    timeoutSeconds: 60
  },
  initializePayment
);
