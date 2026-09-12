/* =========================================================
   SocialWorkBD - Wallet System
   Firebase + Firestore
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     Firebase Helpers
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
     General Helpers
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

    if (!Number.isFinite(amount)) {
      return "$0.00";
    }

    return "$" + amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

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
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        date = new Date(timestamp);
      }

      if (isNaN(date.getTime())) {
        return "Recently";
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch (error) {
      return "Recently";
    }
  }

  function showMessage(message, type) {
    const box =
      document.getElementById("wallet-message");

    if (!box) {
      alert(message);
      return;
    }

    box.textContent = message;

    box.className =
      "wallet-message " +
      (type || "info");

    box.style.display = "block";
  }

  function hideMessage() {
    const box =
      document.getElementById("wallet-message");

    if (!box) {
      return;
    }

    box.style.display = "none";
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
      element.textContent = value;
    }
  }

  function setValue(id, value) {
    const element = getElement(id);

    if (element) {
      element.value = value;
    }
  }

  function setDisabled(id, disabled) {
    const element = getElement(id);

    if (element) {
      element.disabled = disabled;
    }
  }

  /* ---------------------------------------------------------
     Wallet State
  --------------------------------------------------------- */

  let currentUser = null;
  let currentProfile = null;

  let walletBalance = 0;
  let pendingBalance = 0;

  /* ---------------------------------------------------------
     Load Current User
  --------------------------------------------------------- */

  async function loadCurrentUser() {
    const auth = getAuth();
    const db = getDB();

    return new Promise(function (resolve) {
      let resolved = false;

      auth.onAuthStateChanged(
        async function (user) {

          if (resolved) {
            return;
          }

          if (!user) {
            resolved = true;

            window.location.href =
              "login.html?redirect=" +
              encodeURIComponent(
                window.location.href
              );

            resolve(null);
            return;
          }

          currentUser = user;

          try {
            const snapshot =
              await db
                .collection("users")
                .doc(user.uid)
                .get();

            if (snapshot.exists) {
              currentProfile = {
                uid: user.uid,
                id: user.uid,
                ...snapshot.data()
              };
            } else {
              currentProfile = {
                uid: user.uid,
                id: user.uid,
                name:
                  user.displayName ||
                  "User",
                email:
                  user.email ||
                  "",
                role: "worker",
                balance: 0,
                pendingBalance: 0
              };
            }

            walletBalance =
              Number(
                currentProfile.balance || 0
              );

            pendingBalance =
              Number(
                currentProfile.pendingBalance || 0
              );

            resolved = true;

            resolve(currentProfile);

          } catch (error) {

            console.error(
              "Wallet profile error:",
              error
            );

            resolved = true;

            showMessage(
              "Unable to load your wallet profile.",
              "error"
            );

            resolve(null);
          }
        }
      );
    });
  }

  /* ---------------------------------------------------------
     Render Wallet
  --------------------------------------------------------- */

  function renderWallet() {

    setText(
      "wallet-balance",
      formatMoney(walletBalance)
    );

    setText(
      "available-balance",
      formatMoney(walletBalance)
    );

    setText(
      "pending-balance",
      formatMoney(pendingBalance)
    );

    setText(
      "total-balance",
      formatMoney(
        walletBalance +
        pendingBalance
      )
    );

    if (currentProfile) {

      setText(
        "wallet-user-name",
        currentProfile.name ||
        currentUser?.displayName ||
        "User"
      );

      setText(
        "wallet-account-id",
        currentProfile.accountId ||
        ""
      );
    }
  }

  /* ---------------------------------------------------------
     Load Wallet Transactions
  --------------------------------------------------------- */

  async function loadTransactions() {

    const container =
      getElement("wallet-transactions");

    if (!container) {
      return;
    }

    container.innerHTML =
      '<div class="wallet-loading">Loading transactions...</div>';

    try {

      const db = getDB();

      const snapshot =
        await db
          .collection("walletTransactions")
          .where(
            "userId",
            "==",
            currentUser.uid
          )
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
      });

      if (!transactions.length) {

        container.innerHTML =
          '<div class="wallet-empty">No wallet transactions yet.</div>';

        return;
      }

      container.innerHTML =
        transactions
          .map(renderTransaction)
          .join("");

    } catch (error) {

      console.error(
        "Transaction loading error:",
        error
      );

      container.innerHTML =
        '<div class="wallet-empty">Unable to load transactions.</div>';
    }
  }

  /* ---------------------------------------------------------
     Render Transaction
  --------------------------------------------------------- */

  function renderTransaction(transaction) {

    const amount =
      Number(transaction.amount || 0);

    const type =
      transaction.type ||
      "transaction";

    const status =
      transaction.status ||
      "completed";

    const isCredit =
      type === "deposit" ||
      type === "earning" ||
      type === "refund" ||
      type === "bonus" ||
      amount > 0;

    const amountClass =
      isCredit
        ? "transaction-credit"
        : "transaction-debit";

    const amountPrefix =
      isCredit
        ? "+"
        : "-";

    const title =
      transaction.title ||
      transaction.description ||
      getTransactionTitle(type);

    return `
      <div class="wallet-transaction">

        <div class="transaction-info">

          <div class="transaction-title">
            ${escapeHtml(title)}
          </div>

          <div class="transaction-date">
            ${escapeHtml(
              formatDate(
                transaction.createdAt
              )
            )}
          </div>

          <div class="transaction-status">
            ${escapeHtml(
              String(status).replace(
                /_/g,
                " "
              )
            )}
          </div>

        </div>

        <div class="transaction-amount ${amountClass}">
          ${amountPrefix}${formatMoney(
            Math.abs(amount)
          )}
        </div>

      </div>
    `;
  }

  function getTransactionTitle(type) {

    const titles = {
      deposit: "Wallet Deposit",
      withdrawal: "Wallet Withdrawal",
      earning: "Task Earning",
      payment: "Job Payment",
      refund: "Refund",
      bonus: "Bonus",
      fee: "Service Fee",
      adjustment: "Balance Adjustment"
    };

    return (
      titles[type] ||
      "Wallet Transaction"
    );
  }

  /* ---------------------------------------------------------
     Deposit Request
  --------------------------------------------------------- */

  async function createDepositRequest(
    amount,
    method
  ) {

    if (!currentUser) {
      throw new Error(
        "Please log in to continue."
      );
    }

    const db = getDB();

    const numericAmount =
      Number(amount || 0);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      throw new Error(
        "Please enter a valid deposit amount."
      );
    }

    if (!method) {
      throw new Error(
        "Please select a payment method."
      );
    }

    const depositRef =
      await db
        .collection("depositRequests")
        .add({

          userId:
            currentUser.uid,

          userName:
            currentProfile?.name ||
            currentUser.displayName ||
            "User",

          accountId:
            currentProfile?.accountId ||
            "",

          amount:
            numericAmount,

          method:
            method,

          status:
            "pending",

          createdAt:
            firebase.firestore.FieldValue
              .serverTimestamp(),

          updatedAt:
            firebase.firestore.FieldValue
              .serverTimestamp()
        });

    await db
      .collection("walletTransactions")
      .add({

        userId:
          currentUser.uid,

        type:
          "deposit",

        title:
          "Deposit Request",

        amount:
          numericAmount,

        method:
          method,

        referenceId:
          depositRef.id,

        status:
          "pending",

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore.FieldValue
            .serverTimestamp()
      });

    return depositRef.id;
  }

  /* ---------------------------------------------------------
     Withdrawal Request
  --------------------------------------------------------- */

  async function createWithdrawalRequest(
    amount,
    method,
    account
  ) {

    if (!currentUser) {
      throw new Error(
        "Please log in to continue."
      );
    }

    const numericAmount =
      Number(amount || 0);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      throw new Error(
        "Please enter a valid withdrawal amount."
      );
    }

    if (
      numericAmount >
      walletBalance
    ) {
      throw new Error(
        "Insufficient available balance."
      );
    }

    if (!method) {
      throw new Error(
        "Please select a withdrawal method."
      );
    }

    if (!account) {
      throw new Error(
        "Please enter your payment account."
      );
    }

    const db = getDB();

    const userRef =
      db.collection("users")
        .doc(currentUser.uid);

    const withdrawalRef =
      db.collection("withdrawalRequests")
        .doc();

    const transactionRef =
      db.collection("walletTransactions")
        .doc();

    const batch =
      db.batch();

    batch.update(
      userRef,
      {
        balance:
          firebase.firestore.FieldValue
            .increment(
              -numericAmount
            ),

        pendingBalance:
          firebase.firestore.FieldValue
            .increment(
              numericAmount
            ),

        updatedAt:
          firebase.firestore.FieldValue
            .serverTimestamp()
      }
    );

    batch.set(
      withdrawalRef,
      {
        userId:
          currentUser.uid,

        userName:
          currentProfile?.name ||
          currentUser.displayName ||
          "User",

        accountId:
          currentProfile?.accountId ||
          "",

        amount:
          numericAmount,

        method:
          method,

        paymentAccount:
          account,

        status:
          "pending",

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore.FieldValue
            .serverTimestamp()
      }
    );

    batch.set(
      transactionRef,
      {
        userId:
          currentUser.uid,

        type:
          "withdrawal",

        title:
          "Withdrawal Request",

        amount:
          -numericAmount,

        method:
          method,

        paymentAccount:
          account,

        referenceId:
          withdrawalRef.id,

        status:
          "pending",

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore.FieldValue
            .serverTimestamp()
      }
    );

    await batch.commit();

    walletBalance -=
      numericAmount;

    pendingBalance +=
      numericAmount;

    renderWallet();
  }

  /* ---------------------------------------------------------
     Deposit Form
  --------------------------------------------------------- */

  function setupDepositForm() {

    const form =
      getElement(
        "deposit-form"
      );

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        hideMessage();

        const amount =
          Number(
            getElement(
              "deposit-amount"
            )?.value || 0
          );

        const method =
          getElement(
            "deposit-method"
          )?.value || "";

        const button =
          getElement(
            "deposit-btn"
          );

        try {

          if (button) {
            button.disabled = true;
            button.textContent =
              "Submitting...";
          }

          await createDepositRequest(
            amount,
            method
          );

          showMessage(
            "Deposit request submitted successfully.",
            "success"
          );

          form.reset();

          await loadTransactions();

        } catch (error) {

          console.error(
            "Deposit error:",
            error
          );

          showMessage(
            error.message ||
            "Unable to submit deposit request.",
            "error"
          );

        } finally {

          if (button) {
            button.disabled = false;
            button.textContent =
              "Request Deposit";
          }
        }
      }
    );
  }

  /* ---------------------------------------------------------
     Withdrawal Form
  --------------------------------------------------------- */

  function setupWithdrawalForm() {

    const form =
      getElement(
        "withdrawal-form"
      );

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        hideMessage();

        const amount =
          Number(
            getElement(
              "withdrawal-amount"
            )?.value || 0
          );

        const method =
          getElement(
            "withdrawal-method"
          )?.value || "";

        const account =
          getElement(
            "withdrawal-account"
          )?.value.trim() || "";

        const button =
          getElement(
            "withdrawal-btn"
          );

        try {

          if (button) {
            button.disabled = true;
            button.textContent =
              "Submitting...";
          }

          await createWithdrawalRequest(
            amount,
            method,
            account
          );

          showMessage(
            "Withdrawal request submitted successfully.",
            "success"
          );

          form.reset();

          await loadTransactions();

        } catch (error) {

          console.error(
            "Withdrawal error:",
            error
          );

          showMessage(
            error.message ||
            "Unable to submit withdrawal request.",
            "error"
          );

        } finally {

          if (button) {
            button.disabled = false;
            button.textContent =
              "Request Withdrawal";
          }
        }
      }
    );
  }

  /* ---------------------------------------------------------
     Quick Amount Buttons
  --------------------------------------------------------- */

  function setupQuickAmounts() {

    const buttons =
      document.querySelectorAll(
        "[data-wallet-amount]"
      );

    buttons.forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const amount =
              this.getAttribute(
                "data-wallet-amount"
              );

            setValue(
              "deposit-amount",
              amount
            );

            setValue(
              "withdrawal-amount",
              amount
            );
          }
        );

      }
    );
  }

  /* ---------------------------------------------------------
     Balance Refresh
  --------------------------------------------------------- */

  async function refreshWallet() {

    if (!currentUser) {
      return;
    }

    try {

      const db = getDB();

      const snapshot =
        await db
          .collection("users")
          .doc(currentUser.uid)
          .get();

      if (!snapshot.exists) {
        return;
      }

      currentProfile = {
        uid: currentUser.uid,
        id: currentUser.uid,
        ...snapshot.data()
      };

      walletBalance =
        Number(
          currentProfile.balance || 0
        );

      pendingBalance =
        Number(
          currentProfile.pendingBalance || 0
        );

      renderWallet();

    } catch (error) {

      console.error(
        "Wallet refresh error:",
        error
      );
    }
  }

  /* ---------------------------------------------------------
     Real-time Wallet Listener
  --------------------------------------------------------- */

  function setupWalletListener() {

    if (!currentUser) {
      return;
    }

    try {

      const db = getDB();

      db.collection("users")
        .doc(currentUser.uid)
        .onSnapshot(
          function (snapshot) {

            if (!snapshot.exists) {
              return;
            }

            currentProfile = {
              uid:
                currentUser.uid,

              id:
                currentUser.uid,

              ...snapshot.data()
            };

            walletBalance =
              Number(
                currentProfile.balance ||
                0
              );

            pendingBalance =
              Number(
                currentProfile.pendingBalance ||
                0
              );

            renderWallet();
          },

          function (error) {

            console.error(
              "Wallet listener error:",
              error
            );
          }
        );

    } catch (error) {

      console.error(
        "Wallet listener setup error:",
        error
      );
    }
  }

  /* ---------------------------------------------------------
     Wallet Tabs
  --------------------------------------------------------- */

  function setupWalletTabs() {

    const buttons =
      document.querySelectorAll(
        "[data-wallet-tab]"
      );

    const panels =
      document.querySelectorAll(
        "[data-wallet-panel]"
      );

    if (!buttons.length) {
      return;
    }

    buttons.forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const target =
              this.getAttribute(
                "data-wallet-tab"
              );

            buttons.forEach(
              function (item) {
                item.classList.remove(
                  "active"
                );
              }
            );

            panels.forEach(
              function (panel) {

                panel.style.display =
                  "none";
              }
            );

            this.classList.add(
              "active"
            );

            const panel =
              document.querySelector(
                '[data-wallet-panel="' +
                target +
                '"]'
              );

            if (panel) {
              panel.style.display =
                "block";
            }
          }
        );

      }
    );
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
     Page Initialization
  --------------------------------------------------------- */

  async function initWallet() {

    try {

      getFirebase();

      const profile =
        await loadCurrentUser();

      if (!profile) {
        return;
      }

      renderWallet();

      setupDepositForm();
      setupWithdrawalForm();
      setupQuickAmounts();
      setupWalletTabs();
      setupLogout();

      await loadTransactions();

      setupWalletListener();

    } catch (error) {

      console.error(
        "Wallet initialization error:",
        error
      );

      showMessage(
        error.message ||
        "Unable to initialize wallet.",
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
      initWallet
    );

  } else {

    initWallet();

  }

})();
