const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const SSLCOMMERZ_STORE_ID = defineSecret("SSLCOMMERZ_STORE_ID");
const SSLCOMMERZ_STORE_PASSWORD = defineSecret("SSLCOMMERZ_STORE_PASSWORD");

exports.createPayment = onRequest(
  {
    secrets: [
      SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD
    ],
    region: "asia-south1"
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          success: false,
          message: "Method not allowed"
        });
      }

      const {
        uid,
        amount,
        productName,
        productCategory
      } = req.body || {};

      if (!uid) {
        return res.status(400).json({
          success: false,
          message: "User ID is required"
        });
      }

      const paymentAmount = Number(amount);

      if (
        !Number.isFinite(paymentAmount) ||
        paymentAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment amount"
        });
      }

      const paymentId =
        "SWB-" +
        Date.now() +
        "-" +
        Math.floor(Math.random() * 100000);

      await db.collection("payments").doc(paymentId).set({
        paymentId: paymentId,
        uid: uid,
        amount: paymentAmount,
        currency: "BDT",
        productName:
          productName || "SocialWorkBD Wallet Deposit",
        productCategory:
          productCategory || "Wallet",
        status: "pending",
        gateway: "sslcommerz",
        createdAt:
          admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

      const storeId = SSLCOMMERZ_STORE_ID.value();
      const storePassword =
        SSLCOMMERZ_STORE_PASSWORD.value();

      if (!storeId || !storePassword) {
        return res.status(500).json({
          success: false,
          message: "SSLCommerz credentials are not configured"
        });
      }

      const userSnapshot =
        await db.collection("users").doc(uid).get();

      const userData =
        userSnapshot.exists
          ? userSnapshot.data()
          : {};

      const customerName =
        userData.name || "SocialWorkBD User";

      const customerEmail =
        userData.email || "customer@example.com";

      const baseUrl =
        "https://onlinecreativeit24-source.github.io/SocialWorkBD-App";

      const gatewayUrl =
        "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

      const formData = new URLSearchParams();

      formData.append("store_id", storeId);
      formData.append("store_passwd", storePassword);
      formData.append("total_amount", paymentAmount.toFixed(2));
      formData.append("currency", "BDT");
      formData.append("tran_id", paymentId);

      formData.append(
        "success_url",
        baseUrl + "/payment-success.html?paymentId=" + paymentId
      );

      formData.append(
        "fail_url",
        baseUrl + "/payment-fail.html?paymentId=" + paymentId
      );

      formData.append(
        "cancel_url",
        baseUrl + "/payment-cancel.html?paymentId=" + paymentId
      );

      formData.append(
        "ipn_url",
        "https://asia-south1-socialworkbd-b1c00.cloudfunctions.net/paymentIPN"
      );

      formData.append(
        "cus_name",
        customerName
      );

      formData.append(
        "cus_email",
        customerEmail
      );

      formData.append(
        "cus_add1",
        userData.location || "Bangladesh"
      );

      formData.append(
        "cus_city",
        "Bangladesh"
      );

      formData.append(
        "cus_country",
        "Bangladesh"
      );

      formData.append(
        "shipping_method",
        "NO"
      );

      formData.append(
        "product_name",
        productName || "Wallet Deposit"
      );

      formData.append(
        "product_category",
        productCategory || "Wallet"
      );

      formData.append(
        "product_profile",
        "general"
      );

      const response = await fetch(
        gatewayUrl,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        }
      );

      const result =
        await response.json();

      if (
        !result ||
        result.status !== "SUCCESS" ||
        !result.GatewayPageURL
      ) {
        await db
          .collection("payments")
          .doc(paymentId)
          .update({
            status: "gateway_error",
            gatewayResponse: result || {},
            updatedAt:
              admin.firestore.FieldValue.serverTimestamp()
          });

        return res.status(502).json({
          success: false,
          message: "Payment gateway could not be initialized",
          paymentId: paymentId
        });
      }

      await db
        .collection("payments")
        .doc(paymentId)
        .update({
          gatewayUrl: result.GatewayPageURL,
          sessionKey: result.sessionkey || "",
          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

      return res.status(200).json({
        success: true,
        paymentId: paymentId,
        gatewayUrl: result.GatewayPageURL
      });
    } catch (error) {
      console.error("createPayment error:", error);

      return res.status(500).json({
        success: false,
        message: "Payment initialization failed"
      });
    }
  }
);

exports.paymentIPN = onRequest(
  {
    secrets: [
      SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD
    ],
    region: "asia-south1"
  },
  async (req, res) => {
    try {
      const data = req.body || {};

      const paymentId =
        data.tran_id || "";

      if (!paymentId) {
        return res.status(400).send("Missing transaction ID");
      }

      const paymentRef =
        db.collection("payments").doc(paymentId);

      const paymentSnapshot =
        await paymentRef.get();

      if (!paymentSnapshot.exists) {
        return res.status(404).send("Payment not found");
      }

      const payment =
        paymentSnapshot.data();

      const receivedAmount =
        Number(data.amount || 0);

      const expectedAmount =
        Number(payment.amount || 0);

      const transactionStatus =
        String(data.status || "").toUpperCase();

      if (
        transactionStatus === "VALID" &&
        receivedAmount === expectedAmount
      ) {
        await paymentRef.update({
          status: "paid",
          validationId:
            data.val_id || "",
          bankTransactionId:
            data.bank_tran_id || "",
          cardType:
            data.card_type || "",
          gatewayResponse: data,
          paidAt:
            admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).send("Payment verified");
      }

      await paymentRef.update({
        status: "verification_failed",
        gatewayResponse: data,
        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(400).send("Payment verification failed");
    } catch (error) {
      console.error("paymentIPN error:", error);

      return res.status(500).send("IPN processing failed");
    }
  }
);
