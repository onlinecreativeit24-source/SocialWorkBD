const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const SSLCOMMERZ_STORE_ID =
  defineSecret("SSLCOMMERZ_STORE_ID");

const SSLCOMMERZ_STORE_PASSWORD =
  defineSecret("SSLCOMMERZ_STORE_PASSWORD");

const REGION = "asia-south1";

const LIVE_GATEWAY =
  "https://securepay.sslcommerz.com/gwprocess/v4/api.php";

const SANDBOX_GATEWAY =
  "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

const USE_SANDBOX = true;

/* =========================================================
   CREATE PAYMENT
   ========================================================= */

exports.createPayment = onRequest(
  {
    region: REGION,
    secrets: [
      SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD
    ]
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          success: false,
          message: "Method not allowed"
        });
      }

      /* Firebase ID token */
      const authHeader =
        req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      const idToken =
        authHeader.substring(7);

      let decodedToken;

      try {
        decodedToken =
          await admin
            .auth()
            .verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication token"
        });
      }

      const uid =
        decodedToken.uid;

      const amount =
        Number(req.body?.amount);

      if (
        !Number.isFinite(amount) ||
        amount < 100 ||
        amount > 1000000
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Deposit must be between BDT 100 and BDT 1,000,000."
        });
      }

      const roundedAmount =
        Math.round(amount * 100) / 100;

      /* User profile */
      const userRef =
        db.collection("users").doc(uid);

      const userSnapshot =
        await userRef.get();

      if (!userSnapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "User profile not found"
        });
      }

      const user =
        userSnapshot.data() || {};

      if (
        String(user.status || "active")
          .toLowerCase() === "suspended"
      ) {
        return res.status(403).json({
          success: false,
          message: "This account is suspended."
        });
      }

      const customerName =
        String(
          user.name ||
          decodedToken.name ||
          "SocialWorkBD User"
        ).substring(0, 100);

      const customerEmail =
        String(
          user.email ||
          decodedToken.email ||
          ""
        ).substring(0, 100);

      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          message: "A valid email is required."
        });
      }

      /* Unique transaction */
      const paymentId =
        "SWB-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase();

      const paymentRef =
        db.collection("payments").doc(paymentId);

      await paymentRef.set({
        paymentId,
        uid,

        amount: roundedAmount,
        currency: "BDT",

        productName:
          "SocialWorkBD Wallet Deposit",

        productCategory:
          "Wallet",

        gateway:
          "sslcommerz",

        status:
          "pending",

        createdAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

      const storeId =
        SSLCOMMERZ_STORE_ID.value();

      const storePassword =
        SSLCOMMERZ_STORE_PASSWORD.value();

      if (!storeId || !storePassword) {
        await paymentRef.update({
          status: "configuration_error",
          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(500).json({
          success: false,
          message:
            "Payment gateway is not configured."
        });
      }

      const baseUrl =
        "https://onlinecreativeit24-source.github.io/SocialWorkBD";

      const gatewayUrl =
        USE_SANDBOX
          ? SANDBOX_GATEWAY
          : LIVE_GATEWAY;

      const successUrl =
        baseUrl +
        "/payment-success.html?paymentId=" +
        encodeURIComponent(paymentId);

      const failUrl =
        baseUrl +
        "/payment-fail.html?paymentId=" +
        encodeURIComponent(paymentId);

      const cancelUrl =
        baseUrl +
        "/payment-cancel.html?paymentId=" +
        encodeURIComponent(paymentId);

      const ipnUrl =
        "https://asia-south1-socialworkbd-b1c00" +
        ".cloudfunctions.net/paymentIPN";

      const formData =
        new URLSearchParams();

      formData.append(
        "store_id",
        storeId
      );

      formData.append(
        "store_passwd",
        storePassword
      );

      formData.append(
        "total_amount",
        roundedAmount.toFixed(2)
      );

      formData.append(
        "currency",
        "BDT"
      );

      formData.append(
        "tran_id",
        paymentId
      );

      formData.append(
        "success_url",
        successUrl
      );

      formData.append(
        "fail_url",
        failUrl
      );

      formData.append(
        "cancel_url",
        cancelUrl
      );

      formData.append(
        "ipn_url",
        ipnUrl
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
        String(
          user.location ||
          "Bangladesh"
        ).substring(0, 200)
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
        "SocialWorkBD Wallet"
      );

      formData.append(
        "product_category",
        "Wallet"
      );

      formData.append(
        "product_profile",
        "general"
      );

      const response =
        await fetch(
          gatewayUrl,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded"
            },

            body:
              formData.toString()
          }
        );

      const result =
        await response.json();

      if (
        !result ||
        result.status !== "SUCCESS" ||
        !result.GatewayPageURL
      ) {
        await paymentRef.update({
          status: "gateway_error",

          gatewayResponse:
            result || {},

          updatedAt:
            admin.firestore.FieldValue
              .serverTimestamp()
        });

        return res.status(502).json({
          success: false,
          message:
            "Payment gateway could not be initialized."
        });
      }

      await paymentRef.update({
        gatewayUrl:
          result.GatewayPageURL,

        sessionKey:
          result.sessionkey || "",

        updatedAt:
          admin.firestore.FieldValue
            .serverTimestamp()
      });

      return res.status(200).json({
        success: true,

        paymentId,

        gatewayUrl:
          result.GatewayPageURL
      });

    } catch (error) {
      console.error(
        "createPayment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Payment initialization failed."
      });
    }
  }
);


/* =========================================================
   SSLCommerz IPN
   ========================================================= */

exports.paymentIPN = onRequest(
  {
    region: REGION,
    secrets: [
      SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD
    ]
  },
  async (req, res) => {
    try {
      const data =
        req.body || {};

      const paymentId =
        String(
          data.tran_id || ""
        );

      if (!paymentId) {
        return res
          .status(400)
          .send("Missing transaction ID");
      }

      const paymentRef =
        db
          .collection("payments")
          .doc(paymentId);

      const paymentSnapshot =
        await paymentRef.get();

      if (!paymentSnapshot.exists) {
        return res
          .status(404)
          .send("Payment not found");
      }

      const payment =
        paymentSnapshot.data();

      /*
       * Prevent duplicate wallet credit.
       */
      if (
        payment.status === "paid"
      ) {
        return res
          .status(200)
          .send("Already processed");
      }

      const receivedAmount =
        Number(data.amount || 0);

      const expectedAmount =
        Number(payment.amount || 0);

      const transactionStatus =
        String(
          data.status || ""
        ).toUpperCase();

      if (
        transactionStatus !== "VALID"
      ) {
        await paymentRef.update({
          status:
            "verification_failed",

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue
              .serverTimestamp()
        });

        return res
          .status(400)
          .send("Payment not valid");
      }

      if (
        receivedAmount !==
        expectedAmount
      ) {
        await paymentRef.update({
          status:
            "amount_mismatch",

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue
              .serverTimestamp()
        });

        return res
          .status(400)
          .send("Amount mismatch");
      }

      /*
       * IMPORTANT:
       * Validate payment with SSLCommerz
       * before adding money.
       */

      const storeId =
        SSLCOMMERZ_STORE_ID.value();

      const storePassword =
        SSLCOMMERZ_STORE_PASSWORD.value();

      const validationUrl =
        (
          USE_SANDBOX
            ? "https://sandbox.sslcommerz.com"
            : "https://securepay.sslcommerz.com"
        ) +
        "/validator/api/validationserverAPI.php" +
        "?val_id=" +
        encodeURIComponent(
          data.val_id || ""
        ) +
        "&store_id=" +
        encodeURIComponent(
          storeId
        ) +
        "&store_passwd=" +
        encodeURIComponent(
          storePassword
        ) +
        "&format=json";

      const validationResponse =
        await fetch(
          validationUrl
        );

      const validationResult =
        await validationResponse.json();

      if (
        !validationResult ||
        String(
          validationResult.status || ""
        ).toUpperCase() !== "VALID"
      ) {
        await paymentRef.update({
          status:
            "validation_failed",

          gatewayResponse:
            validationResult || data,

          updatedAt:
            admin.firestore.FieldValue
              .serverTimestamp()
        });

        return res
          .status(400)
          .send("SSLCommerz validation failed");
      }

      /*
       * Atomic transaction:
       * payment + wallet + wallet transaction
       */
      await db.runTransaction(
        async (transaction) => {
          const freshPayment =
            await transaction.get(
              paymentRef
            );

          const freshData =
            freshPayment.data();

          if (
            freshData.status === "paid"
          ) {
            return;
          }

          const uid =
            freshData.uid;

          const userRef =
            db
              .collection("users")
              .doc(uid);

          const walletTransactionRef =
            db
              .collection(
                "walletTransactions"
              )
              .doc(paymentId);

          const userSnapshot =
            await transaction.get(
              userRef
            );

          if (!userSnapshot.exists) {
            throw new Error(
              "User profile not found"
            );
          }

          const userData =
            userSnapshot.data() || {};

          const oldBalance =
            Number(
              userData.balance || 0
            );

          const newBalance =
            oldBalance +
            expectedAmount;

          transaction.update(
            userRef,
            {
              balance:
                newBalance,

              updatedAt:
                admin.firestore.FieldValue
                  .serverTimestamp()
            }
          );

          transaction.set(
            walletTransactionRef,
            {
              uid,

              paymentId,

              type:
                "wallet_deposit",

              amount:
                expectedAmount,

              currency:
                "BDT",

              status:
                "completed",

              gateway:
                "sslcommerz",

              description:
                "SSLCommerz wallet deposit",

              createdAt:
                admin.firestore.FieldValue
                  .serverTimestamp()
            },
            {
              merge: true
            }
          );

          transaction.update(
            paymentRef,
            {
              status:
                "paid",

              validationId:
                data.val_id || "",

              bankTransactionId:
                data.bank_tran_id || "",

              cardType:
                data.card_type || "",

              gatewayResponse:
                data,

              validatedResponse:
                validationResult,

              paidAt:
                admin.firestore.FieldValue
                  .serverTimestamp(),

              updatedAt:
                admin.firestore.FieldValue
                  .serverTimestamp()
            }
          );
        }
      );

      return res
        .status(200)
        .send("Payment verified and wallet credited");

    } catch (error) {
      console.error(
        "paymentIPN error:",
        error
      );

      return res
        .status(500)
        .send("IPN processing failed");
    }
  }
);
