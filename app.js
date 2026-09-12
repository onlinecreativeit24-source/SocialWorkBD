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
      return roleInput.value;
    }

    const selectedRadio = document.querySelector(
      'input[name="role"]:checked'
    );

    if (selectedRadio && selectedRadio.value) {
      return selectedRadio.value;
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

    const role =
      extraData.role ||
      (isSignupPage() ? getSelectedSignupRole() : "worker") ||
      "worker";

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

  const MODERATION_STATUSES = [
    "active",
    "warning",
    "restricted",
    "suspended",
    "under_review"
  ];

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
        "এই কাজটি করার জন্য আপনার সঠিক account type প্রয়োজন।"
      );
      return null;
    }

    if (profile.status === "suspended") {
      showError(
        "আপনার account বর্তমানে suspended অবস্থায় আছে।"
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
        "এই email দিয়ে ইতিমধ্যে account আছে। Login করুন।",

      "auth/invalid-email":
        "সঠিক email address দিন।",

      "auth/weak-password":
        "Password কমপক্ষে 6 characters হতে হবে।",

      "auth/user-not-found":
        "এই email দিয়ে কোনো account পাওয়া যায়নি।",

      "auth/wrong-password":
        "Password সঠিক নয়।",

      "auth/invalid-credential":
        "Email অথবা password সঠিক নয়।",

      "auth/user-disabled":
        "এই account বর্তমানে disabled।",

      "auth/network-request-failed":
        "Internet connection সমস্যা হয়েছে।",

      "auth/popup-closed-by-user":
        "Google login window বন্ধ করা হয়েছে।",

      "auth/popup-blocked":
        "Browser popup block করেছে। আবার চেষ্টা করুন।",

      "auth/cancelled-popup-request":
        "Google login request বাতিল হয়েছে।",

      "auth/account-exists-with-different-credential":
        "এই email অন্য একটি login method দিয়ে registered।",

      "auth/operation-not-allowed":
        "এই login method Firebase Console-এ enable করা নেই।",

      "auth/too-many-requests":
        "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
    };

    return (
      messages[code] ||
      error.message ||
      "একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।"
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
        showError("আপনার নাম লিখুন।");
        return;
      }

      if (!email) {
        showError("আপনার email লিখুন।");
        return;
      }

      if (!password) {
        showError("Password লিখুন।");
        return;
      }

      if (password.length < 6) {
        showError(
          "Password কমপক্ষে 6 characters হতে হবে।"
        );
        return;
      }

      if (password !== confirmPassword) {
        showError(
          "Password এবং Confirm Password একই নয়।"
        );
        return;
      }

      if (!["worker", "freelancer", "client"].includes(role)) {
        showError("Account type সঠিকভাবে নির্বাচন করুন।");
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
          "Account সফলভাবে তৈরি হয়েছে। এখন Login করুন।"
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
      throw new Error("Google account পাওয়া যায়নি।");
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
        "আপনার account বর্তমানে suspended অবস্থায় আছে।"
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

  function setupGoogleLogin() {
    const button =
      document.getElementById("google-login");

    if (!button) return;

    button.addEventListener("click", async function () {
      try {
        button.disabled = true;

        const originalText =
          button.innerHTML;

        button.innerHTML =
          "Connecting to Google...";

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

          /*
             Mobile browser fallback.
             Popup blocked হলে redirect login ব্যবহার হবে।
          */

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

        button.innerHTML =
          '<span style="font-weight:700;">G</span> Continue with Google';
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
        showError("Email লিখুন।");
        return;
      }

      if (!password) {
        showError("Password লিখুন।");
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
            "আপনার account বর্তমানে suspended অবস্থায় আছে।"
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
          button.textContent = "Login";
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
        showError("Email লিখুন।");
        return;
      }

      try {
        await getAuth().sendPasswordResetEmail(
          email
        );

        alert(
          "Password reset email পাঠানো হয়েছে। আপনার inbox check করুন।"
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
        '<p class="empty-state">Jobs load করা যাচ্ছে না।</p>';
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
          showError("Job title লিখুন।");
          return;
        }

        if (!description) {
          showError("Job description লিখুন।");
          return;
        }

        if (!budget || budget <= 0) {
          showError("Valid budget দিন।");
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
            "Job description-এ external contact information দেওয়া যাবে না।"
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
            "Job সফলভাবে পোস্ট হয়েছে।"
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
            "Job post করা যায়নি। " +
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
        "<p>Job details load করা যায়নি।</p>";
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
            "এই job এখন আর open নেই।"
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
            "Cover letter লিখুন।"
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
            "Proposal-এ external contact information দেওয়া যাবে না।"
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
              "আপনি এই job-এ ইতিমধ্যে proposal দিয়েছেন।"
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
            "Proposal সফলভাবে পাঠানো হয়েছে।"
          );

          form.reset();
        } catch (error) {
          console.error(
            "Proposal error:",
            error
          );

          showError(
            "Proposal পাঠানো যায়নি। " +
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
        "Profile load করা যায়নি।"
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
            "Name খালি রাখা যাবে না।"
          );

          return;
        }

        if (
          detectOffPlatformMessage(
            bio
          )
        ) {
          showError(
            "Bio-তে external contact information দেওয়া যাবে না।"
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
            "Profile update করা যায়নি।"
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
                "Logout করা যায়নি।"
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
                radio.value;
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
        checked.value;
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
