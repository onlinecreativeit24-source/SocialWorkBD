/* =========================================================
   SocialWorkBD - Wallet
   Firebase Wallet + SSLCommerz Payment Integration
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Configuration
  --------------------------------------------------------- */

  const PAYMENT_API_URL = "/api/payment/create";

  const MIN_DEPOSIT = 10;
  const MAX_DEPOSIT = 100000;

  let currentUser = null;
  let currentProfile = null;

  /* ---------------------------------------------------------
     Firebase
  --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     Helpers
  --------------------------------------------------------- */

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    const amount = Number(value || 0);

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return "Recently";
    }

    try {
      let date;

      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else {
        date = new Date(timestamp);
      }

      return date.toLocaleString("en-US", {
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

  function showMessage(message, type) {
    const element =
      document.getElementById("wallet-message");

    if (!element) {
      alert(message);
      return;
    }

    element.textContent = message;
    element.className =
      "wallet-message " + (type || "info");

    element.style.display = "block";
  }

  function hideMessage() {
    const element =
      document.getElementById("wallet-message");

    if (!element) return;

    element.style.display = "none";
    element.textContent = "";
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;

    if (loading) {
      button.disabled = true;
      button.dataset.originalText =
        button.textContent;
      button.textContent =
        text || "Processing...";
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        "Continue to Payment";
    }
  }

  /* ---------------------------------------------------------
     Authentication
  --------------------------------------------------------- */

  async function requireUser() {
    const auth = getAuth();

    const user = auth.currentUser;

    if (!user) {
      window.location.href =
        "login.html?redirect=" +
        encodeURIComponent(
          window.location.href
        );

      return null;
    }

    currentUser = user;

    return user;
  }

  /* ---------------------------------------------------------
     User Profile
  --------------------------------------------------------- */

  async function loadProfile() {
    if (!currentUser) {
      return null;
    }

    try {
      const db = getDB();

      const snapshot =
        await db
          .collection("users")
          .doc(currentUser.uid)
          .get();

      if (!snapshot.exists) {
        throw new Error(
          "User profile was not found."
        );
      }

      currentProfile = {
        uid: currentUser.uid,
        ...snapshot.data()
      };

      return currentProfile;
    } catch (error) {
      console.error(
        "Wallet profile error:",
        error
      );

      throw error;
    }
  }

  /* ---------------------------------------------------------
     Wallet Balance
  --------------------------------------------------------- */

  function renderBalance() {
    if (!currentProfile) return;

    const balance =
      Number(currentProfile.balance || 0);

    const pendingBalance =
      Number(
        currentProfile.pendingBalance || 0
      );

    const balanceElements = [
      document.getElementById("wallet-balance"),
      document.getElementById("balance"),
      document.querySelector(
        "[data-wallet-balance]"
      )
    ];

    balanceElements.forEach(function (element) {
      if (element) {
        element.textContent =
          formatMoney(balance);
      }
    });

    const pendingElements = [
      document.getElementById(
        "pending-balance"
      ),
      document.querySelector(
        "[data-pending-balance]"
      )
    ];

    pendingElements.forEach(function (element) {
      if (element) {
        element.textContent =
          formatMoney(pendingBalance);
      }
    });
  }

  /* ---------------------------------------------------------
     Payment Amount
  --------------------------------------------------------- */

  function getDepositAmount() {
    const input =
      document.getElementById(
        "deposit-amount"
      ) ||
      document.getElementById(
        "amount"
      );

    if (!input) {
      throw new Error(
        "Deposit amount field was not found."
      );
    }

    const amount =
      Number(input.value);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Please enter a valid payment amount."
      );
    }

    if (amount < MIN_DEPOSIT) {
      throw new Error(
        "Minimum deposit amount is $" +
        MIN_DEPOSIT +
        "."
      );
    }

    if (amount > MAX_DEPOSIT) {
      throw new Error(
        "Maximum deposit amount is $" +
        MAX_DEPOSIT +
        "."
      );
    }

    return Number(
      amount.toFixed(2)
    );
  }

  /* ---------------------------------------------------------
     Create Payment
  --------------------------------------------------------- */

  async function createPayment(amount) {
    if (!currentUser) {
      throw new Error(
        "Please log in before making a payment."
      );
    }

    /*
      The Firebase ID token proves the identity
      of the logged-in user to the backend.
    */

    const token =
      await currentUser.getIdToken(true);

    const response =
      await fetch(
        PAYMENT_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " + token
          },

          body: JSON.stringify({
            amount: amount,

            currency: "USD",

            userId:
              currentUser.uid,

            accountId:
              currentProfile &&
              currentProfile.accountId
                ? currentProfile.accountId
                : ""
          })
        }
      );

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error(
        "Invalid payment server response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data &&
        data.message
          ? data.message
          : "Unable to create payment."
      );
    }

    if (!data) {
      throw new Error(
        "Payment server returned no data."
      );
    }

    return data;
  }

  /* ---------------------------------------------------------
     Redirect To SSLCommerz
  --------------------------------------------------------- */

  function redirectToPayment(data) {
    /*
      Backend may return the SSLCommerz
      Gateway URL using one of these fields.
    */

    const paymentUrl =
      data.paymentUrl ||
      data.gatewayUrl ||
      data.GatewayPageURL ||
      data.url;

    if (!paymentUrl) {
      throw new Error(
        "Payment gateway URL was not returned."
      );
    }

    window.location.href =
      paymentUrl;
  }

  /* ---------------------------------------------------------
     Start Deposit
  --------------------------------------------------------- */

  async function handleDeposit(event) {
    if (event) {
      event.preventDefault();
    }

    hideMessage();

    const button =
      document.getElementById(
        "deposit-btn"
      ) ||
      document.getElementById(
        "add-money-btn"
      ) ||
      document.querySelector(
        "[data-deposit-button]"
      );

    try {
      const user =
        await requireUser();

      if (!user) {
        return;
      }

      if (!currentProfile) {
        await loadProfile();
      }

      const amount =
        getDepositAmount();

      const confirmed =
        window.confirm(
          "Continue with a $" +
          amount.toFixed(2) +
          " wallet deposit?"
        );

      if (!confirmed) {
        return;
      }

      setButtonLoading(
        button,
        true,
        "Creating Payment..."
      );

      const payment =
        await createPayment(
          amount
        );

      /*
        Important:
        Do not update wallet balance here.

        Balance must be updated only after
        SSLCommerz confirms the payment on
        the secure backend.
      */

      redirectToPayment(
        payment
      );
    } catch (error) {
      console.error(
        "Deposit error:",
        error
      );

      showMessage(
        error.message ||
        "Unable to start payment.",
        "error"
      );

      setButtonLoading(
        button,
        false
      );
    }
  }

  /* ---------------------------------------------------------
     Transaction History
  --------------------------------------------------------- */

  async function loadTransactions() {
    if (!currentUser) return;

    const container =
      document.getElementById(
        "transaction-list"
      );

    if (!container) return;

    container.innerHTML =
      '<div class="transaction-loading">Loading transactions...</div>';

    try {
      const db = getDB();

      const snapshot =
        await db
          .collection("transactions")
          .where(
            "userId",
            "==",
            currentUser.uid
          )
          .limit(50)
          .get();

      const transactions = [];

      snapshot.forEach(function (doc) {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      transactions.sort(
        function (a, b) {
          const aTime =
            a.createdAt &&
            a.createdAt.toMillis
              ? a.createdAt.toMillis()
              : 0;

          const bTime =
            b.createdAt &&
            b.createdAt.toMillis
              ? b.createdAt.toMillis()
              : 0;

          return bTime - aTime;
        }
      );

      if (!transactions.length) {
        container.innerHTML =
          '<div class="transaction-empty">No transactions yet.</div>';

        return;
      }

      container.innerHTML =
        transactions
          .map(
            function (transaction) {
              return renderTransaction(
                transaction
              );
            }
          )
          .join("");
    } catch (error) {
      console.error(
        "Transaction loading error:",
        error
      );

      container.innerHTML =
        '<div class="transaction-error">Unable to load transaction history.</div>';
    }
  }

  /* ---------------------------------------------------------
     Render Transaction
  --------------------------------------------------------- */

  function renderTransaction(transaction) {
    const status =
      transaction.status ||
      "pending";

    const type =
      transaction.type ||
      "deposit";

    const amount =
      Number(
        transaction.amount || 0
      );

    const statusClass =
      String(status)
        .toLowerCase()
        .replace(/\s+/g, "-");

    const typeLabel =
      type === "deposit"
        ? "Wallet Deposit"
        : type === "withdrawal"
          ? "Withdrawal"
          : "Transaction";

    return `
      <div class="transaction-item">

        <div class="transaction-main">

          <div class="transaction-title">
            ${escapeHtml(typeLabel)}
          </div>

          <div class="transaction-date">
            ${escapeHtml(
              formatDate(
                transaction.createdAt
              )
            )}
          </div>

          ${
            transaction.tranId
              ? `
                <div class="transaction-id">
                  ID:
                  ${escapeHtml(
                    transaction.tranId
                  )}
                </div>
              `
              : ""
          }

        </div>

        <div class="transaction-right">

          <div class="transaction-amount">
            ${escapeHtml(
              formatMoney(amount)
            )}
          </div>

          <div class="transaction-status ${escapeHtml(
            statusClass
          )}">
            ${escapeHtml(status)}
          </div>

        </div>

      </div>
    `;
  }

  /* ---------------------------------------------------------
     Payment Result
  --------------------------------------------------------- */

  async function checkPaymentResult() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const paymentStatus =
      params.get("payment");

    const transactionId =
      params.get("tran_id");

    if (!paymentStatus) {
      return;
    }

    if (
      paymentStatus === "success"
    ) {
      showMessage(
        transactionId
          ? "Payment submitted successfully. Transaction: " +
            transactionId
          : "Payment submitted successfully.",
        "success"
      );
    }

    if (
      paymentStatus === "failed"
    ) {
      showMessage(
        "Payment failed. Your wallet was not credited.",
        "error"
      );
    }

    if (
      paymentStatus === "cancelled"
    ) {
      showMessage(
        "Payment was cancelled. Your wallet was not credited.",
        "error"
      );
    }

    /*
      Remove payment query parameters
      after displaying the result.
    */

    try {
      const cleanUrl =
        window.location.pathname;

      window.history.replaceState(
        {},
        document.title,
        cleanUrl
      );
    } catch (error) {
      console.warn(
        "Unable to clean payment URL:",
        error
      );
    }
  }

  /* ---------------------------------------------------------
     Logout
  --------------------------------------------------------- */

  function setupLogout() {
    const buttons =
      document.querySelectorAll(
        "#logout-btn, [data-action='logout']"
      );

    buttons.forEach(
      function (button) {
        button.addEventListener(
          "click",
          async function (event) {
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
                "Unable to log out.",
                "error"
              );
            }
          }
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Deposit Form
  --------------------------------------------------------- */

  function setupDepositForm() {
    const form =
      document.getElementById(
        "deposit-form"
      );

    if (!form) {
      return;
    }

    if (
      form.dataset.initialized ===
      "true"
    ) {
      return;
    }

    form.dataset.initialized =
      "true";

    form.addEventListener(
      "submit",
      handleDeposit
    );
  }

  /* ---------------------------------------------------------
     Refresh Wallet
  --------------------------------------------------------- */

  async function refreshWallet() {
    try {
      await loadProfile();

      renderBalance();

      await loadTransactions();
    } catch (error) {
      console.error(
        "Wallet refresh error:",
        error
      );

      showMessage(
        "Unable to refresh wallet data.",
        "error"
      );
    }
  }

  /* ---------------------------------------------------------
     Initialize
  --------------------------------------------------------- */

  async function init() {
    try {
      getFirebase();

      const user =
        await requireUser();

      if (!user) {
        return;
      }

      await loadProfile();

      renderBalance();

      setupDepositForm();

      setupLogout();

      await loadTransactions();

      await checkPaymentResult();

    } catch (error) {
      console.error(
        "Wallet initialization error:",
        error
      );

      showMessage(
        error.message ||
        "Unable to load wallet.",
        "error"
      );
    }
  }

  /* ---------------------------------------------------------
     Start
  --------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
