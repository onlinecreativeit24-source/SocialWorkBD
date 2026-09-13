const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const SSLCOMMERZ_STORE_ID = defineSecret("SSLCOMMERZ_STORE_ID");
const SSLCOMMERZ_STORE_PASSWORD = defineSecret("SSLCOMMERZ_STORE_PASSWORD");

const REGION = "asia-south1";

const PAYMENT_COLLECTION = "payments";
const WALLET_TRANSACTION_COLLECTION = "walletTransactions";

/* =========================================================
   HELPERS
========================================================= */

function json(res, status, data) {
  return res.status(status).json(data);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.substring(7).trim();
}

async function verifyFirebaseUser(req) {
  const token = getBearerToken(req);

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  return await admin.auth().verifyIdToken(token);
}

function isValidAmount(amount) {
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 10000000
  );
}

function amountsMatch(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

function createPaymentId() {
  return (
    "SWB-" +
    Date.now() +
    "-" +
    Math.floor(Math.random() * 1000000)
  );
}

/* =========================================================
   CREATE PAYMENT
========================================================= */

exports.createPayment = onRequest(
  {
    secrets: [
      SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD
    ],
    region: REGION
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return json(res, 405, {
          success: false,
          message: "Method not allowed"
        });
      }

      /* ---------------------------------------------------
         VERIFY FIREBASE AUTH
      --------------------------------------------------- */

      let decodedToken;

      try {
        decodedToken = await verifyFirebaseUser(req);
      } catch (error) {
        return json(res, 401, {
          success: false,
          message: "Authentication required"
        });
      }

      const uid = decodedToken.uid;

      const {
        amount,
        productName,
        productCategory
      } = req.body || {};

      const paymentAmount = Number(amount);

      if (!isValidAmount(paymentAmount)) {
        return json(res, 400, {
          success: false,
          message: "Invalid payment amount"
        });
      }

      /* ---------------------------------------------------
         CHECK USER PROFILE
      --------------------------------------------------- */

      const userRef = db.collection("users").doc(uid);
      const userSnapshot = await userRef.get();

      if (!userSnapshot.exists) {
        return json(res, 404, {
          success: false,
          message: "User profile not found"
        });
      }

      const userData = userSnapshot.data() || {};

      const accountStatus =
        userData.status ||
        userData.accountStatus ||
        "active";

      if (
        accountStatus === "suspended" ||
        accountStatus === "restricted"
      ) {
        return json(res, 403, {
          success: false,
          message: "Your account is not allowed to make payments"
        });
      }

      /* ---------------------------------------------------
         CHECK PAYMENT CREDENTIALS BEFORE CREATING PAYMENT
      --------------------------------------------------- */

      const storeId = SSLCOMMERZ_STORE_ID.value();
      const storePassword =
        SSLCOMMERZ_STORE_PASSWORD.value();

      if (!storeId || !storePassword) {
        return json(res, 500, {
          success: false,
          message: "Payment service is not configured yet"
        });
      }

      /* ---------------------------------------------------
         CREATE PAYMENT RECORD
      --------------------------------------------------- */

      const paymentId = createPaymentId();

      const paymentRef =
        db.collection(PAYMENT_COLLECTION).doc(paymentId);

      const paymentData = {
        paymentId,
        uid,

        amount: paymentAmount,
        currency: "BDT",

        productName:
          productName ||
          "SocialWorkBD Wallet Deposit",

        productCategory:
          productCategory ||
          "Wallet",

        gateway: "sslcommerz",

        status: "pending",

        creditStatus: "not_credited",

        createdAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      };

      await paymentRef.create(paymentData);

      /* ---------------------------------------------------
         CUSTOMER INFORMATION
      --------------------------------------------------- */

      const customerName =
        userData.name ||
        decodedToken.name ||
        "SocialWorkBD User";

      const customerEmail =
        userData.email ||
        decodedToken.email ||
        "";

      if (!customerEmail) {
        await paymentRef.update({
          status: "failed",
          failureReason: "Customer email is missing",
          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return json(res, 400, {
          success: false,
          message: "Your account email is required for payment"
        });
      }

      /* ---------------------------------------------------
         CURRENT LIVE SOCIALWORKBD URL
      --------------------------------------------------- */

      const baseUrl =
        "https://onlinecreativeit24-source.github.io/SocialWorkBD";

      /*
       * Keep sandbox for testing.
       * Production endpoint can be switched after sandbox
       * payment verification is confirmed.
       */
      const gatewayUrl =
        "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

      const ipnUrl =
        "https://asia-south1-socialworkbd-b1c00.cloudfunctions.net/paymentIPN";

      /* ---------------------------------------------------
         SSL COMMERZ REQUEST
      --------------------------------------------------- */

      const formData = new URLSearchParams();

      formData.append("store_id", storeId);
      formData.append("store_passwd", storePassword);

      formData.append(
        "total_amount",
        paymentAmount.toFixed(2)
      );

      formData.append("currency", "BDT");
      formData.append("tran_id", paymentId);

      formData.append(
        "success_url",
        `${baseUrl}/payment-success.html?paymentId=${encodeURIComponent(
          paymentId
        )}`
      );

      formData.append(
        "fail_url",
        `${baseUrl}/payment-fail.html?paymentId=${encodeURIComponent(
          paymentId
        )}`
      );

      formData.append(
        "cancel_url",
        `${baseUrl}/payment-cancel.html?paymentId=${encodeURIComponent(
          paymentId
        )}`
      );

      formData.append("ipn_url", ipnUrl);

      formData.append("cus_name", customerName);
      formData.append("cus_email", customerEmail);

      formData.append(
        "cus_add1",
        userData.location || "Bangladesh"
      );

      formData.append(
        "cus_city",
        userData.city || "Bangladesh"
      );

      formData.append(
        "cus_country",
        userData.country || "Bangladesh"
      );

      formData.append("shipping_method", "NO");

      formData.append(
        "product_name",
        productName ||
          "SocialWorkBD Wallet Deposit"
      );

      formData.append(
        "product_category",
        productCategory ||
          "Wallet"
      );

      formData.append(
        "product_profile",
        "general"
      );

      /* ---------------------------------------------------
         CALL SSL COMMERZ
      --------------------------------------------------- */

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

      if (!response.ok) {
        await paymentRef.update({
          status: "gateway_error",
          gatewayHttpStatus: response.status,
          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return json(res, 502, {
          success: false,
          message:
            "Payment gateway could not be reached",
          paymentId
        });
      }

      const result = await response.json();

      /* ---------------------------------------------------
         CHECK GATEWAY INITIALIZATION
      --------------------------------------------------- */

      if (
        !result ||
        result.status !== "SUCCESS" ||
        !result.GatewayPageURL
      ) {
        await paymentRef.update({
          status: "gateway_error",

          gatewayResponse: result || {},

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return json(res, 502, {
          success: false,
          message:
            "Payment gateway could not be initialized",
          paymentId
        });
      }

      /* ---------------------------------------------------
         SAVE GATEWAY INFORMATION
      --------------------------------------------------- */

      await paymentRef.update({
        gatewayUrl:
          result.GatewayPageURL,

        sessionKey:
          result.sessionkey || "",

        gatewaySession:
          result.sessionkey || "",

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

      return json(res, 200, {
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

      return json(res, 500, {
        success: false,
        message:
          "Payment initialization failed"
      });
    }
  }
);


/* =========================================================
   SSL COMMERZ IPN
========================================================= */

exports.paymentIPN = onRequest(
  {
    secrets: [
      SSLCOMMERZ_STORE_ID,
      SSLCOMMERZ_STORE_PASSWORD
    ],
    region: REGION
  },
  async (req, res) => {
    try {
      if (
        req.method !== "POST" &&
        req.method !== "GET"
      ) {
        return res
          .status(405)
          .send("Method not allowed");
      }

      const data =
        req.body || {};

      const paymentId =
        data.tran_id || "";

      if (!paymentId) {
        return res
          .status(400)
          .send("Missing transaction ID");
      }

      const paymentRef =
        db
          .collection(PAYMENT_COLLECTION)
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

      /* ---------------------------------------------------
         IDEMPOTENCY
         Do not process already credited payments.
      --------------------------------------------------- */

      if (
        payment.creditStatus ===
        "credited"
      ) {
        return res
          .status(200)
          .send("Payment already processed");
      }

      /* ---------------------------------------------------
         BASIC TRANSACTION VALIDATION
      --------------------------------------------------- */

      const receivedAmount =
        Number(data.amount || 0);

      const expectedAmount =
        Number(payment.amount || 0);

      const receivedCurrency =
        String(
          data.currency || ""
        ).toUpperCase();

      const expectedCurrency =
        String(
          payment.currency || "BDT"
        ).toUpperCase();

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
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Payment verification failed"
          );
      }

      if (
        !amountsMatch(
          receivedAmount,
          expectedAmount
        )
      ) {
        await paymentRef.update({
          status:
            "verification_failed",

          failureReason:
            "Payment amount mismatch",

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Payment amount mismatch"
          );
      }

      if (
        receivedCurrency !==
        expectedCurrency
      ) {
        await paymentRef.update({
          status:
            "verification_failed",

          failureReason:
            "Payment currency mismatch",

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Payment currency mismatch"
          );
      }

      /* ---------------------------------------------------
         SSL COMMERZ VALIDATION API
      --------------------------------------------------- */

      const storeId =
        SSLCOMMERZ_STORE_ID.value();

      const storePassword =
        SSLCOMMERZ_STORE_PASSWORD.value();

      if (
        !storeId ||
        !storePassword
      ) {
        return res
          .status(500)
          .send(
            "Payment credentials are not configured"
          );
      }

      const valId =
        data.val_id || "";

      if (!valId) {
        await paymentRef.update({
          status:
            "verification_failed",

          failureReason:
            "Missing validation ID",

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Missing validation ID"
          );
      }

      /*
       * SSLCommerz Order Validation API.
       * Sandbox is used while the payment system is being tested.
       */
      const validationUrl =
        "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

      const validationParams =
        new URLSearchParams();

      validationParams.append(
        "val_id",
        valId
      );

      validationParams.append(
        "store_id",
        storeId
      );

      validationParams.append(
        "store_passwd",
        storePassword
      );

      validationParams.append(
        "v",
        "1"
      );

      validationParams.append(
        "format",
        "json"
      );

      const validationResponse =
        await fetch(
          validationUrl +
            "?" +
            validationParams.toString(),
          {
            method: "GET"
          }
        );

      if (
        !validationResponse.ok
      ) {
        await paymentRef.update({
          status:
            "verification_pending",

          failureReason:
            "Gateway validation service unavailable",

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(502)
          .send(
            "Gateway validation unavailable"
          );
      }

      const validationResult =
        await validationResponse.json();

      const validationStatus =
        String(
          validationResult.status ||
            ""
        ).toUpperCase();

      const validationAmount =
        Number(
          validationResult.amount || 0
        );

      const validationCurrency =
        String(
          validationResult.currency ||
            ""
        ).toUpperCase();

      if (
        validationStatus !==
        "VALID"
      ) {
        await paymentRef.update({
          status:
            "verification_failed",

          failureReason:
            "Gateway validation rejected payment",

          validationResponse:
            validationResult,

          gatewayResponse:
            data,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Gateway validation failed"
          );
      }

      if (
        !amountsMatch(
          validationAmount,
          expectedAmount
        )
      ) {
        await paymentRef.update({
          status:
            "verification_failed",

          failureReason:
            "Validated amount mismatch",

          validationResponse:
            validationResult,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Validated amount mismatch"
          );
      }

      if (
        validationCurrency !==
        expectedCurrency
      ) {
        await paymentRef.update({
          status:
            "verification_failed",

          failureReason:
            "Validated currency mismatch",

          validationResponse:
            validationResult,

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

        return res
          .status(400)
          .send(
            "Validated currency mismatch"
          );
      }

      /* ---------------------------------------------------
         SERVER-SIDE WALLET CREDIT
         
         IMPORTANT:
         Payment + wallet transaction are handled
         together in a Firestore transaction.
      --------------------------------------------------- */

      const userRef =
        db
          .collection("users")
          .doc(payment.uid);

      const walletTransactionRef =
        db
          .collection(
            WALLET_TRANSACTION_COLLECTION
          )
          .doc(paymentId);

      await db.runTransaction(
        async (transaction) => {

          const freshPaymentSnapshot =
            await transaction.get(
              paymentRef
            );

          if (
            !freshPaymentSnapshot.exists
          ) {
            throw new Error(
              "PAYMENT_NOT_FOUND"
            );
          }

          const freshPayment =
            freshPaymentSnapshot.data();

          /*
           * Another IPN/request may have
           * already completed this payment.
           */
          if (
            freshPayment.creditStatus ===
            "credited"
          ) {
            return;
          }

          const userSnapshot =
            await transaction.get(
              userRef
            );

          if (
            !userSnapshot.exists
          ) {
            throw new Error(
              "USER_NOT_FOUND"
            );
          }

          const walletTransactionSnapshot =
            await transaction.get(
              walletTransactionRef
            );

          if (
            walletTransactionSnapshot.exists
          ) {
            const existing =
              walletTransactionSnapshot.data();

            if (
              existing.status ===
              "completed"
            ) {
              transaction.update(
                paymentRef,
                {
                  status: "paid",
                  creditStatus:
                    "credited",

                  validationId:
                    valId,

                  bankTransactionId:
                    data.bank_tran_id ||
                    validationResult.bank_tran_id ||
                    "",

                  cardType:
                    data.card_type ||
                    validationResult.card_type ||
                    "",

                  validationResponse:
                    validationResult,

                  gatewayResponse:
                    data,

                  paidAt:
                    admin.firestore.FieldValue.serverTimestamp(),

                  creditedAt:
                    admin.firestore.FieldValue.serverTimestamp(),

                  updatedAt:
                    admin.firestore.FieldValue.serverTimestamp()
                }
              );

              return;
            }
          }

          const user =
            userSnapshot.data() || {};

          const currentBalance =
            Number(
              user.balance || 0
            );

          const newBalance =
            currentBalance +
            expectedAmount;

          /*
           * Create immutable wallet ledger entry.
           */
          transaction.create(
            walletTransactionRef,
            {
              transactionId:
                paymentId,

              paymentId,

              uid:
                payment.uid,

              type:
                "deposit",

              source:
                "sslcommerz",

              amount:
                expectedAmount,

              currency:
                expectedCurrency,

              balanceBefore:
                currentBalance,

              balanceAfter:
                newBalance,

              status:
                "completed",

              description:
                "SocialWorkBD Wallet Deposit",

              gatewayValidationId:
                valId,

              createdAt:
                admin.firestore.FieldValue.serverTimestamp()
            }
          );

          /*
           * Update wallet balance only on the
           * trusted server.
           */
          transaction.update(
            userRef,
            {
              balance:
                admin.firestore.FieldValue.increment(
                  expectedAmount
                ),

              updatedAt:
                admin.firestore.FieldValue.serverTimestamp()
            }
          );

          /*
           * Mark payment as both paid and credited.
           */
          transaction.update(
            paymentRef,
            {
              status:
                "paid",

              creditStatus:
                "credited",

              validationId:
                valId,

              bankTransactionId:
                data.bank_tran_id ||
                validationResult.bank_tran_id ||
                "",

              cardType:
                data.card_type ||
                validationResult.card_type ||
                "",

              validationResponse:
                validationResult,

              gatewayResponse:
                data,

              paidAt:
                admin.firestore.FieldValue.serverTimestamp(),

              creditedAt:
                admin.firestore.FieldValue.serverTimestamp(),

              updatedAt:
                admin.firestore.FieldValue.serverTimestamp()
            }
          );
        }
      );

      return res
        .status(200)
        .send(
          "Payment verified and wallet credited"
        );

    } catch (error) {

      console.error(
        "paymentIPN error:",
        error
      );

      if (
        error.message ===
        "PAYMENT_NOT_FOUND"
      ) {
        return res
          .status(404)
          .send(
            "Payment not found"
          );
      }

      if (
        error.message ===
        "USER_NOT_FOUND"
      ) {
        return res
          .status(404)
          .send(
            "User not found"
          );
      }

      return res
        .status(500)
        .send(
          "IPN processing failed"
        );
    }
  }
);
