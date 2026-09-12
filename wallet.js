/* =========================================================
   SocialWorkBD - Wallet
   Firebase Wallet + Payment Integration
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Configuration
  --------------------------------------------------------- */

  const CONFIG = {
    currency: "USD",

    /*
      Set this to your secure backend payment endpoint.

      Example:
      https://your-backend-domain.com/api/payment/create

      Do NOT put SSLCommerz Store Password or Secret Key here.
    */
    PAYMENT_API_URL:
      window.SOCIALWORKBD_PAYMENT_API || "",

    TRANSACTIONS_COLLECTION:
      "walletTransactions",

    USERS_COLLECTION:
      "users"
  };

  /* ---------------------------------------------------------
     Firebase Helpers
  --------------------------------------------------------- */

  function getFirebase() {
    if (
      typeof firebase === "undefined"
    ) {
      throw new Error(
        "Firebase is not loaded."
      );
    }

    if (
      !firebase.apps ||
      !firebase.apps.length
    ) {
      throw new Error(
        "Firebase has not been initialized."
      );
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
     DOM Helpers
  --------------------------------------------------------- */

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = getElement(id);

    if (element) {
      element.textContent =
        value === null ||
        value === undefined
          ? ""
          : String(value);
    }
  }

  function showElement(id) {
    const element = getElement(id);

    if (element) {
      element.style.display = "";
    }
  }

  function hideElement(id) {
    const element = getElement(id);

    if (element) {
      element.style.display = "none";
    }
  }

  function showMessage(message) {
    alert(message);
  }

  /* ---------------------------------------------------------
     HTML Helpers
  --------------------------------------------------------- */

  function escapeHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  /* ---------------------------------------------------------
     Currency Helpers
  --------------------------------------------------------- */

  function formatCurrency(amount) {
    const value = Number(amount || 0);

    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: CONFIG.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ).format(value);
  }

  function parseAmount(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.round(
      amount * 100
    ) / 100;
  }

  /* ---------------------------------------------------------
     Date Helpers
  --------------------------------------------------------- */

  function formatDate(timestamp) {
    if (!timestamp) {
      return "Recently";
    }

    try {
      let date;

      if (
        timestamp.toDate &&
        typeof timestamp.toDate ===
          "function"
      ) {
        date = timestamp.toDate();
      } else if (
        timestamp instanceof Date
      ) {
        date = timestamp;
      } else {
        date = new Date(timestamp);
      }

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "Recently";
      }

      return date.toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric"
        }
      );
    } catch (error) {
      return "Recently";
    }
  }

  /* ---------------------------------------------------------
     Local User Helpers
  --------------------------------------------------------- */

  function getLocalUser() {
    try {
      return JSON.parse(
        localStorage.getItem(
          "currentUser"
        ) || "null"
      );
    } catch (error) {
      return null;
    }
  }

  function saveLocalUser(profile) {
    if (!profile) {
      return;
    }

    const existing =
      getLocalUser() || {};

    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        ...existing,
        id:
          profile.uid ||
          profile.id ||
          existing.id ||
          "",
        uid:
          profile.uid ||
          profile.id ||
          existing.uid ||
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
          Number(
            profile.balance || 0
          ),
        pendingBalance:
          Number(
            profile.pendingBalance || 0
          ),
        status:
          profile.status ||
          existing.status ||
          "active"
      })
    );
  }

  /* ---------------------------------------------------------
     Authentication
  --------------------------------------------------------- */

  async function requireAuthenticatedUser() {
    const auth = getAuth();

    const user =
      auth.currentUser;

    if (!user) {
      window.location.href =
        "login.html";

      return null;
    }

    return user;
  }

  /* ---------------------------------------------------------
     User Profile
  --------------------------------------------------------- */

  async function loadUserProfile(uid) {
    if (!uid) {
      return null;
    }

    const db = getDB();

    const snapshot =
      await db
        .collection(
          CONFIG.USERS_COLLECTION
        )
        .doc(uid)
        .get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  /* ---------------------------------------------------------
     Wallet State
  --------------------------------------------------------- */

  let currentUser = null;
  let currentProfile = null;

  /* ---------------------------------------------------------
     Render Balance
  --------------------------------------------------------- */

  function renderBalance(profile) {
    if (!profile) {
      return;
    }

    const balance =
      Number(
        profile.balance || 0
      );

    const pendingBalance =
      Number(
        profile.pendingBalance || 0
      );

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
      formatCurrency(
        pendingBalance
      )
    );

    setText(
      "pending-balance",
      formatCurrency(
        pendingBalance
      )
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

  /* ---------------------------------------------------------
     Empty Transactions
  --------------------------------------------------------- */

  function renderEmptyTransactions() {
    const containers = [
      "wallet-transactions",
      "transactions-list",
      "transaction-list",
      "wallet-history"
    ];

    let rendered = false;

    containers.forEach(
      function (id) {
        const container =
          getElement(id);

        if (!container) {
          return;
        }

        if (rendered) {
          return;
        }

        container.innerHTML = `
          <div class="empty-state">
            <p>No wallet transactions yet.</p>
          </div>
        `;

        rendered = true;
      }
    );
  }

  /* ---------------------------------------------------------
     Transaction Type
  --------------------------------------------------------- */

  function getTransactionLabel(
    transaction
  ) {
    const type =
      String(
        transaction.type || ""
      ).toLowerCase();

    if (
      type === "deposit" ||
      type === "add_money" ||
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

    if (
      type === "refund"
    ) {
      return "Refund";
    }

    if (
      type === "fee"
    ) {
      return "Service Fee";
    }

    return "Wallet Transaction";
  }

  /* ---------------------------------------------------------
     Transaction Status
  --------------------------------------------------------- */

  function getTransactionStatus(
    transaction
  ) {
    return (
      transaction.status ||
      "completed"
    );
  }

  /* ---------------------------------------------------------
     Render Transactions
  --------------------------------------------------------- */

  function renderTransactions(
    transactions
  ) {
    const containers = [
      "wallet-transactions",
      "transactions-list",
      "transaction-list",
      "wallet-history"
    ];

    let container = null;

    for (
      let i = 0;
      i < containers.length;
      i++
    ) {
      const element =
        getElement(
          containers[i]
        );

      if (element) {
        container = element;
        break;
      }
    }

    if (!container) {
      return;
    }

    if (
      !transactions ||
      !transactions.length
    ) {
      renderEmptyTransactions();
      return;
    }

    container.innerHTML =
      transactions
        .map(
          function (transaction) {
            const amount =
              Number(
                transaction.amount || 0
              );

            const type =
              String(
                transaction.type || ""
              ).toLowerCase();

            const isCredit =
              [
                "deposit",
                "add_money",
                "payment",
                "earning",
                "job_earning",
                "refund"
              ].includes(type);

            const amountPrefix =
              isCredit
                ? "+"
                : "-";

            const status =
              getTransactionStatus(
                transaction
              );

            return `
              <div class="wallet-transaction">
                <div class="transaction-info">
                  <strong>
                    ${escapeHtml(
                      getTransactionLabel(
                        transaction
                      )
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
                      formatDate(
                        transaction.createdAt
                      )
                    )}
                  </small>
                </div>

                <div class="transaction-amount">
                  <strong>
                    ${amountPrefix}${escapeHtml(
                      formatCurrency(
                        amount
                      )
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      status
                    )}
                  </small>
                </div>
              </div>
            `;
          }
        )
        .join("");
  }

  /* ---------------------------------------------------------
     Load Wallet Transactions
  --------------------------------------------------------- */

  async function loadTransactions(
    uid
  ) {
    if (!uid) {
      return;
    }

    const db = getDB();

    try {
      const snapshot =
        await db
          .collection(
            CONFIG.TRANSACTIONS_COLLECTION
          )
          .where(
            "uid",
            "==",
            uid
          )
          .limit(100)
          .get();

      const transactions = [];

      snapshot.forEach(
        function (doc) {
          transactions.push({
            id: doc.id,
            ...doc.data()
          });
        }
      );

      transactions.sort(
        function (a, b) {
          const aTime =
            a.createdAt &&
            typeof a.createdAt.toMillis ===
              "function"
              ? a.createdAt.toMillis()
              : 0;

          const bTime =
            b.createdAt &&
            typeof b.createdAt.toMillis ===
              "function"
              ? b.createdAt.toMillis()
              : 0;

          return (
            bTime - aTime
          );
        }
      );

      renderTransactions(
        transactions
      );
    } catch (error) {
      console.error(
        "Transaction loading error:",
        error
      );

      renderEmptyTransactions();
    }
  }

  /* ---------------------------------------------------------
     Refresh Wallet
  --------------------------------------------------------- */

  async function refreshWallet() {
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

      currentProfile =
        profile;

      saveLocalUser(
        profile
      );

      renderBalance(
        profile
      );

      await loadTransactions(
        currentUser.uid
      );
    } catch (error) {
      console.error(
        "Wallet refresh error:",
        error
      );

      showMessage(
        "Wallet data could not be loaded. Please try again."
      );
    }
  }

  /* ---------------------------------------------------------
     Amount Validation
  --------------------------------------------------------- */

  function validateDepositAmount(
    amount
  ) {
    if (
      !Number.isFinite(amount)
    ) {
      return {
        valid: false,
        message:
          "Enter a valid amount."
      };
    }

    if (amount <= 0) {
      return {
        valid: false,
        message:
          "Amount must be greater than zero."
      };
    }

    if (amount < 1) {
      return {
        valid: false,
        message:
          "Minimum deposit amount is $1.00."
      };
    }

    if (amount > 10000) {
      return {
        valid: false,
        message:
          "Maximum deposit amount is $10,000.00."
      };
    }

    return {
      valid: true,
      message: ""
    };
  }

  /* ---------------------------------------------------------
     Payment Request
  --------------------------------------------------------- */

  async function createPaymentRequest(
    amount
  ) {
    if (
      !CONFIG.PAYMENT_API_URL
    ) {
      throw new Error(
        "Payment service is not configured yet."
      );
    }

    const user =
      await requireAuthenticatedUser();

    if (!user) {
      return null;
    }

    const profile =
      currentProfile ||
      await loadUserProfile(
        user.uid
      );

    if (!profile) {
      throw new Error(
        "User profile could not be loaded."
      );
    }

    const transactionId =
      "SWB-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

    const payload = {
      uid: user.uid,

      accountId:
        profile.accountId || "",

      name:
        profile.name || "",

      email:
        profile.email ||
        user.email ||
        "",

      amount: amount,

      currency:
        CONFIG.currency,

      transactionId:
        transactionId,

      returnUrl:
        window.location.origin +
        window.location.pathname,

      cancelUrl:
        window.location.origin +
        window.location.pathname,

      failUrl:
        window.location.origin +
        window.location.pathname,

      successUrl:
        window.location.origin +
        window.location.pathname
    };

    const response =
      await fetch(
        CONFIG.PAYMENT_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    if (!response.ok) {
      throw new Error(
        "Payment server returned an error."
      );
    }

    const data =
      await response.json();

    return data;
  }

  /* ---------------------------------------------------------
     Start Payment
  --------------------------------------------------------- */

  async function startPayment(
    amount,
    button
  ) {
    const validation =
      validateDepositAmount(
        amount
      );

    if (!validation.valid) {
      showMessage(
        validation.message
      );

      return;
    }

    if (
      button &&
      button.disabled
    ) {
      return;
    }

    try {
      if (button) {
        button.disabled =
          true;

        button.dataset.originalText =
          button.textContent;

        button.textContent =
          "Connecting to payment...";
      }

      const payment =
        await createPaymentRequest(
          amount
        );

      if (!payment) {
        return;
      }

      /*
        The backend must return a secure payment URL
        generated by SSLCommerz.
      */

      const paymentUrl =
        payment.paymentUrl ||
        payment.GatewayPageURL ||
        payment.gatewayPageURL ||
        payment.url ||
        "";

      if (!paymentUrl) {
        throw new Error(
          "Payment URL was not returned by the server."
        );
      }

      window.location.href =
        paymentUrl;
    } catch (error) {
      console.error(
        "Payment start error:",
        error
      );

      showMessage(
        error.message ||
          "Payment could not be started."
      );
    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          button.dataset
            .originalText ||
          "Add Money";
      }
    }
  }

  /* ---------------------------------------------------------
     Deposit Form
  --------------------------------------------------------- */

  function setupDepositForm() {
    const form =
      getElement(
        "wallet-deposit-form"
      ) ||
      getElement(
        "deposit-form"
      ) ||
      getElement(
        "add-money-form"
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
      async function (event) {
        event.preventDefault();

        const amountInput =
          getElement(
            "deposit-amount"
          ) ||
          getElement(
            "wallet-amount"
          ) ||
          getElement(
            "add-money-amount"
          ) ||
          form.querySelector(
            'input[name="amount"]'
          );

        const button =
          form.querySelector(
            'button[type="submit"]'
          ) ||
          getElement(
            "add-money-btn"
          ) ||
          getElement(
            "deposit-btn"
          );

        const amount =
          parseAmount(
            amountInput
              ? amountInput.value
              : 0
          );

        await startPayment(
          amount,
          button
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Quick Amount Buttons
  --------------------------------------------------------- */

  function setupQuickAmountButtons() {
    const buttons =
      document.querySelectorAll(
        "[data-wallet-amount], [data-amount]"
      );

    buttons.forEach(
      function (button) {
        button.addEventListener(
          "click",
          function () {
            const amount =
              button.dataset
                .walletAmount ||
              button.dataset
                .amount ||
              "";

            const input =
              getElement(
                "deposit-amount"
              ) ||
              getElement(
                "wallet-amount"
              ) ||
              getElement(
                "add-money-amount"
              );

            if (input) {
              input.value =
                amount;

              input.focus();
            }
          }
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Payment Return Handling
  --------------------------------------------------------- */

  async function handlePaymentReturn() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const status =
      (
        params.get(
          "status"
        ) || ""
      ).toLowerCase();

    const tranId =
      params.get(
        "tran_id"
      ) ||
      params.get(
        "tranId"
      ) ||
      params.get(
        "transaction_id"
      ) ||
      "";

    const valId =
      params.get(
        "val_id"
      ) ||
      "";

    if (
      !status &&
      !tranId &&
      !valId
    ) {
      return;
    }

    /*
      Never update the wallet balance from URL parameters.

      The server must validate the SSLCommerz transaction
      and update Firestore after successful verification.
    */

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
        "Payment received. Your wallet will update after payment verification."
      );

      cleanPaymentQuery();

      await refreshWallet();

      return;
    }

    if (
      tranId ||
      valId
    ) {
      cleanPaymentQuery();
    }
  }

  /* ---------------------------------------------------------
     Clean Payment Query
  --------------------------------------------------------- */

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
        if (
          button.dataset
            .walletLogoutInitialized ===
          "true"
        ) {
          return;
        }

        button.dataset
          .walletLogoutInitialized =
          "true";

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
                "Logout could not be completed."
              );
            }
          }
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Manual Refresh
  --------------------------------------------------------- */

  function setupRefreshButton() {
    const buttons =
      document.querySelectorAll(
        "#refresh-wallet, [data-action='refresh-wallet']"
      );

    buttons.forEach(
      function (button) {
        button.addEventListener(
          "click",
          async function (event) {
            event.preventDefault();

            const originalText =
              button.textContent;

            button.disabled =
              true;

            button.textContent =
              "Refreshing...";

            try {
              await refreshWallet();
            } finally {
              button.disabled =
                false;

              button.textContent =
                originalText ||
                "Refresh";
            }
          }
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Wallet Auth State
  --------------------------------------------------------- */

  function setupWalletAuthState() {
    const auth =
      getAuth();

    auth.onAuthStateChanged(
      async function (user) {
        if (!user) {
          window.location.href =
            "login.html";

          return;
        }

        currentUser =
          user;

        try {
          currentProfile =
            await loadUserProfile(
              user.uid
            );

          if (
            !currentProfile
          ) {
            showMessage(
              "Your user profile could not be found."
            );

            return;
          }

          if (
            currentProfile.status ===
            "suspended"
          ) {
            await auth.signOut();

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

  /* ---------------------------------------------------------
     Initialize
  --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     Start
  --------------------------------------------------------- */

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
