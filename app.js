// ==========================================
// SocialWorkBD
// Firebase Authentication + Firestore
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // Firebase Safety Check
  // ==========================================

  const auth = window.auth || null;
  const db = window.db || null;

  function firebaseReady() {
    if (!auth || !db) {
      alert(
        "Firebase load হয়নি।\n\n" +
        "firebase-config.js এবং Firebase SDK ঠিকভাবে যুক্ত আছে কি না দেখুন।"
      );
      return false;
    }
    return true;
  }

  // ==========================================
  // Storage Helpers
  // ==========================================

  function getJobs() {
    return JSON.parse(localStorage.getItem("jobs") || "[]");
  }

  function getBids() {
    return JSON.parse(localStorage.getItem("bids") || "[]");
  }

  function saveJobs(jobs) {
    localStorage.setItem("jobs", JSON.stringify(jobs));
  }

  function saveBids(bids) {
    localStorage.setItem("bids", JSON.stringify(bids));
  }

  function getCurrentUser() {
    return JSON.parse(
      localStorage.getItem("currentUser") || "null"
    );
  }

  function setCurrentUser(user) {
    localStorage.setItem(
      "currentUser",
      JSON.stringify(user)
    );
  }

  function clearCurrentUser() {
    localStorage.removeItem("currentUser");
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  function requireLogin() {
    if (!isLoggedIn()) {
      alert("এই কাজটি করতে আগে Login করুন।");
      window.location.href = "login.html";
      return false;
    }

    return true;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================
  // SIGNUP
  // ==========================================

  const signupForm =
    document.getElementById("signup-form");

  if (signupForm) {

    signupForm.addEventListener("submit", async (e) => {

      e.preventDefault();

      if (!firebaseReady()) return;

      const name =
        document.getElementById("name")?.value.trim();

      const email =
        document.getElementById("email")?.value.trim();

      const password =
        document.getElementById("password")?.value;

      const confirmPassword =
        document.getElementById("confirm-password")?.value;

      const role =
        document.getElementById("role")?.value;

      const skills =
        document.getElementById("skills")?.value.trim() || "";

      // ------------------------------
      // Validation
      // ------------------------------

      if (!name || !email || !password || !confirmPassword) {
        alert("সব প্রয়োজনীয় তথ্য পূরণ করুন।");
        return;
      }

      if (password !== confirmPassword) {
        alert("Password এবং Confirm Password মিলছে না।");
        return;
      }

      if (password.length < 6) {
        alert("Password কমপক্ষে 6 অক্ষরের হতে হবে।");
        return;
      }

      if (role === "worker" && !skills) {
        alert("Worker হলে আপনার Skills লিখুন।");
        return;
      }

      // ------------------------------
      // Create Firebase User
      // ------------------------------

      try {

        const userCredential =
          await auth.createUserWithEmailAndPassword(
            email,
            password
          );

        const firebaseUser =
          userCredential.user;

        // Display Name
        try {
          await firebaseUser.updateProfile({
            displayName: name
          });
        } catch (profileError) {
          console.warn(
            "Profile name update failed:",
            profileError
          );
        }

        // ------------------------------
        // Firestore User Profile
        // ------------------------------

        try {

          await db
            .collection("users")
            .doc(firebaseUser.uid)
            .set({
              uid: firebaseUser.uid,
              name: name,
              email: email,
              role: role || "worker",
              skills: skills,
              balance: 0,
              pendingBalance: 0,
              createdAt:
                firebase.firestore.FieldValue.serverTimestamp()
            });

        } catch (firestoreError) {

          console.error(
            "Firestore profile error:",
            firestoreError
          );

          // Account exists even if profile save fails.
          alert(
            "Account তৈরি হয়েছে, কিন্তু Profile save করতে সমস্যা হয়েছে।\n\n" +
            "Error: " +
            (firestoreError.code || firestoreError.message)
          );

          setCurrentUser({
            id: firebaseUser.uid,
            name: name,
            email: email,
            role: role || "worker",
            skills: skills,
            balance: 0,
            pendingBalance: 0
          });

          window.location.href = "index.html";
          return;
        }

        // ------------------------------
        // Save Local Session
        // ------------------------------

        setCurrentUser({
          id: firebaseUser.uid,
          name: name,
          email: email,
          role: role || "worker",
          skills: skills,
          balance: 0,
          pendingBalance: 0
        });

        alert("Signup সফল হয়েছে!");

        window.location.href = "index.html";

      } catch (error) {

        console.error("SIGNUP ERROR:", error);

        let message =
          error.code ||
          error.message ||
          "Unknown Firebase error";

        switch (error.code) {

          case "auth/email-already-in-use":
            message =
              "এই Email দিয়ে ইতিমধ্যে Account আছে।";
            break;

          case "auth/invalid-email":
            message =
              "Email address সঠিক নয়।";
            break;

          case "auth/weak-password":
            message =
              "Password দুর্বল। কমপক্ষে 6 অক্ষর ব্যবহার করুন।";
            break;

          case "auth/operation-not-allowed":
            message =
              "Firebase Email/Password Authentication চালু নেই।";
            break;

          case "auth/invalid-api-key":
            message =
              "Firebase API key invalid। firebase-config.js-এর API key পরীক্ষা করুন।";
            break;

          case "auth/api-key-not-valid":
            message =
              "Firebase API key valid নয়। Firebase Project-এর Web App config থেকে সঠিক API key দিন।";
            break;

          case "auth/network-request-failed":
            message =
              "Internet connection সমস্যা হয়েছে।";
            break;

          default:
            message =
              "Signup Error:\n\n" +
              (error.code || "") +
              "\n" +
              (error.message || "");
        }

        alert(message);
      }
    });
  }

  // ==========================================
  // LOGIN
  // ==========================================

  const loginForm =
    document.getElementById("login-form");

  if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

      e.preventDefault();

      if (!firebaseReady()) return;

      const email =
        document.getElementById("email")?.value.trim();

      const password =
        document.getElementById("password")?.value;

      if (!email || !password) {
        alert("Email এবং Password দিন।");
        return;
      }

      try {

        // Firebase Login
        const userCredential =
          await auth.signInWithEmailAndPassword(
            email,
            password
          );

        const firebaseUser =
          userCredential.user;

        let profile = null;

        // ------------------------------
        // Load Firestore Profile
        // ------------------------------

        try {

          const profileDoc =
            await db
              .collection("users")
              .doc(firebaseUser.uid)
              .get();

          if (profileDoc.exists) {
            profile = profileDoc.data();
          }

        } catch (firestoreError) {

          console.warn(
            "Profile load failed:",
            firestoreError
          );
        }

        // ------------------------------
        // Fallback Profile
        // ------------------------------

        if (!profile) {

          profile = {
            uid: firebaseUser.uid,
            name:
              firebaseUser.displayName ||
              email.split("@")[0],
            email: firebaseUser.email,
            role: "worker",
            skills: "",
            balance: 0,
            pendingBalance: 0
          };
        }

        // ------------------------------
        // Save Current User
        // ------------------------------

        setCurrentUser({
          id: firebaseUser.uid,
          name:
            profile.name ||
            firebaseUser.displayName ||
            email.split("@")[0],
          email:
            firebaseUser.email || email,
          role:
            profile.role || "worker",
          skills:
            profile.skills || "",
          balance:
            Number(profile.balance || 0),
          pendingBalance:
            Number(profile.pendingBalance || 0)
        });

        alert("Login সফল হয়েছে!");

        window.location.href = "index.html";

      } catch (error) {

        console.error("LOGIN ERROR:", error);

        let message = "";

        switch (error.code) {

          case "auth/user-not-found":
            message =
              "এই Email দিয়ে কোনো Account পাওয়া যায়নি।";
            break;

          case "auth/wrong-password":
            message =
              "Password ভুল হয়েছে।";
            break;

          case "auth/invalid-credential":
            message =
              "Email অথবা Password সঠিক নয়।";
            break;

          case "auth/invalid-email":
            message =
              "Email address সঠিক নয়।";
            break;

          case "auth/user-disabled":
            message =
              "এই Account বন্ধ করে দেওয়া হয়েছে।";
            break;

          case "auth/too-many-requests":
            message =
              "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
            break;

          case "auth/network-request-failed":
            message =
              "Internet connection সমস্যা হয়েছে।";
            break;

          case "auth/invalid-api-key":
          case "auth/api-key-not-valid":
            message =
              "Firebase API key invalid।\n\n" +
              "Error code: " +
              error.code;
            break;

          case "auth/operation-not-allowed":
            message =
              "Firebase Email/Password Login চালু নেই।";
            break;

          default:
            message =
              "Login Error\n\n" +
              "Code: " +
              (error.code || "unknown") +
              "\n\n" +
              "Message: " +
              (error.message || "Unknown error");
        }

        alert(message);
      }
    });
  }

  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  const forgotPassword =
    document.getElementById("forgot-password");

  if (forgotPassword) {

    forgotPassword.addEventListener("click", async (e) => {

      e.preventDefault();

      if (!firebaseReady()) return;

      const emailInput =
        document.getElementById("email");

      const email =
        emailInput?.value.trim();

      if (!email) {

        alert(
          "আগে Email লিখুন।\n\n" +
          "তারপর Forgot Password চাপুন।"
        );

        emailInput?.focus();

        return;
      }

      try {

        await auth.sendPasswordResetEmail(email);

        alert(
          "Password reset link আপনার Email-এ পাঠানো হয়েছে।\n\n" +
          "Inbox এবং Spam/Junk folder দুটোই দেখুন।"
        );

      } catch (error) {

        console.error(
          "FORGOT PASSWORD ERROR:",
          error
        );

        let message = "";

        switch (error.code) {

          case "auth/user-not-found":
            message =
              "এই Email দিয়ে কোনো Account পাওয়া যায়নি।";
            break;

          case "auth/invalid-email":
            message =
              "Email address সঠিক নয়।";
            break;

          case "auth/too-many-requests":
            message =
              "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
            break;

          case "auth/invalid-api-key":
          case "auth/api-key-not-valid":
            message =
              "Firebase API key invalid।\n\n" +
              "Code: " +
              error.code;
            break;

          case "auth/network-request-failed":
            message =
              "Internet connection সমস্যা হয়েছে।";
            break;

          default:
            message =
              "Forgot Password Error\n\n" +
              "Code: " +
              (error.code || "unknown") +
              "\n\n" +
              "Message: " +
              (error.message || "Unknown error");
        }

        alert(message);
      }
    });
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  const logoutBtn =
    document.getElementById("logout-btn");

  if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

      try {

        if (auth) {
          await auth.signOut();
        }

        clearCurrentUser();

        alert("Logout হয়েছে।");

        window.location.href = "index.html";

      } catch (error) {

        console.error(
          "LOGOUT ERROR:",
          error
        );

        alert(
          "Logout Error:\n\n" +
          (error.code || error.message)
        );
      }
    });
  }

  // ==========================================
  // Firebase Auth State
  // ==========================================

  if (auth) {

    auth.onAuthStateChanged((firebaseUser) => {

      console.log(
        "Firebase Auth State:",
        firebaseUser
          ? firebaseUser.email
          : "Logged out"
      );

    });
  }

  // ==========================================
  // HOME / JOB SEARCH
  // ==========================================

  const jobsContainer =
    document.getElementById("jobs-container");

  if (jobsContainer) {

    const jobs = getJobs();

    if (jobs.length === 0) {

      jobsContainer.innerHTML =
        "<p>এখনও কোনো Job পোস্ট করা হয়নি।</p>";

    } else {

      jobsContainer.innerHTML =
        jobs.map((job) => {

          return `
            <div class="job-card">

              <h3>${escapeHTML(job.title)}</h3>

              <p>
                ${escapeHTML(job.description || "")}
              </p>

              <p>
                <strong>Budget:</strong>
                ${escapeHTML(job.budget || "N/A")}
              </p>

              <a href="job-details.html?id=${encodeURIComponent(job.id)}">
                View Job
              </a>

            </div>
          `;

        }).join("");
    }
  }

  // ==========================================
  // POST JOB
  // ==========================================

  const postJobForm =
    document.getElementById("post-job-form");

  if (postJobForm) {

    if (!requireLogin()) return;

    const currentUser =
      getCurrentUser();

    if (
      currentUser &&
      currentUser.role !== "client"
    ) {

      alert(
        "শুধু Client Job পোস্ট করতে পারবেন।"
      );

      window.location.href =
        "index.html";

      return;
    }

    postJobForm.addEventListener(
      "submit",
      (e) => {

        e.preventDefault();

        const title =
          document.getElementById("title")?.value.trim();

        const description =
          document.getElementById("description")?.value.trim();

        const budget =
          document.getElementById("budget")?.value.trim();

        if (!title || !description || !budget) {

          alert(
            "সব তথ্য পূরণ করুন।"
          );

          return;
        }

        const jobs =
          getJobs();

        const job = {

          id:
            Date.now().toString(),

          title:
            title,

          description:
            description,

          budget:
            budget,

          clientId:
            currentUser.id,

          clientName:
            currentUser.name,

          createdAt:
            new Date().toISOString()
        };

        jobs.push(job);

        saveJobs(jobs);

        alert(
          "Job সফলভাবে পোস্ট হয়েছে!"
        );

        window.location.href =
          "index.html";
      }
    );
  }

  // ==========================================
  // JOB DETAILS / BID
  // ==========================================

  const bidForm =
    document.getElementById("bid-form");

  if (bidForm) {

    if (!requireLogin()) return;

    const currentUser =
      getCurrentUser();

    if (
      currentUser &&
      currentUser.role !== "worker"
    ) {

      alert(
        "শুধু Worker Job-এ Bid করতে পারবেন।"
      );

      window.location.href =
        "index.html";

      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const jobId =
      params.get("id");

    const jobs =
      getJobs();

    const job =
      jobs.find(
        (item) =>
          String(item.id) === String(jobId)
      );

    if (!job) {

      alert("Job পাওয়া যায়নি।");

      window.location.href =
        "index.html";

      return;
    }

    if (
      String(job.clientId) ===
      String(currentUser.id)
    ) {

      alert(
        "নিজের Job-এ Bid করা যাবে না।"
      );

      window.location.href =
        "index.html";

      return;
    }

    const jobTitle =
      document.getElementById("job-title");

    const jobDescription =
      document.getElementById("job-description");

    const jobBudget =
      document.getElementById("job-budget");

    if (jobTitle) {
      jobTitle.textContent =
        job.title;
    }

    if (jobDescription) {
      jobDescription.textContent =
        job.description;
    }

    if (jobBudget) {
      jobBudget.textContent =
        job.budget;
    }

    bidForm.addEventListener(
      "submit",
      (e) => {

        e.preventDefault();

        const amount =
          document.getElementById("bid-amount")
            ?.value.trim();

        const message =
          document.getElementById("bid-message")
            ?.value.trim();

        if (!amount) {

          alert(
            "Bid amount দিন।"
          );

          return;
        }

        const bids =
          getBids();

        const alreadyBid =
          bids.some(
            (bid) =>
              String(bid.jobId) ===
                String(jobId) &&
              String(bid.workerId) ===
                String(currentUser.id)
          );

        if (alreadyBid) {

          alert(
            "আপনি এই Job-এ ইতিমধ্যে Bid করেছেন।"
          );

          return;
        }

        bids.push({

          id:
            Date.now().toString(),

          jobId:
            job.id,

          workerId:
            currentUser.id,

          workerName:
            currentUser.name,

          amount:
            amount,

          message:
            message,

          createdAt:
            new Date().toISOString()
        });

        saveBids(bids);

        alert(
          "আপনার Bid সফলভাবে জমা হয়েছে!"
        );

        window.location.href =
          "index.html";
      }
    );
  }

  // ==========================================
  // PROFILE
  // ==========================================

  const profileName =
    document.getElementById("profile-name");

  const profileEmail =
    document.getElementById("profile-email");

  const profileRole =
    document.getElementById("profile-role");

  const profileSkills =
    document.getElementById("profile-skills");

  if (
    profileName ||
    profileEmail ||
    profileRole ||
    profileSkills
  ) {

    if (!requireLogin()) return;

    const currentUser =
      getCurrentUser();

    if (profileName) {
      profileName.textContent =
        currentUser.name || "";
    }

    if (profileEmail) {
      profileEmail.textContent =
        currentUser.email || "";
    }

    if (profileRole) {
      profileRole.textContent =
        currentUser.role || "";
    }

    if (profileSkills) {
      profileSkills.textContent =
        currentUser.skills || "N/A";
    }
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  const dashboard =
    document.getElementById("dashboard");

  if (dashboard) {

    if (!requireLogin()) return;

    const currentUser =
      getCurrentUser();

    const jobs =
      getJobs();

    const bids =
      getBids();

    // Client jobs
    const myJobs =
      jobs.filter(
        (job) =>
          String(job.clientId) ===
          String(currentUser.id)
      );

    // Worker bids
    const myBids =
      bids.filter(
        (bid) =>
          String(bid.workerId) ===
          String(currentUser.id)
      );

    const myJobsContainer =
      document.getElementById(
        "my-jobs"
      );

    const myBidsContainer =
      document.getElementById(
        "my-bids"
      );

    if (myJobsContainer) {

      if (myJobs.length === 0) {

        myJobsContainer.innerHTML =
          "<p>আপনার কোনো Job নেই।</p>";

      } else {

        myJobsContainer.innerHTML =
          myJobs.map(
            (job) => `
              <div class="job-card">
                <h3>
                  ${escapeHTML(job.title)}
                </h3>

                <p>
                  ${escapeHTML(job.description)}
                </p>

                <p>
                  Budget:
                  ${escapeHTML(job.budget)}
                </p>
              </div>
            `
          ).join("");
      }
    }

    if (myBidsContainer) {

      if (myBids.length === 0) {

        myBidsContainer.innerHTML =
          "<p>আপনার কোনো Bid নেই।</p>";

      } else {

        myBidsContainer.innerHTML =
          myBids.map(
            (bid) => {

              const job =
                jobs.find(
                  (item) =>
                    String(item.id) ===
                    String(bid.jobId)
                );

              return `
                <div class="job-card">

                  <h3>
                    ${escapeHTML(
                      job?.title ||
                      "Job"
                    )}
                  </h3>

                  <p>
                    Bid:
                    ${escapeHTML(
                      bid.amount
                    )}
                  </p>

                  <p>
                    ${escapeHTML(
                      bid.message || ""
                    )}
                  </p>

                </div>
              `;
            }
          ).join("");
      }
    }
  }

  // ==========================================
  // HIDE CLIENT-ONLY LINKS FOR WORKERS
  // ==========================================

  const currentUser =
    getCurrentUser();

  if (
    currentUser &&
    currentUser.role !== "client"
  ) {

    document
      .querySelectorAll(
        'a[href="post-job.html"]'
      )
      .forEach((link) => {

        link.style.display =
          "none";
      });
  }

});
