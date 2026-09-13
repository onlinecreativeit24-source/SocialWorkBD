/* =========================================================
   SocialWorkBD - Secure Manual Wallet Payments
   Methods:
   1. bKash
   2. Nagad
   3. Payoneer

   IMPORTANT:
   - app.js is NOT touched.
   - No wallet balance is changed from browser.
   - User can only create a pending payment request.
   - Admin/manual verification is required before crediting.
   - No payment password/API secret is stored here.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    currency: "BDT",

    USERS_COLLECTION: "users",

    TRANSACTIONS_COLLECTION:
      "walletTransactions",

    PAYMENT_REQUESTS_COLLECTION:
      "paymentRequests",

    MIN_DEPOSIT: 100,

    MAX_DEPOSIT: 1000000,

    PAYMENT_METHODS: {
      bkash: {
        name: "bKash",
        type: "local"
      },

      nagad: {
        name: "Nagad",
        type: "local"
      },

      payoneer: {
        name: "Payoneer",
        type: "international"
      }
    }
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
        value === null ||
        value === undefined
          ? ""
          : String(value);
    }
  }

  function showMessage(message) {
    alert(
      String(
        message ||
        "Something went wrong."
      )
    );
  }

  /* =========================================================
     HTML Security
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
    const value =
      Number(amount || 0);

    return new Intl.NumberFormat(
      "en-BD",
      {
        style: "currency",
        currency: CONFIG.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ).format(value);
  }

  function parseAmount(value) {
    const amount =
      Number(value);

    if (
      !Number.isFinite(amount)
    ) {
      return 0;
    }

    return Math.round(
      amount * 100
    ) / 100;
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
        typeof timestamp.toDate ===
          "function"
      ) {
        date =
          timestamp.toDate();
      } else {
        date =
          new Date(timestamp);
      }

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "Recently";
      }

      return date.toLocaleString(
        "en-BD",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }
      );
    } catch (_) {
      return "Recently";
    }
  }

  /* =========================================================
     Local User
     ========================================================= */

  function saveLocalUser(profile) {
    if (!profile) {
      return;
    }

    let existing = {};

    try {
      existing =
        JSON.parse(
          localStorage.getItem(
            "currentUser"
          ) || "null"
        ) || {};
    } catch (_) {
      existing = {};
    }

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

  /* =========================================================
     Authentication
     ========================================================= */

  async function requireAuthenticatedUser() {
    const auth =
      getAuth();

    const user =
      auth.currentUser;

    if (!user) {
      window.location.href =
        "login.html";

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

    const snapshot =
      await getDB()
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
      uid: snapshot.id,
      ...snapshot.data()
    };
  }

  /* =========================================================
     Balance
     ========================================================= */

  function renderBalance(profile) {
    if (!profile) {
      return;
    }

    const balance =
      Number(
        profile.balance || 0
      );

    const pending =
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

  function transactionLabel(
    transaction
  ) {
    const type =
      String(
        transaction.type || ""
      ).toLowerCase();

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

  function isCreditTransaction(
    transaction
  ) {
    return [
      "deposit",
      "wallet_deposit",
      "payment",
      "earning",
      "job_earning",
      "refund"
    ].includes(
      String(
        transaction.type || ""
      ).toLowerCase()
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
      const container =
        getElement(id);

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

  function renderTransactions(
    transactions
  ) {
    const ids = [
      "wallet-transactions",
      "transactions-list",
      "transaction-list",
      "wallet-history"
    ];

    let container = null;

    for (const id of ids) {
      const element =
        getElement(id);

      if (element) {
        container =
          element;

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

    container.innerHTML =
      transactions
        .map(
          function (transaction) {
            const amount =
              Number(
                transaction.amount || 0
              );

            const credit =
              isCreditTransaction(
                transaction
              );

            const prefix =
              credit
                ? "+"
                : "-";

            return `
              <div class="wallet-transaction">

                <div class="transaction-info">

                  <strong>
                    ${escapeHtml(
                      transactionLabel(
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
                    ${prefix}${escapeHtml(
                      formatCurrency(
                        amount
                      )
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      transaction.status ||
                      "completed"
                    )}
                  </small>

                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  async function loadTransactions(
    uid
  ) {
    if (!uid) {
      return;
    }

    try {
      const snapshot =
        await getDB()
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

          return bTime - aTime;
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

  /* =========================================================
     Refresh
     ========================================================= */

  async function refreshWallet(
    showError = true
  ) {
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

      await loadPaymentRequests(
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

    if (
      amount <
      CONFIG.MIN_DEPOSIT
    ) {
      return {
        valid: false,
        message:
          "Minimum deposit is " +
          formatCurrency(
            CONFIG.MIN_DEPOSIT
          ) +
          "."
      };
    }

    if (
      amount >
      CONFIG.MAX_DEPOSIT
    ) {
      return {
        valid: false,
        message:
          "Maximum deposit is " +
          formatCurrency(
            CONFIG.MAX_DEPOSIT
          ) +
          "."
      };
    }

    return {
      valid: true,
      message: ""
    };
  }

  /* =========================================================
     Payment Method
     ========================================================= */

  function getPaymentMethod() {
    const select =
      getElement(
        "payment-method"
      ) ||
      getElement(
        "deposit-method"
      ) ||
      document.querySelector(
        'select[name="paymentMethod"]'
      );

    if (select) {
      return String(
        select.value || ""
      ).toLowerCase();
    }

    const checked =
      document.querySelector(
        'input[name="paymentMethod"]:checked'
      );

    if (checked) {
      return String(
        checked.value || ""
      ).toLowerCase();
    }

    return "";
  }

  /* =========================================================
     Generate Payment ID
     ========================================================= */

  function generatePaymentId() {
    return (
      "SWB-PAY-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()
    );
  }

  /* =========================================================
     Create Manual Payment Request
     ========================================================= */

  async function createPaymentRequest(
    amount,
    paymentMethod,
    reference
  ) {
    const user =
      await requireAuthenticatedUser();

    if (!user) {
      return null;
    }

    const method =
      CONFIG.PAYMENT_METHODS[
        paymentMethod
      ];

    if (!method) {
      throw new Error(
        "Please select a payment method."
      );
    }

    const paymentId =
      generatePaymentId();

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

    const request = {
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

      amount: amount,

      currency:
        CONFIG.currency,

      paymentMethod:
        paymentMethod,

      paymentMethodName:
        method.name,

      reference:
        reference || "",

      status:
        "pending",

      verificationStatus:
        "pending",

      createdAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp(),

      updatedAt:
        firebase.firestore
          .FieldValue
          .serverTimestamp()
    };

    await getDB()
      .collection(
        CONFIG.PAYMENT_REQUESTS_COLLECTION
      )
      .doc(paymentId)
      .set(request);

    return paymentId;
  }

  /* =========================================================
     Payment Instructions
     ========================================================= */

  function showPaymentInstructions(
    method
  ) {
    const instruction =
      getElement(
        "payment-instructions"
      );

    if (!instruction) {
      return;
    }

    const methodConfig =
      CONFIG.PAYMENT_METHODS[
        method
      ];

    if (!methodConfig) {
      instruction.innerHTML = "";
      return;
    }

    let html = "";

    if (method === "bkash") {
      html = `
        <div class="payment-instruction">
          <h4>bKash Payment</h4>
          <p>
            Send the exact amount to the
            official SocialWorkBD bKash number.
          </p>
          <p>
            <strong>
              bKash Number:
            </strong>
            <span id="bkash-payment-number">
              Add your bKash number here
            </span>
          </p>
          <p>
            After payment, enter the transaction
            reference below and submit the request.
          </p>
        </div>
      `;
    }

    if (method === "nagad") {
      html = `
        <div class="payment-instruction">
          <h4>Nagad Payment</h4>
          <p>
            Send the exact amount to the
            official SocialWorkBD Nagad number.
          </p>
          <p>
            <strong>
              Nagad Number:
            </strong>
            <span id="nagad-payment-number">
              Add your Nagad number here
            </span>
          </p>
          <p>
            After payment, enter the transaction
            reference below and submit the request.
          </p>
        </div>
      `;
    }

    if (method === "payoneer") {
      html = `
        <div class="payment-instruction">
          <h4>Payoneer Payment</h4>
          <p>
            Use the SocialWorkBD Payoneer payment
            details provided by the administrator.
          </p>
          <p>
            <strong>
              Payoneer Account:
            </strong>
            <span id="payoneer-payment-account">
              Add your Payoneer receiving details here
            </span>
          </p>
          <p>
            After the payment is completed,
            enter the payment/reference ID below.
          </p>
        </div>
      `;
    }

    instruction.innerHTML =
      html;
  }

  /* =========================================================
     Setup Payment Method UI
     ========================================================= */

  function setupPaymentMethodUI() {
    const select =
      getElement(
        "payment-method"
      ) ||
      getElement(
        "deposit-method"
      );

    if (select) {
      select.addEventListener(
        "change",
        function () {
          showPaymentInstructions(
            String(
              select.value || ""
            ).toLowerCase()
          );
        }
      );
    }

    const radios =
      document.querySelectorAll(
        'input[name="paymentMethod"]'
      );

    radios.forEach(
      function (radio) {
        radio.addEventListener(
          "change",
          function () {
            showPaymentInstructions(
              String(
                radio.value || ""
              ).toLowerCase()
            );
          }
        );
      }
    );
  }

  /* =========================================================
     Deposit Form
     ========================================================= */

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
      form.dataset
        .walletInitialized ===
      "true"
    ) {
      return;
    }

    form.dataset
      .walletInitialized =
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

        const referenceInput =
          getElement(
            "payment-reference"
          ) ||
          getElement(
            "transaction-reference"
          ) ||
          getElement(
            "trx-id"
          ) ||
          form.querySelector(
            'input[name="reference"]'
          ) ||
          form.querySelector(
            'input[name="trxId"]'
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
            amountInput?.value ||
            0
          );

        const method =
          getPaymentMethod();

        const reference =
          String(
            referenceInput?.value ||
            ""
          ).trim();

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

        if (!method) {
          showMessage(
            "Please select a payment method."
          );
          return;
        }

        if (!reference) {
          showMessage(
            "Enter the payment transaction/reference ID."
          );
          return;
        }

        const originalText =
          button?.textContent ||
          "Submit Payment";

        try {
          if (button) {
            button.disabled =
              true;

            button.textContent =
              "Submitting...";
          }

          const paymentId =
            await createPaymentRequest(
              amount,
              method,
              reference
            );

          if (!paymentId) {
            throw new Error(
              "Payment request could not be created."
            );
          }

          showMessage(
            "Payment request submitted successfully.\n\n" +
            "Payment ID: " +
            paymentId +
            "\n\n" +
            "Your payment will be reviewed before your wallet is credited."
          );

          if (amountInput) {
            amountInput.value = "";
          }

          if (referenceInput) {
            referenceInput.value = "";
          }

          await loadPaymentRequests(
            currentUser.uid
          );
        } catch (error) {
          console.error(
            "Payment request error:",
            error
          );

          showMessage(
            error.message ||
            "Payment request could not be submitted."
          );
        } finally {
          if (button) {
            button.disabled =
              false;

            button.textContent =
              originalText;
          }
        }
      }
    );
  }

  /* =========================================================
     Payment Requests
     ========================================================= */

  async function loadPaymentRequests(
    uid
  ) {
    if (!uid) {
      return;
    }

    const container =
      getElement(
        "payment-requests"
      );

    if (!container) {
      return;
    }

    try {
      const snapshot =
        await getDB()
          .collection(
            CONFIG.PAYMENT_REQUESTS_COLLECTION
          )
          .where(
            "uid",
            "==",
            uid
          )
          .limit(50)
          .get();

      const requests = [];

      snapshot.forEach(
        function (doc) {
          requests.push({
            id: doc.id,
            ...doc.data()
          });
        }
      );

      requests.sort(
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

          return bTime - aTime;
        }
      );

      if (!requests.length) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No payment requests yet.</p>
          </div>
        `;

        return;
      }

      container.innerHTML =
        requests
          .map(
            function (request) {
              return `
                <div class="payment-request">

                  <div>
                    <strong>
                      ${escapeHtml(
                        request.paymentMethodName ||
                        request.paymentMethod ||
                        "Payment"
                      )}
                    </strong>

                    <p>
                      ${escapeHtml(
                        formatCurrency(
                          request.amount
                        )
                      )}
                    </p>

                    <small>
                      ID:
                      ${escapeHtml(
                        request.paymentId ||
                        request.id
                      )}
                    </small>

                    <small>
                      Reference:
                      ${escapeHtml(
                        request.reference ||
                        "—"
                      )}
                    </small>

                    <small>
                      ${escapeHtml(
                        formatDate(
                          request.createdAt
                        )
                      )}
                    </small>
                  </div>

                  <strong>
                    ${escapeHtml(
                      request.status ||
                      "pending"
                    )}
                  </strong>

                </div>
              `;
            }
          )
          .join("");
    } catch (error) {
      console.error(
        "Payment request loading error:",
        error
      );
    }
  }

  /* =========================================================
     Quick Amount
     ========================================================= */

  function setupQuickAmountButtons() {
    const buttons =
      document.querySelectorAll(
        "[data-wallet-amount], [data-amount]"
      );

    buttons.forEach(
      function (button) {
        if (
          button.dataset
            .walletQuickInitialized ===
          "true"
        ) {
          return;
        }

        button.dataset
          .walletQuickInitialized =
          "true";

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

  /* =========================================================
     Logout
     ========================================================= */

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
              await getAuth()
                .signOut();

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

  /* =========================================================
     Refresh Button
     ========================================================= */

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

  /* =========================================================
     Auth State
     ========================================================= */

  function setupWalletAuthState() {
    getAuth().onAuthStateChanged(
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
            await getAuth()
              .signOut();

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

          await loadPaymentRequests(
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

      setupPaymentMethodUI();

      setupQuickAmountButtons();

      setupLogout();

      setupRefreshButton();

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

  /* =========================================================
     Start
     ========================================================= */

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
