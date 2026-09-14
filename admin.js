/* =========================================================
   SocialWorkBD - Admin Payment Verification
   Currency: USD
   Payment methods: PayPal / Manual / Bank / Mobile

   IMPORTANT:
   Firestore Security Rules MUST protect admin operations.
   Never put Firebase service-account keys or payment API
   secrets inside this frontend JavaScript.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    USERS_COLLECTION: "users",
    PAYMENT_REQUESTS_COLLECTION: "paymentRequests",
    TRANSACTIONS_COLLECTION: "walletTransactions",
    ADMIN_ROLES: ["admin", "superadmin"],
    CURRENCY: "USD"
  };

  let currentAdmin = null;
  let requests = [];
  let unsubscribe = null;

  /* =========================================================
     FIREBASE HELPERS
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

  function $(id) {
    return document.getElementById(id);
  }

  /* =========================================================
     SECURITY / HTML HELPERS
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
     USD FORMAT
     ========================================================= */

  function formatUSD(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value)) {
      return "$0.00";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: CONFIG.CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /* =========================================================
     DATE FORMAT
     ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      const date =
        value && typeof value.toDate === "function"
          ? value.toDate()
          : new Date(value);

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
     STATUS CLASS
     ========================================================= */

  function getStatusClass(status) {
    const value = String(status || "pending").toLowerCase();

    if (
      value === "approved" ||
      value === "verified"
    ) {
      return "approved";
    }

    if (
      value === "rejected" ||
      value === "cancelled"
    ) {
      return "rejected";
    }

    return "pending";
  }

  /* =========================================================
     LOAD ADMIN PROFILE
     ========================================================= */

  async function loadAdminProfile(uid) {
    const db = getDB();

    const snap = await db
      .collection(CONFIG.USERS_COLLECTION)
      .doc(uid)
      .get();

    if (!snap.exists) {
      throw new Error("Admin profile not found.");
    }

    const profile = {
      uid: uid,
      ...snap.data()
    };

    const role = String(
      profile.role || ""
    ).toLowerCase();

    if (!CONFIG.ADMIN_ROLES.includes(role)) {
      throw new Error("Admin access denied.");
    }

    return profile;
  }

  /* =========================================================
     RENDER ADMIN INFO
     ========================================================= */

  function renderAdminInfo() {
    if (!currentAdmin) {
      return;
    }

    const authUser = getAuth().currentUser;

    const name =
      currentAdmin.name ||
      currentAdmin.displayName ||
      "Administrator";

    const email =
      currentAdmin.email ||
      (authUser ? authUser.email : "") ||
      "";

    [
      "admin-name",
      "administrator-name",
      "profile-name"
    ].forEach(function (id) {
      const element = $(id);

      if (element) {
        element.textContent = name;
      }
    });

    [
      "admin-email",
      "administrator-email",
      "profile-email"
    ].forEach(function (id) {
      const element = $(id);

      if (element) {
        element.textContent = email;
      }
    });
  }

  /* =========================================================
     LOAD PAYMENT REQUESTS
     ========================================================= */

  async function loadRequests() {
    const db = getDB();

    const snapshot = await db
      .collection(CONFIG.PAYMENT_REQUESTS_COLLECTION)
      .limit(200)
      .get();

    requests = [];

    snapshot.forEach(function (doc) {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });

    requests.sort(function (a, b) {
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

    renderRequests();
    updateStats();

    return requests;
  }

  /* =========================================================
     UPDATE ADMIN STATS
     ========================================================= */

  function updateStats() {
    const pending = requests.filter(function (request) {
      return (
        String(
          request.status || "pending"
        ).toLowerCase() === "pending"
      );
    }).length;

    const approved = requests.filter(function (request) {
      return [
        "approved",
        "verified"
      ].includes(
        String(
          request.status || ""
        ).toLowerCase()
      );
    }).length;

    const rejected = requests.filter(function (request) {
      return [
        "rejected",
        "cancelled"
      ].includes(
        String(
          request.status || ""
        ).toLowerCase()
      );
    }).length;

    const pendingAmount = requests
      .filter(function (request) {
        return (
          String(
            request.status || "pending"
          ).toLowerCase() === "pending"
        );
      })
      .reduce(function (sum, request) {
        return (
          sum +
          Number(request.amount || 0)
        );
      }, 0);

    const stats = [
      ["pending-count", pending],
      ["pending-requests", pending],
      ["approved-count", approved],
      ["approved-requests", approved],
      ["rejected-count", rejected],
      ["rejected-requests", rejected],
      ["pending-amount", formatUSD(pendingAmount)]
    ];

    stats.forEach(function ([id, value]) {
      const element = $(id);

      if (element) {
        element.textContent = value;
      }
    });
  }

  /* =========================================================
     RENDER PAYMENT REQUESTS
     ========================================================= */

  function renderRequests() {
    const container =
      $("payment-request-list") ||
      $("payment-requests-list") ||
      $("admin-payment-list") ||
      $("requests-list");

    if (!container) {
      return;
    }

    if (!requests.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No payment requests found.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = requests
      .map(function (request) {
        const status =
          String(
            request.status || "pending"
          ).toLowerCase();

        const method =
          request.paymentMethodName ||
          request.paymentMethod ||
          "Payment";

        const amount =
          Number(request.amount || 0);

        const canReview =
          status === "pending";

        return `
          <div
            class="admin-payment-request"
            data-request-id="${escapeHtml(request.id)}"
          >

            <div class="payment-request-header">

              <div>
                <strong>
                  ${escapeHtml(method)}
                </strong>

                <div class="payment-request-id">
                  ${escapeHtml(
                    request.paymentId ||
                    request.id
                  )}
                </div>
              </div>

              <span
                class="payment-status status-${escapeHtml(
                  getStatusClass(status)
                )}"
              >
                ${escapeHtml(status)}
              </span>

            </div>

            <div class="payment-request-details">

              <div>
                <span>User</span>
                <strong>
                  ${escapeHtml(
                    request.name || "—"
                  )}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  ${escapeHtml(
                    request.email || "—"
                  )}
                </strong>
              </div>

              <div>
                <span>Account ID</span>
                <strong>
                  ${escapeHtml(
                    request.accountId || "—"
                  )}
                </strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>
                  ${formatUSD(amount)}
                </strong>
              </div>

              <div>
                <span>Reference</span>
                <strong>
                  ${escapeHtml(
                    request.reference || "—"
                  )}
                </strong>
              </div>

              <div>
                <span>Submitted</span>
                <strong>
                  ${escapeHtml(
                    formatDate(
                      request.createdAt
                    )
                  )}
                </strong>
              </div>

            </div>

            ${
              canReview
                ? `
                  <div class="admin-payment-actions">

                    <button
                      type="button"
                      class="approve-payment-btn"
                      data-action="approve"
                      data-id="${escapeHtml(
                        request.id
                      )}"
                    >
                      Approve & Credit
                    </button>

                    <button
                      type="button"
                      class="reject-payment-btn"
                      data-action="reject"
                      data-id="${escapeHtml(
                        request.id
                      )}"
                    >
                      Reject
                    </button>

                  </div>
                `
                : `
                  <div class="payment-review-result">

                    Reviewed:
                    ${escapeHtml(
                      request.reviewedByName ||
                      request.reviewedBy ||
                      "Admin"
                    )}

                    ${
                      request.reviewedAt
                        ? " · " +
                          escapeHtml(
                            formatDate(
                              request.reviewedAt
                            )
                          )
                        : ""
                    }

                  </div>
                `
            }

          </div>
        `;
      })
      .join("");

    container
      .querySelectorAll(
        "[data-action='approve']"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            approveRequest(
              button.dataset.id
            );
          }
        );
      });

    container
      .querySelectorAll(
        "[data-action='reject']"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          function () {
            rejectRequest(
              button.dataset.id
            );
          }
        );
      });
  }

  /* =========================================================
     APPROVE PAYMENT
     ========================================================= */

  async function approveRequest(requestId) {
    const request =
      requests.find(function (item) {
        return item.id === requestId;
      });

    if (!request) {
      alert(
        "Payment request not found."
      );
      return;
    }

    if (
      String(
        request.status || "pending"
      ).toLowerCase() !== "pending"
    ) {
      alert(
        "This payment request has already been reviewed."
      );
      return;
    }

    const amount =
      Number(request.amount || 0);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Invalid payment amount."
      );
      return;
    }

    const confirmed = window.confirm(
      "Approve " +
        formatUSD(amount) +
        " and credit the user's wallet?"
    );

    if (!confirmed) {
      return;
    }

    const db = getDB();
    const adminUser =
      getAuth().currentUser;

    if (
      !adminUser ||
      !currentAdmin
    ) {
      alert(
        "Admin session expired. Please log in again."
      );
      return;
    }

    try {
      await db.runTransaction(
        async function (transaction) {
          const requestRef = db
            .collection(
              CONFIG.PAYMENT_REQUESTS_COLLECTION
            )
            .doc(requestId);

          const requestSnap =
            await transaction.get(
              requestRef
            );

          if (!requestSnap.exists) {
            throw new Error(
              "Payment request no longer exists."
            );
          }

          const liveRequest =
            requestSnap.data();

          const liveStatus =
            String(
              liveRequest.status ||
                "pending"
            ).toLowerCase();

          if (liveStatus !== "pending") {
            throw new Error(
              "This request has already been reviewed."
            );
          }

          const uid =
            liveRequest.uid;

          if (!uid) {
            throw new Error(
              "Payment request has no user ID."
            );
          }

          const userRef = db
            .collection(
              CONFIG.USERS_COLLECTION
            )
            .doc(uid);

          const userSnap =
            await transaction.get(
              userRef
            );

          if (!userSnap.exists) {
            throw new Error(
              "User account not found."
            );
          }

          const userData =
            userSnap.data();

          const currentBalance =
            Number(
              userData.balance || 0
            );

          const paymentAmount =
            Number(
              liveRequest.amount || 0
            );

          if (
            !Number.isFinite(
              paymentAmount
            ) ||
            paymentAmount <= 0
          ) {
            throw new Error(
              "Invalid payment amount."
            );
          }

          const newBalance =
            Math.round(
              (
                currentBalance +
                paymentAmount +
                Number.EPSILON
              ) * 100
            ) / 100;

          transaction.update(
            userRef,
            {
              balance: newBalance,

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()
            }
          );

          transaction.update(
            requestRef,
            {
              status: "approved",

              verificationStatus:
                "verified",

              reviewedBy:
                adminUser.uid,

              reviewedByName:
                currentAdmin.name ||
                adminUser.email ||
                "Admin",

              reviewedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp(),

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()
            }
          );

          const transactionRef =
            db
              .collection(
                CONFIG.TRANSACTIONS_COLLECTION
              )
              .doc();

          transaction.set(
            transactionRef,
            {
              uid: uid,

              accountId:
                liveRequest.accountId ||
                userData.accountId ||
                "",

              type: "deposit",

              source:
                "paymentRequest",

              paymentRequestId:
                liveRequest.paymentId ||
                requestId,

              paymentMethod:
                liveRequest.paymentMethod ||
                "unknown",

              amount:
                paymentAmount,

              currency:
                "USD",

              status:
                "completed",

              reference:
                liveRequest.reference ||
                "",

              description:
                "Verified wallet deposit",

              createdAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp(),

              createdBy:
                adminUser.uid
            }
          );
        }
      );

      alert(
        formatUSD(amount) +
          " approved and credited successfully."
      );

      await loadRequests();

    } catch (error) {
      console.error(
        "Approve payment error:",
        error
      );

      alert(
        error &&
        error.message
          ? error.message
          : "Could not approve payment."
      );
    }
  }

  /* =========================================================
     REJECT PAYMENT
     ========================================================= */

  async function rejectRequest(requestId) {
    const request =
      requests.find(function (item) {
        return item.id === requestId;
      });

    if (!request) {
      alert(
        "Payment request not found."
      );
      return;
    }

    if (
      String(
        request.status || "pending"
      ).toLowerCase() !== "pending"
    ) {
      alert(
        "This payment request has already been reviewed."
      );
      return;
    }

    const reason =
      window.prompt(
        "Enter rejection reason (optional):"
      );

    if (reason === null) {
      return;
    }

    const confirmed =
      window.confirm(
        "Reject this payment request?"
      );

    if (!confirmed) {
      return;
    }

    const db = getDB();
    const adminUser =
      getAuth().currentUser;

    if (
      !adminUser ||
      !currentAdmin
    ) {
      alert(
        "Admin session expired. Please log in again."
      );
      return;
    }

    try {
      const requestRef = db
        .collection(
          CONFIG.PAYMENT_REQUESTS_COLLECTION
        )
        .doc(requestId);

      await requestRef.update({
        status: "rejected",

        verificationStatus:
          "rejected",

        rejectionReason:
          String(
            reason || ""
          ).trim(),

        reviewedBy:
          adminUser.uid,

        reviewedByName:
          currentAdmin.name ||
          adminUser.email ||
          "Admin",

        reviewedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()
      });

      alert(
        "Payment request rejected."
      );

      await loadRequests();

    } catch (error) {
      console.error(
        "Reject payment error:",
        error
      );

      alert(
        error &&
        error.message
          ? error.message
          : "Could not reject payment."
      );
    }
  }

  /* =========================================================
     REFRESH
     ========================================================= */

  function setupRefresh() {
    [
      "refresh-payments",
      "refresh-payment-requests",
      "refresh-btn",
      "admin-refresh"
    ].forEach(function (id) {
      const button = $(id);

      if (!button) {
        return;
      }

      button.addEventListener(
        "click",
        async function () {
          try {
            button.disabled = true;

            await loadRequests();

          } catch (error) {
            console.error(
              "Refresh error:",
              error
            );

            alert(
              "Could not refresh payment requests."
            );

          } finally {
            button.disabled = false;
          }
        }
      );
    });
  }

  /* =========================================================
     FILTER
     ========================================================= */

  function setupFilter() {
    const filter =
      $("payment-status-filter") ||
      $("status-filter");

    if (!filter) {
      return;
    }

    filter.addEventListener(
      "change",
      renderFilteredRequests
    );
  }

  function renderFilteredRequests() {
    const filter =
      $("payment-status-filter") ||
      $("status-filter");

    if (
      !filter ||
      !filter.value
    ) {
      renderRequests();
      return;
    }

    const selected =
      String(
        filter.value
      ).toLowerCase();

    const original =
      requests;

    requests =
      original.filter(
        function (request) {
          return (
            String(
              request.status ||
                "pending"
            ).toLowerCase() ===
            selected
          );
        }
      );

    renderRequests();

    requests = original;
  }

  /* =========================================================
     LOGOUT
     ========================================================= */

  function setupLogout() {
    document
      .querySelectorAll(
        "#logout-btn, #logout, [data-action='logout']"
      )
      .forEach(function (button) {
        button.addEventListener(
          "click",
          async function () {
            try {
              if (unsubscribe) {
                unsubscribe();
              }

              await getAuth().signOut();

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
     INITIALIZE ADMIN
     ========================================================= */

  async function initAdmin() {
    const auth =
      getAuth();

    const user =
      auth.currentUser;

    if (!user) {
      window.location.href =
        "login.html";

      return;
    }

    currentAdmin =
      await loadAdminProfile(
        user.uid
      );

    renderAdminInfo();

    setupRefresh();

    setupFilter();

    setupLogout();

    await loadRequests();
  }

  /* =========================================================
     AUTH STATE
     ========================================================= */

  function setupAuth() {
    getAuth().onAuthStateChanged(
      async function (user) {
        if (!user) {
          window.location.href =
            "login.html";

          return;
        }

        try {
          await initAdmin();

        } catch (error) {
          console.error(
            "Admin initialization error:",
            error
          );

          alert(
            error &&
            error.message
              ? error.message
              : "Admin access denied."
          );

          try {
            await getAuth().signOut();
          } catch (signOutError) {
            console.error(
              signOutError
            );
          }

          window.location.href =
            "login.html";
        }
      }
    );
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.SocialWorkBDAdmin = {
    refresh: loadRequests,
    approveRequest: approveRequest,
    rejectRequest: rejectRequest,
    formatUSD: formatUSD
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
      setupAuth
    );
  } else {
    setupAuth();
  }

})();
