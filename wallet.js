/* =========================================================
   SocialWorkBD - Wallet System
   Balance + Pending Balance + Transactions + Withdrawal
   ========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const walletPage = document.getElementById("wallet-page");

    if (!walletPage) {
      return;
    }

    if (typeof firebase === "undefined") {
      showWalletMessage(
        "Firebase load হয়নি।",
        "error"
      );
      return;
    }

    if (!firebase.apps || !firebase.apps.length) {
      showWalletMessage(
        "Firebase initialize হয়নি।",
        "error"
      );
      return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;
    let currentProfile = null;
    let unsubscribeUser = null;

    const balanceElement =
      document.getElementById("wallet-balance");

    const pendingElement =
      document.getElementById("wallet-pending");

    const totalEarnedElement =
      document.getElementById("wallet-total-earned");

    const totalSpentElement =
      document.getElementById("wallet-total-spent");

    const accountIdElement =
      document.getElementById("wallet-account-id");

    const transactionList =
      document.getElementById("transaction-list");

    const withdrawalForm =
      document.getElementById("withdrawal-form");

    const withdrawAmountInput =
      document.getElementById("withdraw-amount");

    const withdrawMethodInput =
      document.getElementById("withdraw-method");

    const withdrawAccountInput =
      document.getElementById("withdraw-account");

    const withdrawButton =
      document.getElementById("withdraw-btn");

    /* -------------------------------------------------------
       Helpers
    ------------------------------------------------------- */

    function showWalletMessage(message, type) {
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

    function hideWalletMessage() {
      const element =
        document.getElementById("wallet-message");

      if (!element) return;

      element.textContent = "";
      element.style.display = "none";
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

        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch (error) {
        return "Recently";
      }
    }

    function escapeHtml(value) {
      if (
        value === null ||
        value === undefined
      ) {
        return "";
      }

      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function getStatusText(status) {
      const map = {
        completed: "Completed",
        pending: "Pending",
        processing: "Processing",
        approved: "Approved",
        rejected: "Rejected",
        cancelled: "Cancelled",
        failed: "Failed",
        earning: "Earning",
        payment: "Payment",
        withdrawal: "Withdrawal"
      };

      return (
        map[status] ||
        String(status || "Transaction")
          .replace(/_/g, " ")
      );
    }

    function getMethodName(method) {
      const map = {
        bkash: "bKash",
        nagad: "Nagad",
        rocket: "Rocket",
        bank: "Bank",
        paypal: "PayPal"
      };

      return map[method] || method || "";
    }

    /* -------------------------------------------------------
       Authentication
    ------------------------------------------------------- */

    function requireLogin() {
      return new Promise(function (resolve) {
        const unsubscribe =
          auth.onAuthStateChanged(function (user) {
            unsubscribe();

            if (!user) {
              window.location.href =
                "login.html?redirect=" +
                encodeURIComponent(
                  window.location.href
                );

              resolve(null);
              return;
            }

            currentUser = user;
            resolve(user);
          });
      });
    }

    /* -------------------------------------------------------
       User Profile
    ------------------------------------------------------- */

    async function loadProfile() {
      if (!currentUser) {
        return null;
      }

      try {
        const snapshot =
          await db
            .collection("users")
            .doc(currentUser.uid)
            .get();

        if (!snapshot.exists) {
          throw new Error(
            "User profile পাওয়া যায়নি।"
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

        showWalletMessage(
          "Wallet profile load করা যায়নি।",
          "error"
        );

        return null;
      }
    }

    /* -------------------------------------------------------
       Render Wallet Balance
    ------------------------------------------------------- */

    function renderWalletBalance(profile) {
      if (!profile) return;

      const balance =
        Number(profile.balance || 0);

      const pending =
        Number(profile.pendingBalance || 0);

      const totalEarned =
        Number(profile.totalEarned || 0);

      const totalSpent =
        Number(profile.totalSpent || 0);

      if (balanceElement) {
        balanceElement.textContent =
          formatMoney(balance);
      }

      if (pendingElement) {
        pendingElement.textContent =
          formatMoney(pending);
      }

      if (totalEarnedElement) {
        totalEarnedElement.textContent =
          formatMoney(totalEarned);
      }

      if (totalSpentElement) {
        totalSpentElement.textContent =
          formatMoney(totalSpent);
      }

      if (accountIdElement) {
        accountIdElement.textContent =
          profile.accountId ||
          currentUser.uid;
      }
    }

    /* -------------------------------------------------------
       Real-time Wallet Listener
    ------------------------------------------------------- */

    function listenToWallet() {
      if (!currentUser) return;

      if (unsubscribeUser) {
        unsubscribeUser();
      }

      unsubscribeUser =
        db
          .collection("users")
          .doc(currentUser.uid)
          .onSnapshot(
            function (snapshot) {
              if (!snapshot.exists) {
                return;
              }

              currentProfile = {
                uid: currentUser.uid,
                ...snapshot.data()
              };

              renderWalletBalance(
                currentProfile
              );
            },
            function (error) {
              console.error(
                "Wallet listener error:",
                error
              );
            }
          );
    }

    /* -------------------------------------------------------
       Transactions
    ------------------------------------------------------- */

    async function loadTransactions() {
      if (!currentUser) return;

      if (!transactionList) return;

      transactionList.innerHTML =
        '<div class="wallet-loading">Loading transactions...</div>';

      try {
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
          transactionList.innerHTML =
            '<div class="wallet-empty">' +
            "No transactions yet." +
            "</div>";

          return;
        }

        transactionList.innerHTML =
          transactions
            .map(renderTransaction)
            .join("");
      } catch (error) {
        console.error(
          "Transaction load error:",
          error
        );

        transactionList.innerHTML =
          '<div class="wallet-empty">' +
          "Transactions load করা যায়নি।" +
          "</div>";
      }
    }

    function renderTransaction(transaction) {
      const type =
        transaction.type ||
        "transaction";

      const status =
        transaction.status ||
        "completed";

      const amount =
        Number(transaction.amount || 0);

      const isPositive =
        type === "earning" ||
        type === "refund" ||
        transaction.direction === "credit";

      const amountClass =
        isPositive
          ? "transaction-credit"
          : "transaction-debit";

      const sign =
        isPositive ? "+" : "-";

      const title =
        transaction.title ||
        getStatusText(type);

      const description =
        transaction.description ||
        "";

      return `
        <div class="transaction-item">

          <div class="transaction-icon">
            ${isPositive ? "+" : "-"}
          </div>

          <div class="transaction-info">

            <div class="transaction-title">
              ${escapeHtml(title)}
            </div>

            <div class="transaction-description">
              ${escapeHtml(description)}
            </div>

            <div class="transaction-date">
              ${escapeHtml(
                formatDate(
                  transaction.createdAt
                )
              )}
            </div>

          </div>

          <div class="transaction-right">

            <div class="${amountClass}">
              ${sign}${formatMoney(amount)}
            </div>

            <div class="transaction-status">
              ${escapeHtml(
                getStatusText(status)
              )}
            </div>

          </div>

        </div>
      `;
    }

    /* -------------------------------------------------------
       Withdrawal Validation
    ------------------------------------------------------- */

    function validateWithdrawal(
      amount,
      method,
      account
    ) {
      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return "Valid withdrawal amount দিন।";
      }

      if (amount < 5) {
        return "Minimum withdrawal amount is $5.";
      }

      if (!method) {
        return "Withdrawal method নির্বাচন করুন।";
      }

      if (!account) {
        return "Account number দিন।";
      }

      if (account.length < 4) {
        return "Valid account number দিন।";
      }

      const balance =
        Number(
          currentProfile &&
          currentProfile.balance || 0
        );

      if (amount > balance) {
        return "আপনার wallet balance যথেষ্ট নয়।";
      }

      return "";
    }

    /* -------------------------------------------------------
       Withdrawal
    ------------------------------------------------------- */

    async function submitWithdrawal(event) {
      event.preventDefault();

      hideWalletMessage();

      if (!currentUser) {
        showWalletMessage(
          "Please login first.",
          "error"
        );
        return;
      }

      if (!currentProfile) {
        showWalletMessage(
          "Wallet profile load হচ্ছে। আবার চেষ্টা করুন।",
          "error"
        );
        return;
      }

      const amount =
        Number(
          withdrawAmountInput
            ? withdrawAmountInput.value
            : 0
        );

      const method =
        withdrawMethodInput
          ? withdrawMethodInput.value
          : "";

      const account =
        withdrawAccountInput
          ? withdrawAccountInput.value.trim()
          : "";

      const validation =
        validateWithdrawal(
          amount,
          method,
          account
        );

      if (validation) {
        showWalletMessage(
          validation,
          "error"
        );
        return;
      }

      if (withdrawButton) {
        withdrawButton.disabled = true;
        withdrawButton.textContent =
          "Processing...";
      }

      try {
        const userRef =
          db
            .collection("users")
            .doc(currentUser.uid);

        const withdrawalRef =
          db
            .collection("withdrawals")
            .doc();

        const transactionRef =
          db
            .collection("transactions")
            .doc();

        await db.runTransaction(
          async function (transaction) {
            const userSnapshot =
              await transaction.get(
                userRef
              );

            if (!userSnapshot.exists) {
              throw new Error(
                "User profile পাওয়া যায়নি।"
              );
            }

            const userData =
              userSnapshot.data() || {};

            const balance =
              Number(
                userData.balance || 0
              );

            if (amount > balance) {
              throw new Error(
                "Wallet balance যথেষ্ট নয়।"
              );
            }

            const newBalance =
              balance - amount;

            const currentPending =
              Number(
                userData.pendingBalance || 0
              );

            transaction.update(
              userRef,
              {
                balance:
                  newBalance,

                pendingBalance:
                  currentPending + amount,

                updatedAt:
                  firebase.firestore.FieldValue
                    .serverTimestamp()
              }
            );

            transaction.set(
              withdrawalRef,
              {
                userId:
                  currentUser.uid,

                accountId:
                  userData.accountId || "",

                amount:
                  amount,

                method:
                  method,

                account:
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

            transaction.set(
              transactionRef,
              {
                userId:
                  currentUser.uid,

                type:
                  "withdrawal",

                direction:
                  "debit",

                title:
                  "Withdrawal Request",

                description:
                  getMethodName(method) +
                  " withdrawal request",

                amount:
                  amount,

                status:
                  "pending",

                referenceId:
                  withdrawalRef.id,

                createdAt:
                  firebase.firestore.FieldValue
                    .serverTimestamp()
              }
            );
          }
        );

        showWalletMessage(
          "Withdrawal request successfully submitted.",
          "success"
        );

        if (withdrawalForm) {
          withdrawalForm.reset();
        }

        await loadProfile();
        renderWalletBalance(
          currentProfile
        );

        await loadTransactions();
      } catch (error) {
        console.error(
          "Withdrawal error:",
          error
        );

        showWalletMessage(
          error.message ||
          "Withdrawal request করা যায়নি।",
          "error"
        );
      } finally {
        if (withdrawButton) {
          withdrawButton.disabled = false;
          withdrawButton.textContent =
            "Request Withdrawal";
        }
      }
    }

    /* -------------------------------------------------------
       Wallet Page Setup
    ------------------------------------------------------- */

    async function startWallet() {
      const user =
        await requireLogin();

      if (!user) {
        return;
      }

      const profile =
        await loadProfile();

      if (!profile) {
        return;
      }

      if (
        profile.status ===
        "suspended"
      ) {
        showWalletMessage(
          "আপনার account suspended.",
          "error"
        );

        await auth.signOut();

        window.location.href =
          "login.html";

        return;
      }

      renderWalletBalance(
        profile
      );

      listenToWallet();

      await loadTransactions();

      if (withdrawalForm) {
        withdrawalForm.addEventListener(
          "submit",
          submitWithdrawal
        );
      }
    }

    /* -------------------------------------------------------
       Cleanup
    ------------------------------------------------------- */

    window.addEventListener(
      "beforeunload",
      function () {
        if (unsubscribeUser) {
          unsubscribeUser();
        }
      }
    );

    startWallet();
  });
})();
