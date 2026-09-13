/* =========================================================
   SocialWorkBD - Secure Wallet
   Firebase Auth + SSLCommerz Payment Integration

   IMPORTANT:
   - No wallet balance is changed from the browser.
   - No secret/payment credential is stored here.
   - Backend verifies Firebase ID token.
   - Backend verifies SSLCommerz payment before crediting wallet.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    currency: "BDT",

    PAYMENT_API_URL:
      window.SOCIALWORKBD_PAYMENT_API ||
      "https://asia-south1-socialworkbd-b1c00.cloudfunctions.net/createPayment",

    TRANSACTIONS_COLLECTION:
      "walletTransactions",

    USERS_COLLECTION:
      "users",

    MIN_DEPOSIT: 100,
    MAX_DEPOSIT: 1000000
  };

  let currentUser = null;
  let currentProfile = null;

  /* =========================================================
     Firebase
     ========================================================= */

  function getFirebase() {
    if (typeof firebase === "undefined") {
      throw new Error("Firebase is not loaded.");
    }

    if (!firebase.apps || !firebase.apps.length) {
      throw new Error("Firebase has not been initialized.");
    }

    return {
      auth: firebase.auth(),
      db: firebase.firestore()
    };
  }

  function getAuth() {
    return getFirebase().auth;
  }

  function getDB() {
    return getFirebase().db;
  }

  /* =========================================================
     DOM
     ========================================================= */

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = getElement(id);

    if (element) {
      element.textContent =
        value === null || value === undefined
          ? ""
          : String(value);
    }
  }

  function showMessage(message) {
    alert(String(message || "Something went wrong."));
  }

  /* =========================================================
     Security / HTML
     ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================================================
     Currency
     ========================================================= */

  function formatCurrency(amount) {
    const value = Number(amount || 0);

    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: CONFIG.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function parseAmount(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.round(amount * 100) / 100;
  }

  /* =========================================================
     Date
     ========================================================= */

  function formatDate(timestamp) {
    if (!timestamp) {
      return "Recently";
    }

    try {
      let date;

      if (
        timestamp &&
        typeof timestamp.toDate === "function"
      ) {
        date = timestamp.toDate();
      } else {
        date = new Date(timestamp);
      }

      if (Number.isNaN(date.getTime())) {
        return "Recently";
      }

      return date.toLocaleString("en-BD", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch (error) {
      return "Recently";
    }
  }

  /* =========================================================
     Local User Cache
     ========================================================= */

  function saveLocalUser(profile) {
    if (!profile) {
      return;
    }

    const existing = (() => {
      try {
        return JSON.parse(
          localStorage.getItem("currentUser") || "null"
        ) || {};
      } catch (_) {
        return {};
      }
    })();

    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        ...existing,

        uid:
          profile.uid ||
          profile.id ||
          existing.uid ||
          "",

        id:
          profile.uid ||
          profile.id ||
          existing.id ||
          "",

        name:
          profile.name ||
          existing.name ||
          "",

        email:
          profile.email ||
          existing.email ||
          "",

        role:
          profile.role ||
          existing.role ||
          "worker",

        accountId:
          profile.accountId ||
          existing.accountId ||
          "",

        balance:
          Number(profile.balance || 0),

        pendingBalance:
          Number(profile.pendingBalance || 0),

        status:
          profile.status ||
          existing.status ||
          "active"
      })
    );
  }

  /* =========================================================
     Authentication
     ========================================================= */

  async function requireAuthenticatedUser() {
    const auth = getAuth();

    const user = auth.currentUser;

    if (!user) {
      window.location.href = "login.html";
      return null;
    }

    return user;
  }

  /* =========================================================
     Profile
     ========================================================= */

  async function loadUserProfile(uid) {
    if (!uid) {
      return null;
    }

    const snapshot = await getDB()
      .collection(CONFIG.USERS_COLLECTION)
      .doc(uid)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      uid: snapshot.id,
      ...snapshot.data()
    };
  }

  /* =========================================================
     Render Balance
     ========================================================= */

  function renderBalance(profile) {
    if (!profile) {
      return;
    }

    const balance =
      Number(profile.balance || 0);

    const pending =
      Number(profile.pendingBalance || 0);

    setText(
      "wallet-balance",
      formatCurrency(balance)
    );

    setText(
      "balance",
      formatCurrency(balance)
    );

    setText(
      "available-balance",
      formatCurrency(balance)
    );

    setText(
      "wallet-pending-balance",
      formatCurrency(pending)
    );

    setText(
      "pending-balance",
      formatCurrency(pending)
    );

    setText(
      "account-balance",
      formatCurrency(balance)
    );

    setText(
      "wallet-account-id",
      profile.accountId || ""
    );

    setText(
      "account-id",
      profile.accountId || ""
    );

    setText(
      "wallet-user-name",
      profile.name || ""
    );

    setText(
      "wallet-user-email",
      profile.email || ""
    );
  }

  /* =========================================================
     Transactions
     ========================================================= */

  function transactionLabel(transaction) {
    const type =
      String(transaction.type || "").toLowerCase();

    if (
      type === "deposit" ||
      type === "wallet_deposit" ||
      type === "payment"
    ) {
      return "Wallet Deposit";
    }

    if (
      type === "withdrawal" ||
      type === "withdraw"
    ) {
      return "Withdrawal";
    }

    if (
      type === "earning" ||
      type === "job_earning"
    ) {
      return "Job Earning";
    }

    if (type === "refund") {
      return "Refund";
    }

    if (type === "fee") {
      return "Service Fee";
    }

    return "Wallet Transaction";
  }

  function isCreditTransaction(transaction) {
    return [
      "deposit",
      "wallet_deposit",
      "payment",
      "earning",
      "job_earning",
      "refund"
    ].includes(
      String(transaction.type || "").toLowerCase()
    );
  }

  function renderEmptyTransactions() {
    const ids = [
      "wallet-transactions",
      "transactions-list",
      "transaction-list",
      "wallet-history"
    ];

    for (const id of ids) {
      const container = getElement(id);

      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No wallet transactions yet.</p>
          </div>
        `;
        return;
      }
    }
  }

  function renderTransactions(transactions) {
    const ids = [
      "wallet-transactions",
      "transactions-list",
      "transaction-list",
      "wallet-history"
    ];

    let container = null;

    for (const id of ids) {
      const element = getElement(id);

      if (element) {
        container = element;
        break;
      }
    }

    if (!container) {
      return;
    }

    if (!transactions.length) {
      renderEmptyTransactions();
      return;
    }

    container.innerHTML = transactions
      .map((transaction) => {
        const amount =
          Number(transaction.amount || 0);

        const credit =
          isCreditTransaction(transaction);

        const prefix =
          credit ? "+" : "-";

        return `
          <div class="wallet-transaction">
            <div class="transaction-info">
              <strong>
                ${escapeHtml(
                  transactionLabel(transaction)
                )}
              </strong>

              <small>
                ${escapeHtml(
                  transaction.description ||
                  transaction.note ||
                  ""
                )}
              </small>

              <small>
                ${escapeHtml(
                  formatDate(transaction.createdAt)
                )}
              </small>
            </div>

            <div class="transaction-amount">
              <strong>
                ${prefix}${escapeHtml(
                  formatCurrency(amount)
                )}
              </strong>

              <small>
                ${escapeHtml(
                  transaction.status || "completed"
                )}
              </small>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function loadTransactions(uid) {
    if (!uid) {
      return;
    }

    try {
      const snapshot = await getDB()
        .collection(CONFIG.TRANSACTIONS_COLLECTION)
        .where("uid", "==", uid)
        .limit(100)
        .get();

      const transactions = [];

      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      transactions.sort((a, b) => {
        const aTime =
          a.createdAt &&
          typeof a.createdAt.toMillis === "function"
            ? a.createdAt.toMillis()
            : 0;

        const bTime =
          b.createdAt &&
          typeof b.createdAt.toMillis === "function"
            ? b.createdAt.toMillis()
            : 0;

        return bTime - aTime;
      });

      renderTransactions(transactions);
    } catch (error) {
      console.error(
        "Transaction loading error:",
        error
      );

      renderEmptyTransactions();
    }
  }

  /* =========================================================
     Wallet Refresh
     ========================================================= */

  async function refreshWallet(showError = true) {
    if (!currentUser) {
      return;
    }

    try {
      const profile =
        await loadUserProfile(
          currentUser.uid
        );

      if (!profile) {
        throw new Error(
          "User profile was not found."
        );
      }

      currentProfile = profile;

      saveLocalUser(profile);

      renderBalance(profile);

      await loadTransactions(
        currentUser.uid
      );
    } catch (error) {
      console.error(
        "Wallet refresh error:",
        error
      );

      if (showError) {
        showMessage(
          "Wallet data could not be loaded."
        );
      }
    }
  }

  /* =========================================================
     Deposit Validation
     ========================================================= */

  function validateDepositAmount(amount) {
    if (!Number.isFinite(amount)) {
      return {
        valid: false,
        message: "Enter a valid amount."
      };
    }

    if (amount < CONFIG.MIN_DEPOSIT) {
      return {
        valid: false,
        message:
          "Minimum deposit is " +
          formatCurrency(CONFIG.MIN_DEPOSIT) +
          "."
      };
    }

    if (amount > CONFIG.MAX_DEPOSIT) {
      return {
        valid: false,
        message:
          "Maximum deposit is " +
          formatCurrency(CONFIG.MAX_DEPOSIT) +
          "."
      };
    }

    return {
      valid: true,
      message: ""
    };
  }

  /* =========================================================
     Create Secure Payment Request
     ========================================================= */

  async function createPaymentRequest(amount) {
    const user =
      await requireAuthenticatedUser();

    if (!user) {
      return null;
    }

    /*
      Force-refresh the ID token so the backend receives
      a valid Firebase authentication token.
    */
    const idToken =
      await user.getIdToken(true);

    const response =
      await fetch(
        CONFIG.PAYMENT_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " + idToken
          },

          body: JSON.stringify({
            amount: amount,
            productName:
              "SocialWorkBD Wallet Deposit",
            productCategory:
              "Wallet"
          })
        }
      );

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        "Payment server returned an error."
      );
    }

    if (
      !data ||
      data.success !== true
    ) {
      throw new Error(
        data?.message ||
        "Payment could not be initialized."
      );
    }

    return data;
  }

  /* =========================================================
     Start Payment
     ========================================================= */

  async function startPayment(amount, button) {
    const validation =
      validateDepositAmount(amount);

    if (!validation.valid) {
      showMessage(validation.message);
      return;
    }

    if (button?.disabled) {
      return;
    }

    const originalText =
      button?.textContent ||
      "Add Money";

    try {
      if (button) {
        button.disabled = true;
        button.textContent =
          "Connecting to payment...";
      }

      const payment =
        await createPaymentRequest(amount);

      const paymentUrl =
        payment.gatewayUrl ||
        payment.paymentUrl ||
        payment.GatewayPageURL ||
        "";

      if (!paymentUrl) {
        throw new Error(
          "Secure payment URL was not returned."
        );
      }

      /*
        Redirect directly to SSLCommerz.
      */
      window.location.assign(
        paymentUrl
      );
    } catch (error) {
      console.error(
        "Payment start error:",
        error
      );

      showMessage(
        error.message ||
        "Payment could not be started."
      );

      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  /* =========================================================
     Deposit Form
     ========================================================= */

  function setupDepositForm() {
    const form =
      getElement("wallet-deposit-form") ||
      getElement("deposit-form") ||
      getElement("add-money-form");

    if (!form) {
      return;
    }

    if (
      form.dataset.walletInitialized ===
      "true"
    ) {
      return;
    }

    form.dataset.walletInitialized = "true";

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const amountInput =
          getElement("deposit-amount") ||
          getElement("wallet-amount") ||
          getElement("add-money-amount") ||
          form.querySelector(
            'input[name="amount"]'
          );

        const button =
          form.querySelector(
            'button[type="submit"]'
          ) ||
          getElement("add-money-btn") ||
          getElement("deposit-btn");

        const amount =
          parseAmount(
            amountInput?.value || 0
          );

        await startPayment(
          amount,
          button
        );
      }
    );
  }

  /* =========================================================
     Quick Amount
     ========================================================= */

  function setupQuickAmountButtons() {
    const buttons =
      document.querySelectorAll(
        "[data-wallet-amount], [data-amount]"
      );

    buttons.forEach((button) => {
      if (
        button.dataset.walletQuickInitialized ===
        "true"
      ) {
        return;
      }

      button.dataset.walletQuickInitialized =
        "true";

      button.addEventListener(
        "click",
        () => {
          const amount =
            button.dataset.walletAmount ||
            button.dataset.amount ||
            "";

          const input =
            getElement("deposit-amount") ||
            getElement("wallet-amount") ||
            getElement("add-money-amount");

          if (input) {
            input.value = amount;
            input.focus();
          }
        }
      );
    });
  }

  /* =========================================================
     Payment Return
     ========================================================= */

  async function handlePaymentReturn() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const paymentId =
      params.get("paymentId") ||
      params.get("tran_id") ||
      "";

    const status =
      String(
        params.get("status") || ""
      ).toLowerCase();

    /*
      IMPORTANT:
      We never trust amount/status from the URL.
      The server is the source of truth.
    */

    if (!paymentId && !status) {
      return;
    }

    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "canceled"
    ) {
      showMessage(
        "Payment was not completed."
      );

      cleanPaymentQuery();
      return;
    }

    if (
      status === "success" ||
      status === "successful"
    ) {
      showMessage(
        "Payment submitted. Your wallet will update after server verification."
      );

      cleanPaymentQuery();

      await refreshWallet(false);
      return;
    }

    cleanPaymentQuery();
  }

  function cleanPaymentQuery() {
    try {
      const cleanUrl =
        window.location.origin +
        window.location.pathname;

      window.history.replaceState(
        {},
        document.title,
        cleanUrl
      );
    } catch (error) {
      console.error(
        "URL cleanup error:",
        error
      );
    }
  }

  /* =========================================================
     Logout
     ========================================================= */

  function setupLogout() {
    const buttons =
      document.querySelectorAll(
        "#logout-btn, [data-action='logout']"
      );

    buttons.forEach((button) => {
      if (
        button.dataset.walletLogoutInitialized ===
        "true"
      ) {
        return;
      }

      button.dataset.walletLogoutInitialized =
        "true";

      button.addEventListener(
        "click",
        async (event) => {
          event.preventDefault();

          try {
            await getAuth().signOut();

            localStorage.removeItem(
              "currentUser"
            );

            window.location.href =
              "index.html";
          } catch (error) {
            console.error(
              "Logout error:",
              error
            );

            showMessage(
              "Logout could not be completed."
            );
          }
        }
      );
    });
  }

  /* =========================================================
     Refresh Button
     ========================================================= */

  function setupRefreshButton() {
    const buttons =
      document.querySelectorAll(
        "#refresh-wallet, [data-action='refresh-wallet']"
      );

    buttons.forEach((button) => {
      button.addEventListener(
        "click",
        async (event) => {
          event.preventDefault();

          const originalText =
            button.textContent;

          button.disabled = true;
          button.textContent =
            "Refreshing...";

          try {
            await refreshWallet();
          } finally {
            button.disabled = false;
            button.textContent =
              originalText || "Refresh";
          }
        }
      );
    });
  }

  /* =========================================================
     Auth State
     ========================================================= */

  function setupWalletAuthState() {
    getAuth().onAuthStateChanged(
      async (user) => {
        if (!user) {
          window.location.href =
            "login.html";
          return;
        }

        currentUser = user;

        try {
          currentProfile =
            await loadUserProfile(
              user.uid
            );

          if (!currentProfile) {
            showMessage(
              "Your user profile could not be found."
            );
            return;
          }

          if (
            currentProfile.status ===
            "suspended"
          ) {
            await getAuth().signOut();

            localStorage.removeItem(
              "currentUser"
            );

            window.location.href =
              "login.html";

            return;
          }

          saveLocalUser(
            currentProfile
          );

          renderBalance(
            currentProfile
          );

          await loadTransactions(
            user.uid
          );
        } catch (error) {
          console.error(
            "Wallet auth error:",
            error
          );

          showMessage(
            "Wallet could not be loaded."
          );
        }
      }
    );
  }

  /* =========================================================
     Init
     ========================================================= */

  async function initWallet() {
    try {
      getFirebase();

      setupDepositForm();
      setupQuickAmountButtons();
      setupLogout();
      setupRefreshButton();

      await handlePaymentReturn();

      setupWalletAuthState();
    } catch (error) {
      console.error(
        "Wallet initialization error:",
        error
      );

      showMessage(
        "Wallet initialization failed."
      );
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initWallet
    );
  } else {
    initWallet();
  }
})();
