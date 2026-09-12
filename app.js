/* =========================================================
   SocialWorkBD - Main Application
   Firebase + Global Freelance Marketplace
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

    if (!firebase.apps.length) {
      throw new Error("Firebase has not been initialized.");
    }

    return {
      auth: firebase.auth(),
      db: firebase.firestore()
    };
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

  function saveCurrentUser(user) {
    if (!user) return;

    localStorage.setItem(
      "currentUser",
      JSON.stringify(user)
    );
  }

  function getCurrentUserLocal() {
    try {
      return JSON.parse(
        localStorage.getItem("currentUser") || "null"
      );
    } catch (error) {
      return null;
    }
  }

  function getRoleName(role) {
    if (role === "client") {
      return "Client";
    }

    if (role === "worker" || role === "freelancer") {
      return "Freelancer";
    }

    return "Member";
  }

  /* Worldwide formatting: USD + a locale-neutral (en-US) format,
     instead of the previous Bangladesh-only currency symbol / "en-BD" formatting. */

  function formatBudget(amount) {
    const value = Number(amount || 0);

    return (
      "$" +
      value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
    );
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return "";
    }

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch (error) {
      return "";
    }
  }

  async function getUserProfile(uid) {
    const { db } = getFirebase();

    const doc = await db
      .collection("users")
      .doc(uid)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  function requireLogin() {
    const localUser = getCurrentUserLocal();

    if (!localUser) {
      window.location.href = "login.html";
      return false;
    }

    return true;
  }

  function showError(message) {
    alert(message);
  }

  /* ---------------------------------------------------------
     Account Status / Moderation Helpers
  --------------------------------------------------------- */

  const ACCOUNT_STATUS = {
    ACTIVE: "active",
    WARNING: "warning",
    RESTRICTED: "restricted",
    SUSPENDED: "suspended",
    UNDER_REVIEW: "under_review"
  };

  function normalizeAccountStatus(status) {
    const value = String(status || "").trim().toLowerCase();

    if (
      value === ACCOUNT_STATUS.WARNING ||
      value === ACCOUNT_STATUS.RESTRICTED ||
      value === ACCOUNT_STATUS.SUSPENDED ||
      value === ACCOUNT_STATUS.UNDER_REVIEW
    ) {
      return value;
    }

    return ACCOUNT_STATUS.ACTIVE;
  }

  function getAccountStatus(profile) {
    if (!profile) {
      return ACCOUNT_STATUS.ACTIVE;
    }

    return normalizeAccountStatus(profile.accountStatus);
  }

  function isAccountMessagingBlocked(profile) {
    const status = getAccountStatus(profile);

    return (
      status === ACCOUNT_STATUS.RESTRICTED ||
      status === ACCOUNT_STATUS.SUSPENDED
    );
  }

  function getAccountStatusMessage(profile) {
    const status = getAccountStatus(profile);

    if (status === ACCOUNT_STATUS.SUSPENDED) {
      return (
        "Your account is currently suspended. " +
        "Messaging and other restricted activities are unavailable. " +
        "You can request a review from Support."
      );
    }

    if (status === ACCOUNT_STATUS.RESTRICTED) {
      return (
        "Your account currently has messaging restrictions " +
        "because of repeated policy violations. " +
        "You can request a review from Support."
      );
    }

    if (status === ACCOUNT_STATUS.UNDER_REVIEW) {
      return (
        "Your account is currently under review. " +
        "Some activities may be temporarily limited."
      );
    }

    if (status === ACCOUNT_STATUS.WARNING) {
      return (
        "Your account has received a policy warning. " +
        "Please keep communication and transactions inside SocialWorkBD."
      );
    }

    return "";
  }

  function detectOffPlatformContent(text) {
    const value = String(text || "").trim();

    if (!value) {
      return {
        flagged: false,
        reasons: []
      };
    }

    const reasons = [];

    const urlPattern = /(?:https?:\/\/|www\.)[^\s]+/i;

    if (urlPattern.test(value)) {
      reasons.push("external link");
    }

    const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

    if (emailPattern.test(value)) {
      reasons.push("email address");
    }

    const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/i;

    if (phonePattern.test(value)) {
      reasons.push("phone number");
    }

    const platformPattern =
      /\b(whatsapp|telegram|discord|signal|messenger|facebook|instagram|linkedin|tiktok|skype|snapchat)\b/i;

    if (platformPattern.test(value)) {
      reasons.push("external communication platform");
    }

    const offPlatformPattern =
      /\b(contact me|message me|text me|call me|reach me|talk to me|send me your number|send your number|my number|my email|email me|dm me|add me|chat outside|outside socialworkbd|off[- ]platform|off platform|outside the platform|move to whatsapp|move to telegram|contact outside)\b/i;

    if (offPlatformPattern.test(value)) {
      reasons.push("off-platform communication request");
    }

    return {
      flagged: reasons.length > 0,
      reasons: reasons
    };
  }

  async function recordModerationViolation(uid, messageText, reasons) {
    const { db } = getFirebase();

    if (!uid) {
      return null;
    }

    const userRef = db.collection("users").doc(uid);

    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      return null;
    }

    const profile = snapshot.data();

    const previousViolations = Number(profile.violationCount || 0);
    const previousWarnings = Number(profile.warningCount || 0);

    const violationCount = previousViolations + 1;
    const warningCount = previousWarnings + 1;

    let nextStatus = ACCOUNT_STATUS.WARNING;

    if (violationCount >= 5) {
      nextStatus = ACCOUNT_STATUS.SUSPENDED;
    } else if (violationCount >= 3) {
      nextStatus = ACCOUNT_STATUS.RESTRICTED;
    }

    const eventData = {
      userId: uid,
      accountId: profile.accountId || "",
      type: "off_platform_communication",
      message: String(messageText || "").substring(0, 1000),
      reasons: Array.isArray(reasons) ? reasons : [],
      violationNumber: violationCount,
      previousStatus: normalizeAccountStatus(profile.accountStatus),
      resultingStatus: nextStatus,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("moderationEvents").add(eventData);

    await userRef.update({
      accountStatus: nextStatus,
      warningCount: warningCount,
      violationCount: violationCount,
      lastViolationAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastViolationType: "off_platform_communication",
      lastViolationReasons: Array.isArray(reasons) ? reasons : [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const updatedProfile = {
      id: uid,
      ...profile,
      accountStatus: nextStatus,
      warningCount: warningCount,
      violationCount: violationCount
    };

    saveCurrentUser(updatedProfile);

    return {
      status: nextStatus,
      violationCount: violationCount,
      warningCount: warningCount,
      reasons: Array.isArray(reasons) ? reasons : []
    };
  }

  async function moderateMessageAttempt(messageText) {
    const { auth } = getFirebase();

    const user = auth.currentUser;

    if (!user) {
      return {
        allowed: false,
        reason: "login_required"
      };
    }

    const profile = await getUserProfile(user.uid);

    if (!profile) {
      return {
        allowed: false,
        reason: "profile_missing"
      };
    }

    const accountStatus = getAccountStatus(profile);

    if (accountStatus === ACCOUNT_STATUS.SUSPENDED) {
      return {
        allowed: false,
        reason: "account_suspended",
        message: getAccountStatusMessage(profile)
      };
    }

    if (accountStatus === ACCOUNT_STATUS.RESTRICTED) {
      return {
        allowed: false,
        reason: "account_restricted",
        message: getAccountStatusMessage(profile)
      };
    }

    const detection = detectOffPlatformContent(messageText);

    if (!detection.flagged) {
      return {
        allowed: true,
        reason: "clean"
      };
    }

    const violation = await recordModerationViolation(
      user.uid,
      messageText,
      detection.reasons
    );

    const resultingStatus = violation?.status || ACCOUNT_STATUS.WARNING;

    let message =
      "This message could not be sent because it appears to contain contact information or an attempt to move communication outside SocialWorkBD. Please keep communication on the platform.";

    if (resultingStatus === ACCOUNT_STATUS.RESTRICTED) {
      message =
        "This message was blocked. Your account has received repeated policy violations and messaging is now restricted. You can request a review from Support.";
    }

    if (resultingStatus === ACCOUNT_STATUS.SUSPENDED) {
      message =
        "This message was blocked. Your account has been suspended because of repeated policy violations. You can request a review from Support.";
    }

    return {
      allowed: false,
      reason: "policy_violation",
      message: message,
      status: resultingStatus,
      violationCount: violation?.violationCount || 0,
      reasons: detection.reasons
    };
  }

  window.SocialWorkBDModeration = {
    detectOffPlatformContent: detectOffPlatformContent,
    moderateMessageAttempt: moderateMessageAttempt,
    getAccountStatus: getAccountStatus,
    isAccountMessagingBlocked: isAccountMessagingBlocked,
    getAccountStatusMessage: getAccountStatusMessage
  };

  /* ---------------------------------------------------------
     Create / Load User Profile
  --------------------------------------------------------- */

  async function createOrLoadUserProfile(user, extraData) {
    const { db } = getFirebase();

    extraData = extraData || {};

    const ref = db.collection("users").doc(user.uid);

    const snapshot = await ref.get();

    /* Existing Profile */

    if (snapshot.exists) {
      const existing = snapshot.data();

      const profile = {
        id: user.uid,
        uid: user.uid,
        accountId: existing.accountId || "",
        name: existing.name || user.displayName || "",
        email: existing.email || user.email || "",
        role: existing.role || "worker",
        skills: existing.skills || "",
        title: existing.title || "",
        bio: existing.bio || "",
        location: existing.location || "",
        photoURL: existing.photoURL || user.photoURL || "",
        balance: Number(existing.balance || 0),
        pendingBalance: Number(existing.pendingBalance || 0),
        accountStatus: normalizeAccountStatus(existing.accountStatus),
        warningCount: Number(existing.warningCount || 0),
        violationCount: Number(existing.violationCount || 0),
        lastViolationAt: existing.lastViolationAt || null
      };

      const moderationUpdate = {};

      if (!existing.accountStatus) {
        moderationUpdate.accountStatus = ACCOUNT_STATUS.ACTIVE;
      }

      if (existing.warningCount === undefined) {
        moderationUpdate.warningCount = 0;
      }

      if (existing.violationCount === undefined) {
        moderationUpdate.violationCount = 0;
      }

      if (Object.keys(moderationUpdate).length) {
        moderationUpdate.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        try {
          await ref.update(moderationUpdate);
        } catch (updateError) {
          console.warn(
            "Moderation profile defaults could not be updated:",
            updateError
          );
        }
      }

      saveCurrentUser(profile);

      return profile;
    }

    /* New Profile */

    const role = extraData.role === "client" ? "client" : "worker";

    const accountPrefix = role === "client" ? "SWB-C-" : "SWB-F-";

    const accountId =
      accountPrefix + Math.random().toString(36).substring(2, 8).toUpperCase();

    const profileData = {
      uid: user.uid,
      accountId: accountId,
      name: extraData.name || user.displayName || "",
      email: user.email || "",
      role: role,
      skills: extraData.skills || "",
      title: "",
      bio: "",
      location: "",
      photoURL: user.photoURL || "",
      balance: 0,
      pendingBalance: 0,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      warningCount: 0,
      violationCount: 0,
      lastViolationAt: null,
      lastViolationType: "",
      lastViolationReasons: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(profileData);

    const profile = {
      id: user.uid,
      ...profileData
    };

    saveCurrentUser(profile);

    return profile;
  }

  /* ---------------------------------------------------------
     Signup
  --------------------------------------------------------- */

  function setupSignup() {
    const form = document.getElementById("signup-form");

    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const button = document.getElementById("signup-btn");

      try {
        const { auth } = getFirebase();

        const name = document.getElementById("name")?.value.trim() || "";
        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";
        const confirmPassword =
          document.getElementById("confirm-password")?.value || "";

        const roleElement = document.getElementById("role");
        const skillsElement = document.getElementById("skills");

        const role = roleElement?.value || "worker";
        const skills = skillsElement?.value.trim() || "";

        if (!name || !email || !password) {
          showError("Please complete all required fields.");
          return;
        }

        if (password !== confirmPassword) {
          showError("Passwords do not match.");
          return;
        }

        if (password.length < 6) {
          showError("Password must be at least 6 characters.");
          return;
        }

        if (button) {
          button.disabled = true;
          button.textContent = "Creating account...";
        }

        /* ---------------------------------------------
           Step 1: Create Firebase Authentication Account
        --------------------------------------------- */

        let result;

        try {
          result = await auth.createUserWithEmailAndPassword(email, password);
        } catch (authError) {
          console.error("Firebase Authentication signup error:", authError);

          if (authError.code === "auth/email-already-in-use") {
            showError("This email is already registered.");
          } else if (authError.code === "auth/invalid-email") {
            showError("Please enter a valid email address.");
          } else if (authError.code === "auth/weak-password") {
            showError("Password is too weak.");
          } else if (authError.code === "auth/network-request-failed") {
            showError("Network error. Please check your internet connection.");
          } else {
            showError(
              "Authentication signup failed.\n\nCode: " +
                (authError.code || "unknown") +
                "\nMessage: " +
                (authError.message || "Unknown Firebase Authentication error.")
            );
          }

          return;
        }

        /* ---------------------------------------------
           Step 2: Create Firestore User Profile
        --------------------------------------------- */

        try {
          await createOrLoadUserProfile(result.user, {
            name: name,
            role: role,
            skills: skills
          });
        } catch (firestoreError) {
          console.error("Firestore profile creation error:", firestoreError);

          if (button) {
            button.disabled = false;
            button.textContent = "Create Account";
          }

          showError(
            "Firebase Authentication account was created, but the SocialWorkBD profile could not be created.\n\n" +
              "Firestore Code: " +
              (firestoreError.code || "unknown") +
              "\n\nMessage: " +
              (firestoreError.message || "Unknown Firestore error.") +
              "\n\nPlease send this error to me."
          );

          return;
        }

        /* ---------------------------------------------
           Signup Complete
        --------------------------------------------- */

        await auth.signOut();

        alert("Account created successfully. Please log in.");

        form.reset();

        if (button) {
          button.disabled = false;
          button.textContent = "Create Account";
        }

        window.location.href = "login.html";
      } catch (error) {
        console.error("Signup error:", error);

        if (button) {
          button.disabled = false;
          button.textContent = "Create Account";
        }

        showError(
          "Unable to create your account.\n\nCode: " +
            (error.code || "unknown") +
            "\n\nMessage: " +
            (error.message || "Unknown error.")
        );
      }
    });
  }

  /* ---------------------------------------------------------
     Login
  --------------------------------------------------------- */

  function setupLogin() {
    const form = document.getElementById("login-form");

    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const button = document.getElementById("login-btn");

      try {
        const { auth } = getFirebase();

        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";

        if (!email || !password) {
          showError("Please enter your email and password.");
          return;
        }

        if (button) {
          button.disabled = true;
          button.textContent = "Signing in...";
        }

        const result = await auth.signInWithEmailAndPassword(email, password);

        const profile = await createOrLoadUserProfile(result.user);

        const accountStatus = getAccountStatus(profile);

        if (accountStatus === ACCOUNT_STATUS.SUSPENDED) {
          alert(
            "Your account is currently suspended. " +
              "You can request a review from Support."
          );

          await auth.signOut();

          localStorage.removeItem("currentUser");

          if (button) {
            button.disabled = false;
            button.textContent = "Log In";
          }

          return;
        }

        if (accountStatus === ACCOUNT_STATUS.RESTRICTED) {
          alert(
            "Your account currently has restrictions. " +
              "Some platform activities may be unavailable."
          );
        }

        if (profile.role === "client") {
          window.location.href = "client-dashboard.html";
        } else if (profile.role === "worker" || profile.role === "freelancer") {
          window.location.href = "worker-dashboard.html";
        } else {
          window.location.href = "profile.html";
        }
      } catch (error) {
        console.error("Login error:", error);

        if (button) {
          button.disabled = false;
          button.textContent = "Log In";
        }

        let message = "Unable to log in.";

        if (
          error.code === "auth/user-not-found" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/invalid-credential"
        ) {
          message = "Incorrect email or password.";
        } else if (error.code === "auth/invalid-email") {
          message = "Please enter a valid email address.";
        } else if (error.code === "auth/too-many-requests") {
          message = "Too many login attempts. Please try again later.";
        } else if (error.code === "auth/network-request-failed") {
          message = "Network error. Please check your internet connection.";
        }

        showError(message);
      }
    });
  }

  /* ---------------------------------------------------------
     Forgot Password
  --------------------------------------------------------- */

  function setupForgotPassword() {
    const forgotLink = document.getElementById("forgot-password");
    const panel = document.getElementById("forgot-password-panel");
    const form = document.getElementById("forgot-password-form");
    const emailInput = document.getElementById("reset-email");
    const button = document.getElementById("reset-password-btn");
    const messageBox = document.getElementById("reset-message");

    if (!forgotLink || !panel || !form) {
      return;
    }

    forgotLink.addEventListener("click", function (event) {
      event.preventDefault();

      panel.classList.add("active");

      const loginEmail = document.getElementById("email")?.value.trim() || "";

      if (emailInput && loginEmail && !emailInput.value) {
        emailInput.value = loginEmail;
      }

      if (emailInput) {
        setTimeout(function () {
          emailInput.focus();
        }, 100);
      }
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      try {
        const { auth } = getFirebase();

        const email = emailInput?.value.trim() || "";

        if (!email) {
          showError("Please enter your email address.");
          return;
        }

        if (button) {
          button.disabled = true;
          button.textContent = "Sending...";
        }

        await auth.sendPasswordResetEmail(email);

        if (messageBox) {
          messageBox.textContent =
            "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder.";

          messageBox.style.background = "#eef8ec";
          messageBox.style.border = "1px solid #cfe6ca";
          messageBox.style.color = "#168b08";

          messageBox.classList.add("show");
        }

        form.reset();

        if (button) {
          button.disabled = false;
          button.textContent = "Send Reset Link";
        }
      } catch (error) {
        console.error("Password reset error:", error);

        if (button) {
          button.disabled = false;
          button.textContent = "Send Reset Link";
        }

        let message = "Unable to send the password reset email.";

        if (error.code === "auth/invalid-email") {
          message = "Please enter a valid email address.";
        } else if (error.code === "auth/user-not-found") {
          message = "No account was found with this email address.";
        } else if (error.code === "auth/network-request-failed") {
          message = "Network error. Please check your internet connection.";
        } else if (error.code === "auth/too-many-requests") {
          message = "Too many requests. Please try again later.";
        }

        if (messageBox) {
          messageBox.textContent = message;

          messageBox.style.background = "#fff4f4";
          messageBox.style.border = "1px solid #f0caca";
          messageBox.style.color = "#b42318";

          messageBox.classList.add("show");
        } else {
          showError(message);
        }
      }
    });
  }

  /* ---------------------------------------------------------
     Google Login
  --------------------------------------------------------- */

  function setupGoogleLogin() {
    const button = document.getElementById("google-login");

    if (!button) return;

    button.addEventListener("click", async function () {
      try {
        const { auth } = getFirebase();

        button.disabled = true;
        button.textContent = "Connecting...";

        const provider = new firebase.auth.GoogleAuthProvider();

        provider.addScope("profile");
        provider.addScope("email");

        const result = await auth.signInWithPopup(provider);

        const profile = await createOrLoadUserProfile(result.user);

        const accountStatus = getAccountStatus(profile);

        if (accountStatus === ACCOUNT_STATUS.SUSPENDED) {
          alert(
            "Your account is currently suspended. " +
              "You can request a review from Support."
          );

          await auth.signOut();

          localStorage.removeItem("currentUser");

          button.disabled = false;
          button.textContent = "Continue with Google";

          return;
        }

        if (profile.role === "client") {
          window.location.href = "client-dashboard.html";
        } else if (profile.role === "worker" || profile.role === "freelancer") {
          window.location.href = "worker-dashboard.html";
        } else {
          window.location.href = "profile.html";
        }
      } catch (error) {
        console.error("Google login error:", error);

        button.disabled = false;
        button.textContent = "Continue with Google";

        let message = "Unable to continue with Google.";

        if (error.code === "auth/popup-closed-by-user") {
          message = "Google sign-in was cancelled.";
        } else if (error.code === "auth/popup-blocked") {
          message =
            "The Google sign-in window was blocked. Please allow pop-ups and try again.";
        } else if (error.code === "auth/account-exists-with-different-credential") {
          message =
            "An account already exists with this email using another sign-in method.";
        } else if (error.code === "auth/network-request-failed") {
          message = "Network error. Please check your internet connection.";
        }

        showError(message);
      }
    });
  }

  /* ---------------------------------------------------------
     Home Page - Latest Jobs
  --------------------------------------------------------- */

  async function loadHomeJobs() {
    const container = document.getElementById("job-list");

    if (!container) return;

    try {
      const { db } = getFirebase();

      const snapshot = await db
        .collection("jobs")
        .where("status", "==", "open")
        .limit(20)
        .get();

      const jobs = [];

      snapshot.forEach(function (doc) {
        jobs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      jobs.sort(function (a, b) {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;

        return bTime - aTime;
      });

      renderHomeJobs(jobs);
    } catch (error) {
      console.error("Home jobs error:", error);

      container.innerHTML =
        '<div class="empty-state">Unable to load jobs right now.</div>';
    }
  }

  function renderHomeJobs(jobs) {
    const container = document.getElementById("job-list");

    if (!container) return;

    if (!jobs.length) {
      container.innerHTML =
        '<div class="empty-state">' +
        "<h3>No jobs posted yet</h3>" +
        "<p>New freelance opportunities will appear here.</p>" +
        "</div>";

      return;
    }

    container.innerHTML = jobs
      .map(function (job) {
        return `
          <article class="job-card">
            <div class="job-card-main">

              <span class="job-card-status">Open</span>

              <h3>
                <a href="job-details.html?id=${encodeURIComponent(job.id)}">
                  ${escapeHtml(job.title || "Untitled Job")}
                </a>
              </h3>

              <p>
                ${escapeHtml((job.description || "").substring(0, 180))}
              </p>

              <div class="job-card-skills">
                ${escapeHtml(job.skills || "General")}
              </div>

            </div>

            <div class="job-card-side">
              <strong>${formatBudget(job.budget)}</strong>
              <span>${Number(job.deliveryDays || 0)} days</span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  /* ---------------------------------------------------------
     Home Search
  --------------------------------------------------------- */

  function setupHomeSearch() {
    const form = document.getElementById("home-search-form");
    const input = document.getElementById("home-search");

    if (!form || !input) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const query = input.value.trim();

      if (query) {
        window.location.href = "tasks.html?search=" + encodeURIComponent(query);
      } else {
        window.location.href = "tasks.html";
      }
    });
  }

  /* ---------------------------------------------------------
     Post Job
  --------------------------------------------------------- */

  function setupPostJob() {
    const form = document.getElementById("job-form");

    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      try {
        const { auth, db } = getFirebase();

        const user = auth.currentUser;

        if (!user) {
          window.location.href = "login.html";
          return;
        }

        const profile = await getUserProfile(user.uid);

        if (!profile) {
          showError("Your profile could not be loaded.");
          return;
        }

        const accountStatus = getAccountStatus(profile);

        if (accountStatus === ACCOUNT_STATUS.SUSPENDED) {
          showError("Your account is suspended. You cannot post jobs.");
          return;
        }

        if (accountStatus === ACCOUNT_STATUS.RESTRICTED) {
          showError(
            "Your account currently has restrictions. You cannot post new jobs right now."
          );
          return;
        }

        if (profile.role !== "client") {
          showError("Only client accounts can post jobs.");
          return;
        }

        const title = document.getElementById("title")?.value.trim() || "";
        const description = document.getElementById("desc")?.value.trim() || "";
        const budget = Number(document.getElementById("budget")?.value || 0);
        const skills = document.getElementById("skills")?.value.trim() || "";
        const deliveryDays = Number(
          document.getElementById("delivery-days")?.value || 0
        );

        if (!title || !description || budget <= 0 || !skills || deliveryDays <= 0) {
          showError("Please complete all job details.");
          return;
        }

        const button = document.getElementById("post-job-btn");

        if (button) {
          button.disabled = true;
          button.textContent = "Posting...";
        }

        await db.collection("jobs").add({
          title: title,
          description: description,
          budget: budget,
          skills: skills,
          deliveryDays: deliveryDays,
          category: "",
          clientId: user.uid,
          clientName: profile.name || "Client",
          clientAccountId: profile.accountId || "",
          status: "open",
          proposalCount: 0,
          hiredFreelancerId: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Your job has been posted successfully.");

        form.reset();

        window.location.href = "client-dashboard.html";
      } catch (error) {
        console.error("Post job error:", error);

        const button = document.getElementById("post-job-btn");

        if (button) {
          button.disabled = false;
          button.textContent = "Post Job";
        }

        showError("Unable to post the job. Please try again.");
      }
    });
  }

  /* ---------------------------------------------------------
     Job Details
  --------------------------------------------------------- */

  async function loadJobDetails() {
    const titleElement = document.getElementById("job-title");

    if (!titleElement) {
      return;
    }

    const loading = document.getElementById("job-loading");
    const content = document.getElementById("job-content");
    const errorBox = document.getElementById("job-error");

    try {
      const { db } = getFirebase();

      const params = new URLSearchParams(window.location.search);
      const jobId = params.get("id");

      if (!jobId) {
        throw new Error("Missing job ID.");
      }

      const snapshot = await db.collection("jobs").doc(jobId).get();

      if (!snapshot.exists) {
        throw new Error("Job not found.");
      }

      const job = {
        id: snapshot.id,
        ...snapshot.data()
      };

      const title = document.getElementById("job-title");
      const description = document.getElementById("job-desc");
      const budget = document.getElementById("job-budget");
      const skills = document.getElementById("job-skills");
      const delivery = document.getElementById("job-delivery");
      const proposals = document.getElementById("job-proposals");
      const client = document.getElementById("job-client");
      const status = document.getElementById("job-status");

      if (title) {
        title.textContent = job.title || "Untitled Job";
      }

      if (description) {
        description.textContent = job.description || "No description provided.";
      }

      if (budget) {
        budget.textContent = formatBudget(job.budget);
      }

      if (delivery) {
        const days = Number(job.deliveryDays || 0);

        delivery.textContent = days > 0 ? days + " days" : "Not specified";
      }

      if (proposals) {
        proposals.textContent = Number(job.proposalCount || 0);
      }

      if (client) {
        client.textContent = job.clientName || "Client";
      }

      if (status) {
        const currentStatus = String(job.status || "open").toLowerCase();

        status.textContent =
          currentStatus === "open"
            ? "Open"
            : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);

        if (currentStatus !== "open") {
          status.style.background = "#f2f2f2";
          status.style.color = "#666";
        }
      }

      if (skills) {
        const skillText = String(job.skills || "");

        const skillItems = skillText
          .split(",")
          .map(function (item) {
            return item.trim();
          })
          .filter(Boolean);

        if (skillItems.length) {
          skills.innerHTML = skillItems
            .map(function (skill) {
              return `<span class="skill-tag">${escapeHtml(skill)}</span>`;
            })
            .join("");
        } else {
          skills.innerHTML = '<span class="skill-tag">General</span>';
        }
      }

      if (loading) {
        loading.style.display = "none";
      }

      if (errorBox) {
        errorBox.style.display = "none";
      }

      if (content) {
        content.style.display = "grid";
      }

      setupProposalForm(job);
    } catch (error) {
      console.error("Job details error:", error);

      if (loading) {
        loading.style.display = "none";
      }

      if (content) {
        content.style.display = "none";
      }

      if (errorBox) {
        errorBox.style.display = "block";
      }
    }
  }

  /* ---------------------------------------------------------
     Proposal Form
  --------------------------------------------------------- */

  function setupProposalForm(job) {
    const form = document.getElementById("bid-form");

    if (!form) return;

    const notice = document.getElementById("job-notice");

    const submitButton = form.querySelector('button[type="submit"]');

    const { auth } = getFirebase();

    const user = auth.currentUser;

    if (String(job.status || "").toLowerCase() !== "open") {
      if (notice) {
        notice.textContent = "This job is no longer accepting proposals.";
        notice.style.display = "block";
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      return;
    }

    if (!user) {
      if (notice) {
        notice.textContent = "Please log in as a freelancer to submit a proposal.";
        notice.style.display = "block";
      }

      return;
    }

    if (user.uid === job.clientId) {
      if (notice) {
        notice.textContent = "You cannot submit a proposal to your own job.";
        notice.style.display = "block";
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      return;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      try {
        const { auth, db } = getFirebase();

        const currentUser = auth.currentUser;

        if (!currentUser) {
          window.location.href = "login.html";
          return;
        }

        const profile = await getUserProfile(currentUser.uid);

        if (!profile) {
          showError("Your freelancer profile could not be loaded.");
          return;
        }

        const accountStatus = getAccountStatus(profile);

        if (accountStatus === ACCOUNT_STATUS.SUSPENDED) {
          showError("Your account is suspended. You cannot submit proposals.");
          return;
        }

        if (accountStatus === ACCOUNT_STATUS.RESTRICTED) {
          showError(
            "Your account currently has restrictions. You cannot submit proposals right now."
          );
          return;
        }

        if (profile.role !== "worker" && profile.role !== "freelancer") {
          showError("Only freelancer accounts can submit proposals.");
          return;
        }

        if (currentUser.uid === job.clientId) {
          showError("You cannot apply to your own job.");
          return;
        }

        const duplicate = await db
          .collection("proposals")
          .where("jobId", "==", job.id)
          .where("freelancerId", "==", currentUser.uid)
          .limit(1)
          .get();

        if (!duplicate.empty) {
          showError("You have already submitted a proposal for this job.");
          return;
        }

        const coverLetter = document.getElementById("cover")?.value.trim() || "";
        const amount = Number(document.getElementById("bid-amount")?.value || 0);
        const deliveryDays = Number(
          document.getElementById("delivery-days")?.value || 0
        );

        if (!coverLetter || amount <= 0 || deliveryDays <= 0) {
          showError("Please complete all proposal details.");
          return;
        }

        const button = submitButton;

        if (button) {
          button.disabled = true;
          button.textContent = "Submitting...";
        }

        await db.collection("proposals").add({
          jobId: job.id,
          jobTitle: job.title || "",
          clientId: job.clientId || "",
          freelancerId: currentUser.uid,
          freelancerName: profile.name || "Freelancer",
          freelancerAccountId: profile.accountId || "",
          coverLetter: coverLetter,
          amount: amount,
          deliveryDays: deliveryDays,
          status: "submitted",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db
          .collection("jobs")
          .doc(job.id)
          .update({
            proposalCount: firebase.firestore.FieldValue.increment(1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

        alert("Your proposal has been submitted successfully.");

        form.reset();

        if (notice) {
          notice.textContent = "Your proposal has been submitted successfully.";
          notice.style.display = "block";
          notice.style.background = "#eef8ec";
          notice.style.borderColor = "#cfe6ca";
          notice.style.color = "#168b08";
        }

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Proposal Submitted";
        }

        const proposalsElement = document.getElementById("job-proposals");

        if (proposalsElement) {
          proposalsElement.textContent = Number(job.proposalCount || 0) + 1;
        }
      } catch (error) {
        console.error("Proposal error:", error);

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Submit Proposal";
        }

        showError("Unable to submit your proposal. Please try again.");
      }
    });
  }

  /* ---------------------------------------------------------
     Profile
  --------------------------------------------------------- */

  async function loadProfile() {
    const nameElement = document.getElementById("user-name");

    if (!nameElement) return;

    try {
      const { auth } = getFirebase();

      const user = auth.currentUser;

      const localUser = getCurrentUserLocal();

      let profile = localUser;

      if (user) {
        const firebaseProfile = await getUserProfile(user.uid);

        if (firebaseProfile) {
          profile = firebaseProfile;
          saveCurrentUser(firebaseProfile);
        }
      }

      if (!profile) {
        window.location.href = "login.html";
        return;
      }

      nameElement.textContent = profile.name || "User";

      const emailElement = document.getElementById("user-email");

      if (emailElement) {
        emailElement.textContent = profile.email || "";
      }

      const roleElement = document.getElementById("user-role");

      if (roleElement) {
        roleElement.textContent = getRoleName(profile.role);
      }

      const skillsElement = document.getElementById("user-skills");

      if (skillsElement) {
        skillsElement.textContent = profile.skills || "Not added yet";
      }

      const bioElement = document.getElementById("user-bio");

      if (bioElement) {
        bioElement.textContent = profile.bio || "No bio added yet.";
      }

      const accountElement = document.getElementById("account-id");

      if (accountElement) {
        accountElement.textContent = profile.accountId || "—";
      }
    } catch (error) {
      console.error("Profile error:", error);
    }
  }

  /* ---------------------------------------------------------
     Logout
  --------------------------------------------------------- */

  function setupLogout() {
    const button = document.getElementById("logout-btn");

    if (!button) return;

    button.addEventListener("click", async function () {
      try {
        const { auth } = getFirebase();

        await auth.signOut();

        localStorage.removeItem("currentUser");

        window.location.href = "index.html";
      } catch (error) {
        console.error("Logout error:", error);

        showError("Unable to log out.");
      }
    });
  }

  /* ---------------------------------------------------------
     Auth State
  --------------------------------------------------------- */

  function setupAuthState() {
    try {
      const { auth } = getFirebase();

      auth.onAuthStateChanged(async function (user) {
        if (!user) {
          return;
        }

        try {
          const profile = await createOrLoadUserProfile(user);

          saveCurrentUser(profile);

          if (getAccountStatus(profile) === ACCOUNT_STATUS.SUSPENDED) {
            console.warn("Account is suspended:", profile.accountId);
          }
        } catch (error) {
          console.error("Auth profile error:", error);
        }
      });
    } catch (error) {
      console.error("Auth state error:", error);
    }
  }

  /* ---------------------------------------------------------
     Start Application
  --------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    setupAuthState();
    setupSignup();
    setupLogin();
    setupForgotPassword();
    setupGoogleLogin();
    setupPostJob();
    setupHomeSearch();
    setupLogout();
    loadHomeJobs();
    loadJobDetails();
    loadProfile();
  });
})();
