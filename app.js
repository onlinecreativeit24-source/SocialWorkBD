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
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showError(message) {
    alert(message);
  }

  function saveCurrentUser(user) {
    if (!user) {
      localStorage.removeItem("currentUser");
      return;
    }

    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        id: user.uid,
        uid: user.uid,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "worker",
        skills: user.skills || "",
        bio: user.bio || "",
        title: user.title || "",
        location: user.location || "",
        photoURL: user.photoURL || "",
        accountId: user.accountId || "",
        balance: Number(user.balance || 0),
        pendingBalance: Number(user.pendingBalance || 0),
        status: user.status || "active"
      })
    );
  }

  function getCurrentUserLocal() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch (error) {
      return null;
    }
  }

  function getRoleName(role) {
    if (role === "client") return "Client";
    if (role === "freelancer") return "Freelancer";
    return "Worker";
  }

  function formatBudget(amount) {
    const value = Number(amount || 0);

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(value);
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Recently";

    try {
      let date;

      if (timestamp.toDate) {
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

  function getPageName() {
    const path = window.location.pathname.split("/");
    return path[path.length - 1] || "index.html";
  }

  function isSignupPage() {
    return getPageName() === "signup.html";
  }

  function getSelectedSignupRole() {
    const roleInput = document.getElementById("role");
    if (roleInput && roleInput.value) {
      return roleInput.value.toLowerCase().trim();
    }

    const selectedRadio = document.querySelector(
      'input[name="role"]:checked'
    );

    if (selectedRadio && selectedRadio.value) {
      return selectedRadio.value.toLowerCase().trim();
    }

    return "worker";
  }

  /* ---------------------------------------------------------
     Firebase User Profile
  --------------------------------------------------------- */

  async function getUserProfile(uid) {
    if (!uid) return null;

    const db = getDB();
    const snapshot = await db.collection("users").doc(uid).get();

    if (!snapshot.exists) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  function generateAccountId(role) {
    const prefix =
      role === "client"
        ? "SWB-C-"
        : "SWB-F-";

    const randomNumber = Math.floor(
      100000 + Math.random() * 900000
    );

    return prefix + randomNumber;
  }

  async function createOrLoadUserProfile(user, extraData) {
    extraData = extraData || {};

    if (!user) {
      throw new Error("No Firebase user found.");
    }

    const db = getDB();
    const ref = db.collection("users").doc(user.uid);
    const snapshot = await ref.get();

    if (snapshot.exists) {
      const data = snapshot.data() || {};

      const profile = {
        id: user.uid,
        uid: user.uid,
        ...data
      };

      saveCurrentUser(profile);
      return profile;
    }

    const rawRole = extraData.role || (isSignupPage() ? getSelectedSignupRole() : "worker");
    const role = String(rawRole).toLowerCase().trim();

    const profile = {
      uid: user.uid,
      accountId: generateAccountId(role),

      name:
        extraData.name ||
        user.displayName ||
        "SocialWorkBD User",

      email:
        user.email ||
        extraData.email ||
        "",

      role: role,

      skills: extraData.skills || "",
      title: extraData.title || "",
      bio: extraData.bio || "",
      location: extraData.location || "",

      photoURL:
        extraData.photoURL ||
        user.photoURL ||
        "",

      balance: 0,
      pendingBalance: 0,

      status: "active",
      warnings: 0,
      violations: 0,

      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(profile);

    const savedProfile = {
      id: user.uid,
      ...profile
    };

    saveCurrentUser(savedProfile);

    return savedProfile;
  }

  /* ---------------------------------------------------------
     Account Moderation
  --------------------------------------------------------- */

  function detectOffPlatformMessage(text) {
    if (!text) return false;

    const value = String(text).toLowerCase();

    const patterns = [
      /https?:\/\//i,
      /www\./i,
      /@[a-z0-9._-]+\.[a-z]{2,}/i,
      /\b\d{8,15}\b/i,
      /\bwhatsapp\b/i,
      /\btelegram\b/i,
      /\bdiscord\b/i,
      /\bsignal\b/i,
      /\bmessenger\b/i,
      /\bfacebook\b/i,
      /\binstagram\b/i,
      /\blinkedin\b/i,
      /\btiktok\b/i,
      /\bskype\b/i,
      /\bsnapchat\b/i
    ];

    return patterns.some(function (pattern) {
      return pattern.test(value);
    });
  }

  async function recordModerationViolation(uid, reason) {
    if (!uid) return;

    try {
      const db = getDB();

      await db.collection("moderationEvents").add({
        uid: uid,
        reason: reason || "Policy violation",
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

      const userRef = db.collection("users").doc(uid);
      const userSnapshot = await userRef.get();

      if (!userSnapshot.exists) return;

      const data = userSnapshot.data() || {};
      const violations = Number(data.violations || 0) + 1;

      let status = data.status || "active";

      if (violations >= 3) {
        status = "restricted";
      }

      if (violations >= 5) {
        status = "suspended";
      }

      await userRef.update({
        violations: violations,
        status: status,
        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error("Moderation error:", error);
    }
  }

  /* ---------------------------------------------------------
     Login Requirement
  --------------------------------------------------------- */

  async function requireLogin(role) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      window.location.href = "login.html";
      return null;
    }

    const profile = await createOrLoadUserProfile(user);

    if (role && profile.role !== role) {
      showError(
        "You need the appropriate account type to perform this action."
      );
      return null;
    }

    if (profile.status === "suspended") {
      showError(
        "Your account is currently suspended."
      );

      await auth.signOut();
      localStorage.removeItem("currentUser");

      window.location.href = "login.html";
      return null;
    }

    return profile;
  }

  /* ---------------------------------------------------------
     Firebase Error Messages
  --------------------------------------------------------- */

  function firebaseErrorMessage(error) {
    const code = error && error.code ? error.code : "";

    const messages = {
      "auth/email-already-in-use":
        "An account with this email already exists. Please log in.",

      "auth/invalid-email":
        "Please enter a valid email address.",

      "auth/weak-password":
        "Password should be at least 6 characters long.",

      "auth/user-not-found":
        "No account found with this email address.",

      "auth/wrong-password":
        "Incorrect password.",

      "auth/invalid-credential":
        "Invalid email or password.",

      "auth/user-disabled":
        "This account has been disabled.",

      "auth/network-request-failed":
        "Network error. Please check your internet connection.",

      "auth/popup-closed-by-user":
        "The authentication popup was closed before completion.",

      "auth/popup-blocked":
        "Browser blocked the popup. Please try again.",

      "auth/cancelled-popup-request":
        "Authentication request was cancelled.",

      "auth/account-exists-with-different-credential":
        "An account already exists with the same email but different sign-in credentials.",

      "auth/operation-not-allowed":
        "This sign-in method is not enabled in Firebase Console.",

      "auth/too-many-requests":
        "Too many unsuccessful attempts. Please try again later."
    };

    return (
      messages[code] ||
      error.message ||
      "An unexpected error occurred. Please try again."
    );
  }

  /* ---------------------------------------------------------
     Signup
  --------------------------------------------------------- */

  function setupSignup() {
    const form = document.getElementById("signup-form");

    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const button =
        document.getElementById("signup-btn");

      const name =
        document.getElementById("name")?.value.trim() || "";

      const email =
        document.getElementById("email")?.value.trim() || "";

      const password =
        document.getElementById("password")?.value || "";

      const confirmPassword =
        document.getElementById("confirm-password")?.value || "";

      const skills =
        document.getElementById("skills")?.value.trim() || "";

      const role = getSelectedSignupRole();

      if (!name) {
        showError("Please enter your name.");
        return;
      }

      if (!email) {
        showError("Please enter your email.");
        return;
      }

      if (!password) {
        showError("Please enter your password.");
        return;
      }

      if (password.length < 6) {
        showError(
          "Password must be at least 6 characters long."
        );
        return;
      }

      if (password !== confirmPassword) {
        showError(
          "Password and Confirm Password do not match."
        );
        return;
      }

      if (!["worker", "freelancer", "client"].includes(role)) {
        showError("Please select a valid account type.");
        return;
      }

      try {
        if (button) {
          button.disabled = true;
          button.textContent = "Creating account...";
        }

        const auth = getAuth();

        const result =
          await auth.createUserWithEmailAndPassword(
            email,
            password
          );

        const user = result.user;

        await createOrLoadUserProfile(user, {
          name: name,
          email: email,
          role: role,
          skills: skills,
          photoURL: user.photoURL || ""
        });

        alert(
          "Account successfully created! Please log in."
        );

        await auth.signOut();

        localStorage.removeItem("currentUser");

        window.location.href = "login.html";
      } catch (error) {
        console.error("Signup error:", error);

        showError(firebaseErrorMessage(error));
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Create Account";
        }
      }
    });
  }

  /* ---------------------------------------------------------
     Google Login / Signup
  --------------------------------------------------------- */

  function createGoogleProvider() {
    const provider =
      new firebase.auth.GoogleAuthProvider();

    provider.addScope("profile");
    provider.addScope("email");

    provider.setCustomParameters({
      prompt: "select_account"
    });

    return provider;
  }

  async function finishGoogleLogin(result) {
    if (!result || !result.user) {
      throw new Error("Google user data not found.");
    }

    const user = result.user;

    let selectedRole = "worker";

    if (isSignupPage()) {
      selectedRole = getSelectedSignupRole();
    }

    let profile =
      await getUserProfile(user.uid);

    if (!profile) {
      profile = await createOrLoadUserProfile(user, {
        name: user.displayName || "Google User",
        email: user.email || "",
        role: selectedRole,
        photoURL: user.photoURL || ""
      });
    } else {
      saveCurrentUser(profile);
    }

    if (profile.status === "suspended") {
      await getAuth().signOut();
      localStorage.removeItem("currentUser");

      showError(
        "Your account is currently suspended."
      );

      return;
    }

    saveCurrentUser(profile);

    if (profile.role === "client") {
      window.location.href = "client-dashboard.html";
      return;
    }

    if (
      profile.role === "worker" ||
      profile.role === "freelancer"
    ) {
      window.location.href = "worker-dashboard.html";
      return;
    }

    window.location.href = "profile.html";
  }

  const GOOGLE_BTN_HTML = `
    <span class="google-icon" style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; background:#fff; border-radius:50%; margin-right:8px;">
      <svg width="14" height="14" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.41-1.57-5.13-3.72L.97 13.04C2.45 15.98 5.48 18 9 18z"/>
        <path fill="#FBBC05" d="M3.87 10.8c-.19-.58-.3-1.19-.3-1.8s.11-1.22.3-1.8L.97 4.96C.35 6.18 0 7.55 0 9s.35 2.82.97 4.04l2.9-2.24z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.45 2.02.97 4.96l2.9 2.24C4.59 5.05 6.62 3.58 9 3.58z"/>
      </svg>
    </span>
    <span class="google-text" style="font-weight:700;">Continue with Google</span>
  `;

  function setupGoogleLogin() {
    const button =
      document.getElementById("google-login");

    if (!button) return;

    button.style.backgroundColor = "#14213d";
    button.style.color = "#ffffff";
    button.innerHTML = GOOGLE_BTN_HTML;

    button.addEventListener("click", async function () {
      try {
        button.disabled = true;
        button.innerHTML = "Connecting to Google...";

        const auth = getAuth();
        const provider = createGoogleProvider();

        try {
          const result =
            await auth.signInWithPopup(provider);

          await finishGoogleLogin(result);
        } catch (popupError) {
          console.error(
            "Google popup error:",
            popupError
          );

          if (
            popupError.code ===
              "auth/popup-blocked" ||
            popupError.code ===
              "auth/operation-not-supported-in-this-environment"
          ) {
            await auth.signInWithRedirect(provider);
            return;
          }

          throw popupError;
        }
      } catch (error) {
        console.error("Google login error:", error);

        showError(firebaseErrorMessage(error));
      } finally {
        button.disabled = false;
        button.innerHTML = GOOGLE_BTN_HTML;
      }
    });
  }

  async function handleGoogleRedirectResult() {
    const auth = getAuth();

    try {
      const result =
        await auth.getRedirectResult();

      if (
        result &&
        result.user
      ) {
        await finishGoogleLogin(result);
      }
    } catch (error) {
      console.error(
        "Google redirect error:",
        error
      );

      if (
        error.code !==
        "auth/no-auth-event"
      ) {
        showError(
          firebaseErrorMessage(error)
        );
      }
    }
  }

  /* ---------------------------------------------------------
     Login
  --------------------------------------------------------- */

  function setupLogin() {
    const form =
      document.getElementById("login-form");

    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const button =
        document.getElementById("login-btn");

      const email =
        document.getElementById("email")?.value.trim() || "";

      const password =
        document.getElementById("password")?.value || "";

      if (!email) {
        showError("Please enter your email.");
        return;
      }

      if (!password) {
        showError("Please enter your password.");
        return;
      }

      try {
        if (button) {
          button.disabled = true;
          button.textContent = "Signing in...";
        }

        const auth = getAuth();

        const result =
          await auth.signInWithEmailAndPassword(
            email,
            password
          );

        const profile =
          await createOrLoadUserProfile(
            result.user
          );

        if (
          profile.status === "suspended"
        ) {
          await auth.signOut();
          localStorage.removeItem(
            "currentUser"
          );

          showError(
            "Your account is currently suspended."
          );

          return;
        }

        if (profile.role === "client") {
          window.location.href =
            "client-dashboard.html";
        } else if (
          profile.role === "worker" ||
          profile.role === "freelancer"
        ) {
          window.location.href =
            "worker-dashboard.html";
        } else {
          window.location.href =
            "profile.html";
        }
      } catch (error) {
        console.error(
          "Login error:",
          error
        );

        showError(
          firebaseErrorMessage(error)
        );
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Log In";
        }
      }
    });
  }

  /* ---------------------------------------------------------
     Forgot Password
  --------------------------------------------------------- */

  function setupForgotPassword() {
    const form =
      document.getElementById(
        "forgot-password-form"
      );

    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const email =
        document.getElementById(
          "forgot-email"
        )?.value.trim() || "";

      if (!email) {
        showError("Please enter your email.");
        return;
      }

      try {
        await getAuth().sendPasswordResetEmail(
          email
        );

        alert(
          "Password reset email sent! Please check your inbox."
        );

        form.reset();
      } catch (error) {
        console.error(
          "Password reset error:",
          error
        );

        showError(
          firebaseErrorMessage(error)
        );
      }
    });

    const openButton =
      document.getElementById(
        "forgot-password"
      );

    const panel =
      document.getElementById(
        "forgot-password-panel"
      );

    const closeButton =
      document.getElementById(
        "close-forgot-password"
      );

    if (openButton && panel) {
      openButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          panel.style.display = "block";
        }
      );
    }

    if (closeButton && panel) {
      closeButton.addEventListener(
        "click",
        function () {
          panel.style.display = "none";
        }
      );
    }
  }

  /* ---------------------------------------------------------
     Homepage Jobs
  --------------------------------------------------------- */

  async function loadHomeJobs() {
    const container =
      document.getElementById(
        "jobs-list"
      ) ||
      document.getElementById(
        "home-jobs"
      );

    if (!container) return;

    try {
      const db = getDB();

      const snapshot =
        await db
          .collection("jobs")
          .where("status", "==", "open")
          .limit(20)
          .get();

      if (snapshot.empty) {
        container.innerHTML =
          '<p class="empty-state">No jobs available yet.</p>';

        return;
      }

      const jobs = [];

      snapshot.forEach(function (doc) {
        jobs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      jobs.sort(function (a, b) {
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
      });

      container.innerHTML =
        jobs
          .map(function (job) {
            const skills =
              Array.isArray(job.skills)
                ? job.skills.join(", ")
                : job.skills || "";

            return `
              <article class="job-card">
                <h3>${escapeHtml(
                  job.title || "Untitled Job"
                )}</h3>

                <p>
                  ${escapeHtml(
                    job.description || ""
                  )}
                </p>

                <div class="job-meta">
                  <strong>${formatBudget(
                    job.budget
                  )}</strong>

                  <span>
                    ${escapeHtml(
                      job.deliveryDays ||
                        "Flexible"
                    )} days
                  </span>
                </div>

                ${
                  skills
                    ? `<div class="job-skills">
                        ${escapeHtml(skills)}
                       </div>`
                    : ""
                }

                <a
                  href="job-details.html?id=${encodeURIComponent(
                    job.id
                  )}"
                  class="btn"
                >
                  View Job
                </a>
              </article>
            `;
          })
          .join("");
    } catch (error) {
      console.error(
        "Load jobs error:",
        error
      );

      container.innerHTML =
        '<p class="empty-state">Unable to load jobs.</p>';
    }
  }

  /* ---------------------------------------------------------
     Home Search
  --------------------------------------------------------- */

  function setupHomeSearch() {
    const form =
      document.getElementById(
        "home-search-form"
      );

    if (!form) return;

    form.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();

        const input =
          document.getElementById(
            "home-search"
          );

        const query =
          input?.value.trim() || "";

        if (!query) {
          window.location.href =
            "tasks.html";

          return;
        }

        window.location.href =
          "tasks.html?search=" +
          encodeURIComponent(query);
      }
    );
  }

  /* ---------------------------------------------------------
     Post Job
  --------------------------------------------------------- */

  function setupPostJob() {
    const form =
      document.getElementById(
        "job-form"
      );

    if (!form) return;

    form.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const profile =
          await requireLogin("client");

        if (!profile) return;

        const button =
          document.getElementById(
            "post-job-btn"
          );

        const title =
          document.getElementById(
            "job-title"
          )?.value.trim() || "";

        const description =
          document.getElementById(
            "job-description"
          )?.value.trim() || "";

        const budget =
          Number(
            document.getElementById(
              "job-budget"
            )?.value || 0
          );

        const skills =
          document.getElementById(
            "job-skills"
          )?.value.trim() || "";

        const deliveryDays =
          document.getElementById(
            "delivery-days"
          )?.value || "";

        if (!title) {
          showError("Please enter a job title.");
          return;
        }

        if (!description) {
          showError("Please enter a job description.");
          return;
        }

        if (!budget || budget <= 0) {
          showError("Please enter a valid budget.");
          return;
        }

        if (
          detectOffPlatformMessage(
            description
          )
        ) {
          await recordModerationViolation(
            profile.uid,
            "Off-platform contact information in job description"
          );

          showError(
            "External contact details are not allowed in the job description."
          );

          return;
        }

        try {
          if (button) {
            button.disabled = true;
            button.textContent =
              "Posting...";
          }

          const db = getDB();

          await db.collection("jobs").add({
            title: title,
            description: description,
            budget: budget,
            skills: skills,
            deliveryDays: deliveryDays,

            ownerId: profile.uid,
            ownerName: profile.name || "",
            ownerAccountId:
              profile.accountId || "",

            status: "open",
            proposalCount: 0,

            createdAt:
              firebase.firestore.FieldValue.serverTimestamp(),

            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          });

          alert(
            "Job posted successfully."
          );

          form.reset();

          window.location.href =
            "index.html";
        } catch (error) {
          console.error(
            "Post job error:",
            error
          );

          showError(
            "Could not post job. " +
              firebaseErrorMessage(error)
          );
        } finally {
          if (button) {
            button.disabled = false;
            button.textContent =
              "Post Job";
          }
        }
      }
    );
  }

  /* ---------------------------------------------------------
     Job Details
  --------------------------------------------------------- */

  async function loadJobDetails() {
    const container =
      document.getElementById(
        "job-details"
      );

    if (!container) return;

    const params =
      new URLSearchParams(
        window.location.search
      );

    const jobId =
      params.get("id");

    if (!jobId) {
      container.innerHTML =
        "<p>Job not found.</p>";

      return;
    }

    try {
      const db = getDB();

      const snapshot =
        await db
          .collection("jobs")
          .doc(jobId)
          .get();

      if (!snapshot.exists) {
        container.innerHTML =
          "<p>Job not found.</p>";

        return;
      }

      const job = snapshot.data();

      const skills =
        Array.isArray(job.skills)
          ? job.skills.join(", ")
          : job.skills || "";

      container.innerHTML = `
        <div class="job-details-card">

          <h1>${escapeHtml(
            job.title || "Untitled Job"
          )}</h1>

          <p class="job-description">
            ${escapeHtml(
              job.description || ""
            )}
          </p>

          <div class="job-meta">
            <strong>${formatBudget(
              job.budget
            )}</strong>

            <span>
              Delivery:
              ${escapeHtml(
                job.deliveryDays ||
                  "Flexible"
              )}
            </span>
          </div>

          ${
            skills
              ? `<p>
                  <strong>Skills:</strong>
                  ${escapeHtml(skills)}
                 </p>`
              : ""
          }

          <p>
            <strong>Proposals:</strong>
            ${Number(
              job.proposalCount || 0
            )}
          </p>

          <p>
            <strong>Posted:</strong>
            ${formatDate(
              job.createdAt
            )}
          </p>

          <p>
            <strong>Status:</strong>
            ${escapeHtml(
              job.status || "open"
            )}
          </p>

        </div>
      `;

      const proposalForm =
        document.getElementById(
          "proposal-form"
        );

      if (proposalForm) {
        setupProposal(
          jobId,
          job
        );
      }
    } catch (error) {
      console.error(
        "Job details error:",
        error
      );

      container.innerHTML =
        "<p>Unable to load job details.</p>";
    }
  }

  /* ---------------------------------------------------------
     Proposal
  --------------------------------------------------------- */

  function setupProposal(jobId, job) {
    const form =
      document.getElementById(
        "proposal-form"
      );

    if (!form) return;

    form.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const profile =
          await requireLogin(
            "worker"
          );

        if (!profile) return;

        if (
          job.status !== "open"
        ) {
          showError(
            "This job is no longer open."
          );

          return;
        }

        const coverLetter =
          document.getElementById(
            "proposal-cover-letter"
          )?.value.trim() || "";

        const proposedBudget =
          Number(
            document.getElementById(
              "proposal-budget"
            )?.value ||
              job.budget ||
              0
          );

        if (!coverLetter) {
          showError(
            "Please write a cover letter."
          );

          return;
        }

        if (
          detectOffPlatformMessage(
            coverLetter
          )
        ) {
          await recordModerationViolation(
            profile.uid,
            "Off-platform contact information in proposal"
          );

          showError(
            "External contact details are not allowed in proposals."
          );

          return;
        }

        try {
          const db = getDB();

          const existing =
            await db
              .collection("proposals")
              .where(
                "jobId",
                "==",
                jobId
              )
              .where(
                "workerId",
                "==",
                profile.uid
              )
              .limit(1)
              .get();

          if (!existing.empty) {
            showError(
              "You have already submitted a proposal for this job."
            );

            return;
          }

          await db
            .collection("proposals")
            .add({
              jobId: jobId,

              workerId:
                profile.uid,

              workerName:
                profile.name || "",

              workerAccountId:
                profile.accountId || "",

              clientId:
                job.ownerId || "",

              coverLetter:
                coverLetter,

              proposedBudget:
                proposedBudget,

              status: "pending",

              createdAt:
                firebase.firestore.FieldValue.serverTimestamp(),

              updatedAt:
                firebase.firestore.FieldValue.serverTimestamp()
            });

          await db
            .collection("jobs")
            .doc(jobId)
            .update({
              proposalCount:
                firebase.firestore.FieldValue.increment(
                  1
                ),

              updatedAt:
                firebase.firestore.FieldValue.serverTimestamp()
            });

          alert(
            "Proposal submitted successfully."
          );

          form.reset();
        } catch (error) {
          console.error(
            "Proposal error:",
            error
          );

          showError(
            "Could not submit proposal. " +
              firebaseErrorMessage(error)
          );
        }
      }
    );
  }

  /* ---------------------------------------------------------
     Profile
  --------------------------------------------------------- */

  async function setupProfile() {
    const profileName =
      document.getElementById(
        "profile-name"
      );

    const profileEmail =
      document.getElementById(
        "profile-email"
      );

    const profileRole =
      document.getElementById(
        "profile-role"
      );

    const profileSkills =
      document.getElementById(
        "profile-skills"
      );

    const profileBio =
      document.getElementById(
        "profile-bio"
      );

    const accountId =
      document.getElementById(
        "account-id"
      );

    if (
      !profileName &&
      !profileEmail &&
      !profileRole
    ) {
      return;
    }

    const auth =
      getAuth();

    const user =
      auth.currentUser;

    if (!user) {
      window.location.href =
        "login.html";

      return;
    }

    try {
      const profile =
        await createOrLoadUserProfile(
          user
        );

      if (profileName) {
        profileName.textContent =
          profile.name || "";
      }

      if (profileEmail) {
        profileEmail.textContent =
          profile.email || "";
      }

      if (profileRole) {
        profileRole.textContent =
          getRoleName(
            profile.role
          );
      }

      if (profileSkills) {
        profileSkills.value =
          profile.skills || "";
        profileSkills.textContent =
          profile.skills || "";
      }

      if (profileBio) {
        profileBio.value =
          profile.bio || "";
        profileBio.textContent =
          profile.bio || "";
      }

      if (accountId) {
        accountId.textContent =
          profile.accountId || "";
      }

      const nameInput =
        document.getElementById(
          "profile-name-input"
        );

      const roleInput =
        document.getElementById(
          "profile-role-input"
        );

      const skillsInput =
        document.getElementById(
          "profile-skills-input"
        );

      const bioInput =
        document.getElementById(
          "profile-bio-input"
        );

      if (nameInput) {
        nameInput.value =
          profile.name || "";
      }

      if (roleInput) {
        roleInput.value =
          profile.role || "worker";
      }

      if (skillsInput) {
        skillsInput.value =
          profile.skills || "";
      }

      if (bioInput) {
        bioInput.value =
          profile.bio || "";
      }

      setupProfileUpdate();
    } catch (error) {
      console.error(
        "Profile load error:",
        error
      );

      showError(
        "Unable to load profile."
      );
    }
  }

  function setupProfileUpdate() {
    const form =
      document.getElementById(
        "profile-form"
      );

    if (!form) return;

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

        const auth =
          getAuth();

        const user =
          auth.currentUser;

        if (!user) {
          window.location.href =
            "login.html";

          return;
        }

        const name =
          document.getElementById(
            "profile-name-input"
          )?.value.trim() || "";

        const skills =
          document.getElementById(
            "profile-skills-input"
          )?.value.trim() || "";

        const bio =
          document.getElementById(
            "profile-bio-input"
          )?.value.trim() || "";

        if (!name) {
          showError(
            "Name cannot be left empty."
          );

          return;
        }

        if (
          detectOffPlatformMessage(
            bio
          )
        ) {
          showError(
            "External contact details are not allowed in your bio."
          );

          return;
        }

        try {
          const db =
            getDB();

          await db
            .collection("users")
            .doc(user.uid)
            .update({
              name: name,
              skills: skills,
              bio: bio,

              updatedAt:
                firebase.firestore.FieldValue.serverTimestamp()
            });

          const profile =
            await getUserProfile(
              user.uid
            );

          saveCurrentUser(
            profile
          );

          alert(
            "Profile updated successfully."
          );

          window.location.reload();
        } catch (error) {
          console.error(
            "Profile update error:",
            error
          );

          showError(
            "Unable to update profile."
          );
        }
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

              showError(
                "Unable to log out."
              );
            }
          }
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Signup Role Selector
  --------------------------------------------------------- */

  function setupRoleSelector() {
    const roleInput =
      document.getElementById(
        "role"
      );

    const radios =
      document.querySelectorAll(
        'input[name="role"]'
      );

    if (!radios.length) return;

    radios.forEach(
      function (radio) {
        radio.addEventListener(
          "change",
          function () {
            if (roleInput) {
              roleInput.value =
                radio.value.toLowerCase().trim();
            }
          }
        );
      }
    );

    const checked =
      document.querySelector(
        'input[name="role"]:checked'
      );

    if (
      checked &&
      roleInput
    ) {
      roleInput.value =
        checked.value.toLowerCase().trim();
    }
  }

  /* ---------------------------------------------------------
     Auth State
  --------------------------------------------------------- */

  function setupAuthState() {
    const auth =
      getAuth();

    auth.onAuthStateChanged(
      async function (user) {
        if (!user) {
          return;
        }

        try {
          const profile =
            await createOrLoadUserProfile(
              user
            );

          if (
            profile &&
            profile.status ===
              "suspended"
          ) {
            await auth.signOut();

            localStorage.removeItem(
              "currentUser"
            );

            return;
          }

          saveCurrentUser(
            profile
          );
        } catch (error) {
          console.error(
            "Auth state profile error:",
            error
          );
        }
      }
    );
  }

  /* ---------------------------------------------------------
     Initialize
  --------------------------------------------------------- */

  async function init() {
    try {
      getFirebase();

      setupRoleSelector();
      setupSignup();
      setupGoogleLogin();
      setupLogin();
      setupForgotPassword();
      setupHomeSearch();
      setupPostJob();
      setupLogout();

      await handleGoogleRedirectResult();

      await loadHomeJobs();
      await loadJobDetails();
      await setupProfile();

      setupAuthState();
    } catch (error) {
      console.error(
        "SocialWorkBD initialization error:",
        error
      );
    }
  }

  /* ---------------------------------------------------------
     Start Application
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
