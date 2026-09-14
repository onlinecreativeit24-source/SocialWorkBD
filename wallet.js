/* =========================================================
   SocialWorkBD - Secure Manual Wallet
   Currency: USD
   Payment Method: PayPal ONLY
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    currency: "USD",
    currencySymbol: "$",

    USERS_COLLECTION: "users",
    TRANSACTIONS_COLLECTION: "walletTransactions",
    PAYMENT_REQUESTS_COLLECTION: "paymentRequests",

    MIN_DEPOSIT: 1,
    MAX_DEPOSIT: 10000,

    PAYPAL_PAYMENT_LINK:
      "https://www.paypal.com/qrcodes/p2pqrc/AY3DPRB57ZPRE",

    PAYMENT_METHODS: {
      paypal: {
        id: "paypal",
        name: "PayPal",
        description: "Pay securely with PayPal",
        enabled: true
      }
    }
  };


  /* =========================================================
     FIREBASE
     ========================================================= */

  function getFirebase() {
    if (typeof firebase === "undefined") {
      throw new Error("Firebase is not loaded.");
    }

    return firebase;
  }

  function getAuth() {
    return getFirebase().auth();
  }

  function getDB() {
    return getFirebase().firestore();
  }


  /* =========================================================
     DOM HELPERS
     ========================================================= */

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) {
      el.textContent = value;
    }
  }


  /* =========================================================
     SECURITY
     ========================================================= */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* =========================================================
     CURRENCY - USD
     ========================================================= */

  function formatCurrency(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value)) {
      return "$0.00";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }


  function parseAmount(value) {
    const amount = Number.parseFloat(value);

    if (!Number.isFinite(amount)) {
      return null;
    }

    return Math.round(
      (amount + Number.EPSILON) * 100
    ) / 100;
  }


  /* =========================================================
     DATE
     ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      let date;

      if (
        value &&
        typeof value.toDate === "function"
      ) {
        date = value.toDate();
      } else if (value instanceof Date) {
        date = value;
      } else {
        date = new Date(value);
      }

      if (Number.isNaN(date.getTime())) {
        return "—";
      }

      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });

    } catch (error) {
      return "—";
    }
  }


  /* =========================================================
     AUTH
     ========================================================= */

  function getCurrentFirebaseUser() {
    try {
      return getAuth().currentUser;
    } catch (error) {
      return null;
    }
  }


  function requireLogin() {
    const user = getCurrentFirebaseUser();

    if (!user) {
      window.location.href = "login.html";
      return null;
    }

    return user;
  }


  /* =========================================================
     USER PROFILE
     ========================================================= */

  async function loadUserProfile(uid) {
    const db = getDB();

    const doc = await db
      .collection(CONFIG.USERS_COLLECTION)
      .doc(uid)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      uid: uid,
      ...doc.data()
    };
  }


  /* =========================================================
     BALANCE
     ========================================================= */

  function renderBalance(profile) {
    if (!profile) {
      return;
    }

    const balance =
      Number(profile.balance || 0);

    const pendingBalance =
      Number(profile.pendingBalance || 0);

    const balanceText =
      formatCurrency(balance);

    const pendingText =
      formatCurrency(pendingBalance);

    [
      "wallet-balance",
      "balance",
      "user-balance",
      "available-balance",
      "availableBalance"
    ].forEach(function (id) {
      setText(id, balanceText);
    });

    [
      "pending-balance",
      "pendingBalance",
      "wallet-pending-balance"
    ].forEach(function (id) {
      setText(id, pendingText);
    });
  }


  /* =========================================================
     TRANSACTIONS
     ========================================================= */

  function getTransactionLabel(transaction) {
    const type =
      String(transaction.type || "")
        .toLowerCase();

    if (
      type.includes("withdraw") ||
      type.includes("debit") ||
      Number(transaction.amount || 0) < 0
    ) {
      return "Wallet Withdrawal";
    }

    if (
      type.includes("deposit") ||
      type.includes("credit") ||
      Number(transaction.amount || 0) >= 0
    ) {
      return "Wallet Deposit";
    }

    return "Wallet Transaction";
  }


  function isCreditTransaction(transaction) {
    const type =
      String(transaction.type || "")
        .toLowerCase();

    if (
      type.includes("withdraw") ||
      type.includes("debit")
    ) {
      return false;
    }

    return Number(transaction.amount || 0) >= 0;
  }


  async function loadTransactions(uid) {
    const db = getDB();

    try {
      const snapshot = await db
        .collection(
          CONFIG.TRANSACTIONS_COLLECTION
        )
        .where("uid", "==", uid)
        .limit(100)
        .get();

      const transactions = [];

      snapshot.forEach(function (doc) {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      transactions.sort(function (a, b) {
        const aTime =
          a.createdAt &&
          typeof a.createdAt.toMillis === "function"
            ? a.createdAt.toMillis()
            : new Date(
                a.createdAt || 0
              ).getTime();

        const bTime =
          b.createdAt &&
          typeof b.createdAt.toMillis === "function"
            ? b.createdAt.toMillis()
            : new Date(
                b.createdAt || 0
              ).getTime();

        return bTime - aTime;
      });

      renderTransactions(transactions);

      return transactions;

    } catch (error) {
      console.error(
        "Transaction loading error:",
        error
      );

      renderTransactions([]);

      return [];
    }
  }


  function renderTransactions(transactions) {
    const container =
      $("transaction-list") ||
      $("transactions-list") ||
      $("wallet-transactions");

    if (!container) {
      return;
    }

    if (!transactions.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No transactions yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML =
      transactions.map(function (transaction) {

        const amount =
          Number(transaction.amount || 0);

        const credit =
          isCreditTransaction(transaction);

        return `
          <div class="transaction-item">

            <div class="transaction-info">
              <strong>
                ${escapeHtml(
                  getTransactionLabel(transaction)
                )}
              </strong>

              <small>
                ${escapeHtml(
                  formatDate(
                    transaction.createdAt
                  )
                )}
              </small>
            </div>

            <div class="transaction-amount ${
              credit ? "credit" : "debit"
            }">

              ${credit ? "+" : "-"}${formatCurrency(
                Math.abs(amount)
              )}

            </div>

          </div>
        `;
      }).join("");
  }


  /* =========================================================
     PAYPAL PAYMENT
     ========================================================= */

  function openPayPalPayment() {
    window.open(
      CONFIG.PAYPAL_PAYMENT_LINK,
      "_blank",
      "noopener,noreferrer"
    );
  }


  /* =========================================================
     PAYMENT METHOD UI
     ========================================================= */

  function setupPaymentMethodUI() {

    const select =
      $("payment-method");

    if (select) {
      select.innerHTML = `
        <option value="paypal">
          PayPal
        </option>
      `;

      select.value = "paypal";
    }

    const radios =
      document.querySelectorAll(
        'input[name="payment-method"]'
      );

    radios.forEach(function (radio) {

      radio.checked =
        radio.value === "paypal";

      if (radio.value !== "paypal") {

        const parent =
          radio.closest(
            ".payment-method, .method-option, label"
          );

        if (parent) {
          parent.style.display = "none";
        }
      }
    });

    showPaymentInstructions();
  }


  /* =========================================================
     PAYPAL INSTRUCTIONS
     ========================================================= */

  function showPaymentInstructions() {

    const container =
      $("payment-instructions") ||
      $("payment-method-instructions") ||
      $("deposit-instructions");

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="payment-instructions paypal-instructions">

        <h3>Pay with PayPal</h3>

        <p>
          Add funds to your SocialWorkBD wallet
          using PayPal.
        </p>

        <a
          href="${escapeHtml(
            CONFIG.PAYPAL_PAYMENT_LINK
          )}"
          target="_blank"
          rel="noopener noreferrer"
          class="paypal-payment-btn"
          style="
            display:inline-block;
            padding:12px 20px;
            border-radius:8px;
            text-decoration:none;
            margin:10px 0;
          "
        >
          Pay with PayPal
        </a>

        <ol>
          <li>
            Enter the USD amount you want to add.
          </li>

          <li>
            Click <strong>Pay with PayPal</strong>.
          </li>

          <li>
            Complete the PayPal payment.
          </li>

          <li>
            Copy your PayPal transaction/reference
            information.
          </li>

          <li>
            Enter that reference below.
          </li>

          <li>
            Submit your payment request.
          </li>
        </ol>

        <p>
          <strong>Important:</strong>
          Your wallet balance will remain unchanged
          until the payment is verified.
        </p>

      </div>
    `;
  }


  /* =========================================================
     CREATE PAYMENT REQUEST
     ========================================================= */

  function generatePaymentId() {

    const timestamp = Date.now();

    const random =
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

    return `SWB-PAY-${timestamp}-${random}`;
  }


  async function createPaymentRequest(
    amount,
    paymentMethod,
    reference
  ) {

    const user = requireLogin();

    if (!user) {
      throw new Error(
        "Please log in first."
      );
    }

    if (paymentMethod !== "paypal") {
      throw new Error(
        "Only PayPal payments are supported."
      );
    }

    const profile =
      await loadUserProfile(user.uid);

    if (!profile) {
      throw new Error(
        "User profile could not be loaded."
      );
    }

    const paymentId =
      generatePaymentId();

    const db = getDB();

    const now =
      firebase.firestore.FieldValue
        .serverTimestamp();

    const paymentData = {

      paymentId: paymentId,

      uid: user.uid,

      accountId:
        profile.accountId || "",

      name:
        profile.name ||
        user.displayName ||
        "",

      email:
        profile.email ||
        user.email ||
        "",

      amount: Number(amount),

      currency: "USD",

      paymentMethod: "paypal",

      paymentMethodName: "PayPal",

      paymentLink:
        CONFIG.PAYPAL_PAYMENT_LINK,

      reference:
        String(reference || "").trim(),

      status: "pending",

      verificationStatus: "pending",

      createdAt: now,

      updatedAt: now
    };

    await db
      .collection(
        CONFIG.PAYMENT_REQUESTS_COLLECTION
      )
      .doc(paymentId)
      .set(paymentData);

    return paymentId;
  }


  /* =========================================================
     DEPOSIT FORM
     ========================================================= */

  function setupDepositForm() {

    const form =
      $("deposit-form") ||
      $("wallet-deposit-form") ||
      $("add-money-form");

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        const amountInput =
          $("deposit-amount") ||
          $("amount") ||
          $("wallet-amount");

        const referenceInput =
          $("payment-reference") ||
          $("reference") ||
          $("transaction-reference");

        const amount =
          parseAmount(
            amountInput
              ? amountInput.value
              : ""
          );

        const reference =
          referenceInput
            ? String(
                referenceInput.value || ""
              ).trim()
            : "";

        if (amount === null) {
          alert(
            "Please enter a valid USD amount."
          );
          return;
        }

        if (
          amount < CONFIG.MIN_DEPOSIT
        ) {
          alert(
            `Minimum deposit is ${formatCurrency(
              CONFIG.MIN_DEPOSIT
            )}.`
          );
          return;
        }

        if (
          amount > CONFIG.MAX_DEPOSIT
        ) {
          alert(
            `Maximum deposit is ${formatCurrency(
              CONFIG.MAX_DEPOSIT
            )}.`
          );
          return;
        }

        if (!reference) {
          alert(
            "Please enter your PayPal transaction/reference ID."
          );
          return;
        }

        const submitButton =
          $("deposit-btn") ||
          $("submit-deposit") ||
          $("add-money-btn");

        const originalText =
          submitButton
            ? submitButton.textContent
            : "";

        try {

          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
              "Submitting...";
          }

          const paymentId =
            await createPaymentRequest(
              amount,
              "paypal",
              reference
            );

          alert(
            "Payment request submitted successfully.\n\n" +
            "Payment ID: " +
            paymentId +
            "\n\n" +
            "Status: Pending verification"
          );

          if (amountInput) {
            amountInput.value = "";
          }

          if (referenceInput) {
            referenceInput.value = "";
          }

          const currentUser =
            getCurrentFirebaseUser();

          if (currentUser) {
            await loadPaymentRequests(
              currentUser.uid
            );
          }

        } catch (error) {

          console.error(
            "Deposit request error:",
            error
          );

          alert(
            error && error.message
              ? error.message
              : "Could not submit payment request."
          );

        } finally {

          if (submitButton) {
            submitButton.disabled = false;

            submitButton.textContent =
              originalText ||
              "Submit Deposit";
          }
        }
      }
    );
  }


  /* =========================================================
     PAYMENT REQUEST LIST
     ========================================================= */

  async function loadPaymentRequests(uid) {

    const db = getDB();

    const container =
      $("payment-request-list") ||
      $("payment-requests-list") ||
      $("deposit-request-list");

    try {

      const snapshot =
        await db
          .collection(
            CONFIG.PAYMENT_REQUESTS_COLLECTION
          )
          .where("uid", "==", uid)
          .limit(100)
          .get();

      const requests = [];

      snapshot.forEach(function (doc) {

        requests.push({
          id: doc.id,
          ...doc.data()
        });

      });

      requests.sort(function (a, b) {

        const aTime =
          a.createdAt &&
          typeof a.createdAt.toMillis ===
            "function"
            ? a.createdAt.toMillis()
            : new Date(
                a.createdAt || 0
              ).getTime();

        const bTime =
          b.createdAt &&
          typeof b.createdAt.toMillis ===
            "function"
            ? b.createdAt.toMillis()
            : new Date(
                b.createdAt || 0
              ).getTime();

        return bTime - aTime;
      });

      if (!container) {
        return requests;
      }

      if (!requests.length) {

        container.innerHTML = `
          <div class="empty-state">
            <p>
              No payment requests yet.
            </p>
          </div>
        `;

        return requests;
      }

      container.innerHTML =
        requests.map(function (request) {

          const status =
            request.status || "pending";

          return `
            <div class="payment-request-item">

              <div class="payment-request-header">

                <strong>
                  PayPal Deposit
                </strong>

                <span
                  class="payment-status status-${escapeHtml(
                    status
                  )}"
                >
                  ${escapeHtml(status)}
                </span>

              </div>

              <div class="payment-request-details">

                <div>
                  <span>Amount</span>
                  <strong>
                    ${formatCurrency(
                      request.amount
                    )}
                  </strong>
                </div>

                <div>
                  <span>Payment ID</span>
                  <strong>
                    ${escapeHtml(
                      request.paymentId ||
                      request.id
                    )}
                  </strong>
                </div>

                <div>
                  <span>PayPal Reference</span>
                  <strong>
                    ${escapeHtml(
                      request.reference ||
                      "—"
                    )}
                  </strong>
                </div>

                <div>
                  <span>Date</span>
                  <strong>
                    ${escapeHtml(
                      formatDate(
                        request.createdAt
                      )
                    )}
                  </strong>
                </div>

              </div>

            </div>
          `;

        }).join("");

      return requests;

    } catch (error) {

      console.error(
        "Payment request loading error:",
        error
      );

      if (container) {

        container.innerHTML = `
          <div class="empty-state">
            <p>
              Unable to load payment requests.
            </p>
          </div>
        `;
      }

      return [];
    }
  }


  /* =========================================================
     QUICK AMOUNTS
     ========================================================= */

  function setupQuickAmounts() {

    const amountInput =
      $("deposit-amount") ||
      $("amount") ||
      $("wallet-amount");

    if (!amountInput) {
      return;
    }

    const buttons =
      document.querySelectorAll(
        "[data-deposit-amount], [data-amount]"
      );

    buttons.forEach(function (button) {

      button.addEventListener(
        "click",
        function () {

          const value =
            button.getAttribute(
              "data-deposit-amount"
            ) ||
            button.getAttribute(
              "data-amount"
            );

          if (value) {
            amountInput.value = value;
          }
        }
      );
    });
  }


  /* =========================================================
     LOGOUT
     ========================================================= */

  function setupLogout() {

    const buttons =
      document.querySelectorAll(
        "#logout-btn, #logout, [data-action='logout']"
      );

    buttons.forEach(function (button) {

      button.addEventListener(
        "click",
        async function () {

          try {

            await getAuth().signOut();

            localStorage.removeItem(
              "currentUser"
            );

            window.location.href =
              "login.html";

          } catch (error) {

            console.error(
              "Logout error:",
              error
            );

            alert(
              "Could not log out."
            );
          }
        }
      );
    });
  }


  /* =========================================================
     REFRESH
     ========================================================= */

  function setupRefresh() {

    const buttons =
      document.querySelectorAll(
        "#refresh-wallet, #refresh-btn, [data-action='refresh-wallet']"
      );

    buttons.forEach(function (button) {

      button.addEventListener(
        "click",
        async function () {

          await refreshWallet();

        }
      );
    });
  }


  /* =========================================================
     REFRESH WALLET
     ========================================================= */

  async function refreshWallet() {

    const user =
      requireLogin();

    if (!user) {
      return;
    }

    try {

      const profile =
        await loadUserProfile(
          user.uid
        );

      if (!profile) {
        return;
      }

      renderBalance(profile);

      await loadTransactions(
        user.uid
      );

      await loadPaymentRequests(
        user.uid
      );

    } catch (error) {

      console.error(
        "Wallet refresh error:",
        error
      );
    }
  }


  /* =========================================================
     ACCOUNT STATUS
     ========================================================= */

  function isBlockedStatus(status) {

    const value =
      String(status || "")
        .toLowerCase();

    return (
      value === "suspended" ||
      value === "restricted"
    );
  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  async function initWallet() {

    try {

      const user =
        requireLogin();

      if (!user) {
        return;
      }

      const profile =
        await loadUserProfile(
          user.uid
        );

      if (!profile) {
        console.warn(
          "SocialWorkBD profile not found."
        );
        return;
      }

      if (
        isBlockedStatus(
          profile.accountStatus
        )
      ) {

        alert(
          "Your account is currently restricted. " +
          "Wallet actions may be unavailable."
        );
      }

      renderBalance(profile);

      setupPaymentMethodUI();
      setupDepositForm();
      setupQuickAmounts();
      setupLogout();
      setupRefresh();

      await loadTransactions(
        user.uid
      );

      await loadPaymentRequests(
        user.uid
      );

    } catch (error) {

      console.error(
        "Wallet initialization error:",
        error
      );
    }
  }


  /* =========================================================
     AUTH LISTENER
     ========================================================= */

  function setupAuthListener() {

    try {

      getAuth().onAuthStateChanged(
        async function (user) {

          if (!user) {
            return;
          }

          await initWallet();
        }
      );

    } catch (error) {

      console.error(
        "Auth listener error:",
        error
      );
    }
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.SocialWorkBDWallet = {

    refresh:
      refreshWallet,

    formatCurrency:
      formatCurrency,

    openPayPalPayment:
      openPayPalPayment,

    createPaymentRequest:
      createPaymentRequest,

    loadPaymentRequests:
      loadPaymentRequests,

    getConfig: function () {

      return {

        currency: "USD",

        minDeposit:
          CONFIG.MIN_DEPOSIT,

        maxDeposit:
          CONFIG.MAX_DEPOSIT,

        paymentMethod:
          "paypal",

        paymentLink:
          CONFIG.PAYPAL_PAYMENT_LINK
      };
    }
  };


  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      setupAuthListener
    );

  } else {

    setupAuthListener();

  }

})();
