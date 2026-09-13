/* =========================================================
   SocialWorkBD - Secure Payment Functions
   Firebase Cloud Functions v2
   SSLCommerz + Firestore

   SECURITY MODEL
   ---------------------------------------------------------
   1. Frontend sends Firebase ID token.
   2. Server verifies Firebase ID token.
   3. Server gets UID from verified token.
   4. Client cannot choose another user's UID.
   5. Server creates pending payment.
   6. SSLCommerz processes payment.
   7. IPN is server-to-server.
   8. Server validates transaction with SSLCommerz.
   9. Firestore transaction credits wallet exactly once.
   ========================================================= */

const {
  onRequest
} = require("firebase-functions/v2/https");

const {
  defineSecret
} = require("firebase-functions/params");

const admin =
  require("firebase-admin");

admin.initializeApp();

const db =
  admin.firestore();

const SSLCOMMERZ_STORE_ID =
  defineSecret(
    "SSLCOMMERZ_STORE_ID"
  );

const SSLCOMMERZ_STORE_PASSWORD =
  defineSecret(
    "SSLCOMMERZ_STORE_PASSWORD"
  );

/* =========================================================
   Configuration
   ========================================================= */

const REGION =
  "asia-south1";

const SANDBOX = true;

const SUCCESS_URL =
  "https://onlinecreativeit24-source.github.io/SocialWorkBD/payment-success.html";

const FAIL_URL =
  "https://onlinecreativeit24-source.github.io/SocialWorkBD/payment-fail.html";

const CANCEL_URL =
  "https://onlinecreativeit24-source.github.io/SocialWorkBD/payment-cancel.html";

const GATEWAY_URL = SANDBOX
  ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
  : "https://securepay.sslcommerz.com/gwprocess/v4/api.php";

const VALIDATION_URL = SANDBOX
  ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
  : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";

/* =========================================================
   CORS
   ========================================================= */

const ALLOWED_ORIGIN =
  "https://onlinecreativeit24-source.github.io";

function setCors(res, origin) {
  if (
    origin === ALLOWED_ORIGIN
  ) {
    res.set(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.set(
    "Vary",
    "Origin"
  );

  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.set(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function jsonError(
  res,
  status,
  message
) {
  return res.status(status).json({
    success: false,
    message: message
  });
}

function generatePaymentId() {
  return (
    "SWB-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase()
  );
}

function normalizeAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(
    amount * 100
  ) / 100;
}

function amountsMatch(
  first,
  second
) {
  return (
    Math.abs(
      Number(first) -
      Number(second)
    ) < 0.01
  );
}

/* =========================================================
   Firebase Auth Verification
   ========================================================= */

async function getVerifiedUser(
  req
) {
  const header =
    String(
      req.headers.authorization ||
      ""
    );

  if (
    !header.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "Missing authorization token."
    );
  }

  const idToken =
    header.substring(7).trim();

  if (!idToken) {
    throw new Error(
      "Missing authorization token."
    );
  }

  return admin
    .auth()
    .verifyIdToken(
      idToken
    );
}

/* =========================================================
   Create Payment
   ========================================================= */

exports.createPayment =
  onRequest(
    {
      region: REGION,

      secrets: [
        SSLCOMMERZ_STORE_ID,
        SSLCOMMERZ_STORE_PASSWORD
      ],

      timeoutSeconds: 60,

      memory: "256MiB"
    },

    async (req, res) => {
      const origin =
        req.headers.origin || "";

      setCors(
        res,
        origin
      );

      if (
        req.method ===
        "OPTIONS"
      ) {
        return res
          .status(204)
          .send("");
      }

      if (
        req.method !==
        "POST"
      ) {
        return jsonError(
          res,
          405,
          "Method not allowed."
        );
      }

      try {
        /* ---------------------------------------------------
           Verify Firebase user
           --------------------------------------------------- */

        const decodedUser =
          await getVerifiedUser(
            req
          );

        const uid =
          decodedUser.uid;

        /* ---------------------------------------------------
           Validate amount
           --------------------------------------------------- */

        const amount =
          normalizeAmount(
            req.body?.amount
          );

        if (
          amount < 100 ||
          amount > 1000000
        ) {
          return jsonError(
            res,
            400,
            "Deposit amount must be between BDT 100 and BDT 1,000,000."
          );
        }

        /* ---------------------------------------------------
           Load user profile
           --------------------------------------------------- */

        const userRef =
          db
            .collection("users")
            .doc(uid);

        const userSnapshot =
          await userRef.get();

        if (
          !userSnapshot.exists
        ) {
          return jsonError(
            res,
            404,
            "User profile not found."
          );
        }

        const userData =
          userSnapshot.data() ||
          {};

        const accountStatus =
          String(
            userData.status ||
            userData.accountStatus ||
            "active"
          ).toLowerCase();

        if (
          [
            "suspended",
            "restricted",
            "banned"
          ].includes(
            accountStatus
          )
        ) {
          return jsonError(
            res,
            403,
            "This account cannot make wallet deposits."
          );
        }

        /* ---------------------------------------------------
           Credentials
           --------------------------------------------------- */

        const storeId =
          SSLCOMMERZ_STORE_ID.value();

        const storePassword =
          SSLCOMMERZ_STORE_PASSWORD.value();

        if (
          !storeId ||
          !storePassword
        ) {
          console.error(
            "SSLCommerz secrets are missing."
          );

          return jsonError(
            res,
            500,
            "Payment service is not configured."
          );
        }

        /* ---------------------------------------------------
           Create unique payment
           --------------------------------------------------- */

        const paymentId =
          generatePaymentId();

        const paymentRef =
          db
            .collection("payments")
            .doc(paymentId);

        await paymentRef.set({
          paymentId: paymentId,

          uid: uid,

          amount: amount,

          currency: "BDT",

          productName:
            "SocialWorkBD Wallet Deposit",

          productCategory:
            "Wallet",

          status: "pending",

          gateway:
            "sslcommerz",

          credited: false,

          createdAt:
            admin.firestore
              .FieldValue
              .serverTimestamp(),

          updatedAt:
            admin.firestore
              .FieldValue
              .serverTimestamp()
        });

        /* ---------------------------------------------------
           Customer information
           --------------------------------------------------- */

        const customerName =
          String(
            userData.name ||
            decodedUser.name ||
            "SocialWorkBD User"
          ).substring(
            0,
            100
          );

        const customerEmail =
          String(
            userData.email ||
            decodedUser.email ||
            ""
          ).substring(
            0,
            150
          );

        if (
          !customerEmail
        ) {
          await paymentRef.update({
            status:
              "invalid_customer",
            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()
          });

          return jsonError(
            res,
            400,
            "A valid email address is required."
          );
        }

        /* ---------------------------------------------------
           SSLCommerz request
           --------------------------------------------------- */

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
          amount.toFixed(2)
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
          SUCCESS_URL +
          "?paymentId=" +
          encodeURIComponent(
            paymentId
          )
        );

        formData.append(
          "fail_url",
          FAIL_URL +
          "?paymentId=" +
          encodeURIComponent(
            paymentId
          )
        );

        formData.append(
          "cancel_url",
          CANCEL_URL +
          "?paymentId=" +
          encodeURIComponent(
            paymentId
          )
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
          String(
            userData.location ||
            "Bangladesh"
          ).substring(
            0,
            200
          )
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
          "SocialWorkBD Wallet Deposit"
        );

        formData.append(
          "product_category",
          "Wallet"
        );

        formData.append(
          "product_profile",
          "general"
        );

        /* ---------------------------------------------------
           Send gateway request
           --------------------------------------------------- */

        const response =
          await fetch(
            GATEWAY_URL,
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

        if (
          !response.ok
        ) {
          throw new Error(
            "SSLCommerz gateway HTTP error."
          );
        }

        const result =
          await response.json();

        if (
          !result ||
          result.status !==
            "SUCCESS" ||
          !result.GatewayPageURL
        ) {
          await paymentRef.update({
            status:
              "gateway_error",

            gatewayResponse:
              result || {},

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()
          });

          return jsonError(
            res,
            502,
            "Payment gateway could not be initialized."
          );
        }

        /* ---------------------------------------------------
           Save gateway information
           --------------------------------------------------- */

        await paymentRef.update({
          gatewayUrl:
            result.GatewayPageURL,

          sessionKey:
            result.sessionkey || "",

          updatedAt:
            admin.firestore
              .FieldValue
              .serverTimestamp()
        });

        return res.status(
          200
        ).json({
          success: true,

          paymentId:
            paymentId,

          gatewayUrl:
            result.GatewayPageURL
        });

      } catch (error) {
        console.error(
          "createPayment error:",
          error
        );

        if (
          String(
            error.message || ""
          ).includes(
            "Firebase ID token"
          ) ||
          String(
            error.message || ""
          ).includes(
            "authorization"
          )
        ) {
          return jsonError(
            res,
            401,
            "Authentication failed."
          );
        }

        return jsonError(
          res,
          500,
          "Payment initialization failed."
        );
      }
    }
  );

/* =========================================================
   SSLCommerz Server-Side Validation
   ========================================================= */

async function validateSSLCommerzPayment(
  validationId,
  storeId,
  storePassword
) {
  if (
    !validationId
  ) {
    throw new Error(
      "Missing SSLCommerz validation ID."
    );
  }

  const url =
    VALIDATION_URL +
    "?val_id=" +
    encodeURIComponent(
      validationId
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

  const response =
    await fetch(url, {
      method: "GET"
    });

  if (
    !response.ok
  ) {
    throw new Error(
      "SSLCommerz validation request failed."
    );
  }

  return response.json();
}

/* =========================================================
   Payment IPN
   ========================================================= */

exports.paymentIPN =
  onRequest(
    {
      region: REGION,

      secrets: [
        SSLCOMMERZ_STORE_ID,
        SSLCOMMERZ_STORE_PASSWORD
      ],

      timeoutSeconds: 60,

      memory: "256MiB"
    },

    async (req, res) => {
      if (
        req.method !==
        "POST"
      ) {
        return res
          .status(405)
          .send(
            "Method not allowed"
          );
      }

      try {
        const data =
          req.body || {};

        const paymentId =
          String(
            data.tran_id || ""
          ).trim();

        if (!paymentId) {
          return res
            .status(400)
            .send(
              "Missing transaction ID"
            );
        }

        const paymentRef =
          db
            .collection("payments")
            .doc(paymentId);

        const paymentSnapshot =
          await paymentRef.get();

        if (
          !paymentSnapshot.exists
        ) {
          return res
            .status(404)
            .send(
              "Payment not found"
            );
        }

        const payment =
          paymentSnapshot.data() ||
          {};

        /* ---------------------------------------------------
           Idempotency:
           Already credited = do nothing.
           --------------------------------------------------- */

        if (
          payment.credited === true ||
          payment.status ===
            "paid"
        ) {
          return res
            .status(200)
            .send(
              "Payment already processed"
            );
        }

        const storeId =
          SSLCOMMERZ_STORE_ID.value();

        const storePassword =
          SSLCOMMERZ_STORE_PASSWORD.value();

        if (
          !storeId ||
          !storePassword
        ) {
          console.error(
            "SSLCommerz secrets are missing."
          );

          return res
            .status(500)
            .send(
              "Payment service configuration error"
            );
        }

        /* ---------------------------------------------------
           Get validation ID from IPN
           --------------------------------------------------- */

        const validationId =
          String(
            data.val_id || ""
          ).trim();

        if (!validationId) {
          await paymentRef.update({
            status:
              "awaiting_validation",

            gatewayResponse:
              data,

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()
          });

          return res
            .status(200)
            .send(
              "Waiting for validation"
            );
        }

        /* ---------------------------------------------------
           Server-to-server SSLCommerz validation
           --------------------------------------------------- */

        const validation =
          await validateSSLCommerzPayment(
            validationId,
            storeId,
            storePassword
          );

        const validationStatus =
          String(
            validation.status ||
            ""
          ).toUpperCase();

        const validatedTranId =
          String(
            validation.tran_id ||
            ""
          );

        const validatedAmount =
          normalizeAmount(
            validation.amount
          );

        const expectedAmount =
          normalizeAmount(
            payment.amount
          );

        const validatedCurrency =
          String(
            validation.currency ||
            ""
          ).toUpperCase();

        const expectedCurrency =
          String(
            payment.currency ||
            "BDT"
          ).toUpperCase();

        /* ---------------------------------------------------
           Verify ALL critical fields
           --------------------------------------------------- */

        const valid =
          validationStatus ===
            "VALID" &&

          validatedTranId ===
            paymentId &&

          amountsMatch(
            validatedAmount,
            expectedAmount
          ) &&

          validatedCurrency ===
            expectedCurrency;

        if (!valid) {
          await paymentRef.update({
            status:
              "verification_failed",

            gatewayResponse:
              data,

            validationResponse:
              validation,

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()
          });

          return res
            .status(400)
            .send(
              "Payment verification failed"
            );
        }

        /* ---------------------------------------------------
           Atomic wallet credit
           --------------------------------------------------- */

        const uid =
          payment.uid;

        if (!uid) {
          await paymentRef.update({
            status:
              "invalid_payment_user",

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()
          });

          return res
            .status(400)
            .send(
              "Payment user is missing"
            );
        }

        const userRef =
          db
            .collection("users")
            .doc(uid);

        const transactionRef =
          db
            .collection(
              "walletTransactions"
            )
            .doc(paymentId);

        await db.runTransaction(
          async (transaction) => {
            const latestPayment =
              await transaction.get(
                paymentRef
              );

            const latestData =
              latestPayment.data() ||
              {};

            /* ---------------------------------------------
               Idempotency inside transaction
               --------------------------------------------- */

            if (
              latestData.credited ===
                true ||
              latestData.status ===
                "paid"
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
                "User profile not found."
              );
            }

            const userData =
              userSnapshot.data() ||
              {};

            const currentBalance =
              normalizeAmount(
                userData.balance || 0
              );

            const newBalance =
              Math.round(
                (
                  currentBalance +
                  expectedAmount
                ) * 100
              ) / 100;

            /* ---------------------------------------------
               Update user balance
               --------------------------------------------- */

            transaction.update(
              userRef,
              {
                balance:
                  newBalance,

                updatedAt:
                  admin.firestore
                    .FieldValue
                    .serverTimestamp()
              }
            );

            /* ---------------------------------------------
               Create immutable wallet transaction
               --------------------------------------------- */

            transaction.set(
              transactionRef,
              {
                transactionId:
                  paymentId,

                paymentId:
                  paymentId,

                uid:
                  uid,

                type:
                  "deposit",

                amount:
                  expectedAmount,

                currency:
                  expectedCurrency,

                status:
                  "completed",

                gateway:
                  "sslcommerz",

                description:
                  "Wallet deposit via SSLCommerz",

                validationId:
                  validationId,

                bankTransactionId:
                  validation.bank_tran_id ||
                  "",

                cardType:
                  validation.card_type ||
                  "",

                createdAt:
                  admin.firestore
                    .FieldValue
                    .serverTimestamp(),

                completedAt:
                  admin.firestore
                    .FieldValue
                    .serverTimestamp()
              },

              {
                merge: false
              }
            );

            /* ---------------------------------------------
               Mark payment as credited
               --------------------------------------------- */

            transaction.update(
              paymentRef,
              {
                status:
                  "paid",

                credited:
                  true,

                validationId:
                  validationId,

                bankTransactionId:
                  validation.bank_tran_id ||
                  "",

                cardType:
                  validation.card_type ||
                  "",

                gatewayResponse:
                  data,

                validationResponse:
                  validation,

                paidAt:
                  admin.firestore
                    .FieldValue
                    .serverTimestamp(),

                updatedAt:
                  admin.firestore
                    .FieldValue
                    .serverTimestamp()
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

        return res
          .status(500)
          .send(
            "IPN processing failed"
          );
      }
    }
  );
