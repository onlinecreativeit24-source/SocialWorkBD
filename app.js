
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  // ==========================================
  // SocialWorkBD
  // Firebase Authentication + Firestore
  // ==========================================

  // ------------------------------------------
  // Local Storage Helpers
  // ------------------------------------------

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
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  }

  function setCurrentUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  function clearCurrentUser() {
    localStorage.removeItem("currentUser");
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  function requireLogin() {
    if (!isLoggedIn()) {
      alert("এই কাজটি করতে আগে লগইন করুন।");
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

  // ------------------------------------------
  // Firebase Check
  // ------------------------------------------

  if (typeof firebase === "undefined") {
    console.error("Firebase SDK পাওয়া যায়নি।");
  }

  // ------------------------------------------
  // SIGNUP
  // ------------------------------------------

  if (path.includes("signup.html")) {
    const form = document.getElementById("signup-form");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById("name");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const confirmPasswordInput =
          document.getElementById("confirm-password");

        const roleInput = document.getElementById("role");
        const skillsInput = document.getElementById("skills");

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";
        const confirmPassword = confirmPasswordInput
          ? confirmPasswordInput.value
          : password;

        const role = roleInput ? roleInput.value : "worker";
        const skills = skillsInput ? skillsInput.value.trim() : "";

        if (!name || !email || !password) {
          alert("সব প্রয়োজনীয় তথ্য পূরণ করুন।");
          return;
        }

        if (password !== confirmPassword) {
          alert("পাসওয়ার্ড দুটি একই নয়।");
          return;
        }

        if (password.length < 6) {
          alert("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
          return;
        }

        if (role === "worker" && !skills) {
          alert("Worker হলে আপনার Skills লিখুন।");
          return;
        }

        try {
          const userCredential =
            await auth.createUserWithEmailAndPassword(
              email,
              password
            );

          const firebaseUser = userCredential.user;

          // Firebase profile name
          await firebaseUser.updateProfile({
            displayName: name
          });

          // Firestore user profile
          await db
            .collection("users")
            .doc(firebaseUser.uid)
            .set({
              uid: firebaseUser.uid,
              name: name,
              email: email,
              role: role,
              skills: skills,
              balance: 0,
              pendingBalance: 0,
              createdAt:
                firebase.firestore.FieldValue.serverTimestamp()
            });

          const userData = {
            id: firebaseUser.uid,
            name: name,
            email: email,
            role: role,
            skills: skills,
            balance: 0,
            pendingBalance: 0
          };

          setCurrentUser(userData);

          alert("অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!");

          window.location.href = "index.html";

        } catch (error) {
          console.error("Signup Error:", error);

          switch (error.code) {
            case "auth/email-already-in-use":
              alert("এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।");
              break;

            case "auth/invalid-email":
              alert("ইমেইল ঠিক নয়।");
              break;

            case "auth/weak-password":
              alert("পাসওয়ার্ড আরও শক্তিশালী দিন।");
              break;

            case "auth/operation-not-allowed":
              alert("Firebase Email/Password Authentication চালু নেই।");
              break;

            default:
              alert(
                "Signup করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।\n\n" +
                error.message
              );
          }
        }
      });
    }
  }

  // ------------------------------------------
  // LOGIN
  // ------------------------------------------

  if (path.includes("login.html")) {
    const form = document.getElementById("login-form");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        const email = emailInput
          ? emailInput.value.trim()
          : "";

        const password = passwordInput
          ? passwordInput.value
          : "";

        if (!email || !password) {
          alert("ইমেইল ও পাসওয়ার্ড দিন।");
          return;
        }

        try {
          const userCredential =
            await auth.signInWithEmailAndPassword(
              email,
              password
            );

          const firebaseUser = userCredential.user;

          let userData = null;

          // Firestore profile
          try {
            const doc = await db
              .collection("users")
              .doc(firebaseUser.uid)
              .get();

            if (doc.exists) {
              const data = doc.data();

              userData = {
                id: firebaseUser.uid,
                name:
                  data.name ||
                  firebaseUser.displayName ||
                  "User",
                email:
                  data.email ||
                  firebaseUser.email ||
                  "",
                role: data.role || "worker",
                skills: data.skills || "",
                balance: Number(data.balance || 0),
                pendingBalance: Number(
                  data.pendingBalance || 0
                )
              };
            }
          } catch (firestoreError) {
            console.warn(
              "Firestore profile পাওয়া যায়নি:",
              firestoreError
            );
          }

          // Fallback profile
          if (!userData) {
            userData = {
              id: firebaseUser.uid,
              name:
                firebaseUser.displayName ||
                "User",
              email:
                firebaseUser.email ||
                email,
              role: "worker",
              skills: "",
              balance: 0,
              pendingBalance: 0
            };
          }

          setCurrentUser(userData);

          alert("লগইন সফল হয়েছে!");

          window.location.href = "index.html";

        } catch (error) {
          console.error("Login Error:", error);

          switch (error.code) {
            case "auth/user-not-found":
              alert("এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।");
              break;

            case "auth/wrong-password":
              alert("পাসওয়ার্ড ভুল।");
              break;

            case "auth/invalid-credential":
              alert("ইমেইল অথবা পাসওয়ার্ড ভুল।");
              break;

            case "auth/invalid-email":
              alert("ইমেইল ঠিক নয়।");
              break;

            case "auth/too-many-requests":
              alert(
                "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
              );
              break;

            default:
              alert(
                "লগইন করতে সমস্যা হয়েছে।\n\n" +
                error.message
              );
          }
        }
      });
    }

    // ----------------------------------------
    // FORGOT PASSWORD
    // ----------------------------------------

    const forgotPassword =
      document.getElementById("forgot-password");

    if (forgotPassword) {
      forgotPassword.addEventListener("click", async (e) => {
        e.preventDefault();

        const emailInput =
          document.getElementById("email");

        const email = emailInput
          ? emailInput.value.trim()
          : "";

        if (!email) {
          alert(
            "প্রথমে আপনার ইমেইল লিখুন। তারপর 'পাসওয়ার্ড ভুলে গেছেন?' চাপুন।"
          );

          if (emailInput) {
            emailInput.focus();
          }

          return;
        }

        try {
          await auth.sendPasswordResetEmail(email);

          alert(
            "Password reset link আপনার ইমেইলে পাঠানো হয়েছে।\n\n" +
            "Inbox না পেলে Spam/Junk folder-ও দেখুন।"
          );

        } catch (error) {
          console.error(
            "Password Reset Error:",
            error
          );

          switch (error.code) {
            case "auth/user-not-found":
              alert(
                "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।"
              );
              break;

            case "auth/invalid-email":
              alert("ইমেইল ঠিক নয়।");
              break;

            case "auth/too-many-requests":
              alert(
                "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
              );
              break;

            default:
              alert(
                "Password reset করতে সমস্যা হয়েছে।\n\n" +
                error.message
              );
          }
        }
      });
    }
  }

  // ------------------------------------------
  // LOGOUT
  // ------------------------------------------

  const logoutBtn =
    document.getElementById("logout-btn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        await auth.signOut();

        clearCurrentUser();

        window.location.href = "index.html";

      } catch (error) {
        console.error("Logout Error:", error);
        alert("Logout করতে সমস্যা হয়েছে।");
      }
    });
  }

  // ------------------------------------------
  // FIREBASE AUTH STATE
  // ------------------------------------------

  if (
    typeof auth !== "undefined" &&
    auth &&
    typeof auth.onAuthStateChanged === "function"
  ) {
    auth.onAuthStateChanged(async (firebaseUser) => {

      if (!firebaseUser) {
        return;
      }

      // Login/signup already stores current user.
      // This keeps Firebase session connected.
      console.log(
        "Firebase user:",
        firebaseUser.email
      );
    });
  }

  // ------------------------------------------
  // HOME PAGE
  // ------------------------------------------

  if (
    path.endsWith("/") ||
    path.includes("index.html") ||
    path === ""
  ) {
    const jobs = getJobs();

    const jobsContainer =
      document.getElementById("jobs-list");

    if (jobsContainer) {

      if (jobs.length === 0) {
        jobsContainer.innerHTML =
          "<p>এখনও কোনো Job পোস্ট করা হয়নি।</p>";
      } else {

        jobsContainer.innerHTML = jobs
          .map((job) => {

            return `
              <div class="job-card">

                <h3>${escapeHTML(job.title)}</h3>

                <p>
                  ${escapeHTML(job.description)}
                </p>

                <p>
                  <strong>Budget:</strong>
                  ৳${escapeHTML(job.budget)}
                </p>

                <p>
                  <strong>Category:</strong>
                  ${escapeHTML(job.category || "General")}
                </p>

                <a href="job.html?id=${encodeURIComponent(job.id)}">
                  Job Details
                </a>

              </div>
            `;
          })
          .join("");
      }
    }
  }

  // ------------------------------------------
  // POST JOB
  // ------------------------------------------

  if (path.includes("post-job.html")) {

    if (!requireLogin()) {
      return;
    }

    const user = getCurrentUser();

    if (!user || user.role !== "client") {
      alert(
        "শুধুমাত্র Client Job পোস্ট করতে পারবেন।"
      );

      window.location.href = "index.html";
      return;
    }

    const form =
      document.getElementById("job-form");

    if (form) {

      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const title =
          document.getElementById("title")?.value.trim();

        const description =
          document
            .getElementById("description")
            ?.value.trim();

        const budget =
          document
            .getElementById("budget")
            ?.value.trim();

        const category =
          document
            .getElementById("category")
            ?.value.trim();

        if (!title || !description || !budget) {
          alert("সব প্রয়োজনীয় তথ্য পূরণ করুন।");
          return;
        }

        const jobs = getJobs();

        const newJob = {
          id:
            Date.now().toString(),
          title: title,
          description: description,
          budget: budget,
          category: category || "General",
          clientId: user.id,
          clientName: user.name,
          createdAt:
            new Date().toISOString()
        };

        jobs.unshift(newJob);

        saveJobs(jobs);

        alert("Job সফলভাবে পোস্ট হয়েছে!");

        window.location.href = "index.html";
      });
    }
  }

  // ------------------------------------------
  // JOB DETAILS + BID
  // ------------------------------------------

  if (path.includes("job.html")) {

    const params =
      new URLSearchParams(window.location.search);

    const jobId = params.get("id");

    const jobs = getJobs();

    const job =
      jobs.find((item) => item.id === jobId);

    const jobContainer =
      document.getElementById("job-details");

    if (!job) {

      if (jobContainer) {
        jobContainer.innerHTML =
          "<p>Job পাওয়া যায়নি।</p>";
      }

    } else {

      if (jobContainer) {

        jobContainer.innerHTML = `
          <div class="job-card">

            <h2>
              ${escapeHTML(job.title)}
            </h2>

            <p>
              ${escapeHTML(job.description)}
            </p>

            <p>
              <strong>Budget:</strong>
              ৳${escapeHTML(job.budget)}
            </p>

            <p>
              <strong>Category:</strong>
              ${escapeHTML(job.category)}
            </p>

            <p>
              <strong>Client:</strong>
              ${escapeHTML(job.clientName)}
            </p>

          </div>
        `;
      }

      const bidForm =
        document.getElementById("bid-form");

      if (bidForm) {

        bidForm.addEventListener("submit", (e) => {
          e.preventDefault();

          if (!requireLogin()) {
            return;
          }

          const user = getCurrentUser();

          if (user.role !== "worker") {
            alert(
              "শুধুমাত্র Worker Job-এ Bid করতে পারবেন।"
            );
            return;
          }

          if (job.clientId === user.id) {
            alert(
              "নিজের Job-এ Bid করা যাবে না।"
            );
            return;
          }

          const amount =
            document
              .getElementById("bid-amount")
              ?.value.trim();

          const message =
            document
              .getElementById("bid-message")
              ?.value.trim();

          if (!amount) {
            alert("Bid amount দিন।");
            return;
          }

          const bids = getBids();

          const existingBid =
            bids.find(
              (bid) =>
                bid.jobId === job.id &&
                bid.workerId === user.id
            );

          if (existingBid) {
            alert(
              "আপনি এই Job-এ ইতিমধ্যে Bid করেছেন।"
            );
            return;
          }

          const newBid = {
            id:
              Date.now().toString(),
            jobId: job.id,
            jobTitle: job.title,
            workerId: user.id,
            workerName: user.name,
            amount: amount,
            message: message || "",
            createdAt:
              new Date().toISOString()
          };

          bids.push(newBid);

          saveBids(bids);

          alert("আপনার Bid সফলভাবে জমা হয়েছে!");

          bidForm.reset();
        });
      }
    }
  }

  // ------------------------------------------
  // PROFILE PAGE
  // ------------------------------------------

  if (path.includes("profile.html")) {

    if (!requireLogin()) {
      return;
    }

    const user = getCurrentUser();

    const profileContainer =
      document.getElementById("profile");

    if (profileContainer && user) {

      profileContainer.innerHTML = `
        <div class="profile-card">

          <h2>
            ${escapeHTML(user.name)}
          </h2>

          <p>
            <strong>Email:</strong>
            ${escapeHTML(user.email)}
          </p>

          <p>
            <strong>Role:</strong>
            ${escapeHTML(user.role)}
          </p>

          <p>
            <strong>Skills:</strong>
            ${escapeHTML(user.skills || "Not added")}
          </p>

          <p>
            <strong>Balance:</strong>
            ৳${Number(user.balance || 0).toFixed(2)}
          </p>

          <p>
            <strong>Pending Balance:</strong>
            ৳${Number(
              user.pendingBalance || 0
            ).toFixed(2)}
          </p>

        </div>
      `;
    }
  }

  // ------------------------------------------
  // DASHBOARD
  // ------------------------------------------

  if (path.includes("dashboard.html")) {

    if (!requireLogin()) {
      return;
    }

    const user = getCurrentUser();

    const jobs = getJobs();
    const bids = getBids();

    const myJobs =
      jobs.filter(
        (job) =>
          job.clientId === user.id
      );

    const myBids =
      bids.filter(
        (bid) =>
          bid.workerId === user.id
      );

    const myJobsContainer =
      document.getElementById("my-jobs");

    const myBidsContainer =
      document.getElementById("my-bids");

    // My Jobs
    if (myJobsContainer) {

      if (myJobs.length === 0) {

        myJobsContainer.innerHTML =
          "<p>আপনার কোনো Job নেই।</p>";

      } else {

        myJobsContainer.innerHTML =
          myJobs
            .map(
              (job) => `
                <div class="job-card">

                  <h3>
                    ${escapeHTML(job.title)}
                  </h3>

                  <p>
                    Budget: ৳${escapeHTML(job.budget)}
                  </p>

                  <a href="job.html?id=${encodeURIComponent(job.id)}">
                    View Job
                  </a>

                </div>
              `
            )
            .join("");
      }
    }

    // My Bids
    if (myBidsContainer) {

      if (myBids.length === 0) {

        myBidsContainer.innerHTML =
          "<p>আপনার কোনো Bid নেই।</p>";

      } else {

        myBidsContainer.innerHTML =
          myBids
            .map(
              (bid) => `
                <div class="job-card">

                  <h3>
                    ${escapeHTML(bid.jobTitle)}
                  </h3>

                  <p>
                    Bid Amount:
                    ৳${escapeHTML(bid.amount)}
                  </p>

                  <p>
                    ${escapeHTML(bid.message)}
                  </p>

                </div>
              `
            )
            .join("");
      }
    }
  }

  // ------------------------------------------
  // HIDE POST JOB FOR NON-CLIENT
  // ------------------------------------------

  const currentUser = getCurrentUser();

  const postJobLinks =
    document.querySelectorAll(
      'a[href="post-job.html"]'
    );

  if (postJobLinks.length > 0) {

    if (
      !currentUser ||
      currentUser.role !== "client"
    ) {

      postJobLinks.forEach((link) => {
        link.style.display = "none";
      });
    }
  }

});
