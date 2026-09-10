document.addEventListener("DOMContentLoaded", () => {

  // =========================================================
  // SOCIALWORKBD — PROFESSIONAL FREELANCE MARKETPLACE
  // =========================================================

  const path = window.location.pathname;

  // =========================================================
  // HELPERS
  // =========================================================

  function getFirebase() {
    if (typeof firebase === "undefined") {
      console.error("Firebase SDK is not loaded.");
      return null;
    }

    return firebase;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function saveCurrentUser(userData) {
    localStorage.setItem(
      "currentUser",
      JSON.stringify(userData)
    );
  }

  function getCurrentUserLocal() {
    try {
      return JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );
    } catch {
      return {};
    }
  }

  function getRoleName(role) {
    if (role === "worker" || role === "freelancer") {
      return "freelancer";
    }

    if (role === "client") {
      return "client";
    }

    return role || "";
  }

  function formatBudget(budget) {
    const amount = Number(budget);

    if (!Number.isFinite(amount)) {
      return "Budget not specified";
    }

    return `৳${amount.toLocaleString("en-BD")}`;
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return "Recently posted";
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
    } catch {
      return "Recently posted";
    }
  }

  async function getUserProfile(uid) {
    const fb = getFirebase();

    if (!fb || !uid) {
      return null;
    }

    const doc = await fb.firestore()
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

  async function requireLogin() {
    const fb = getFirebase();

    if (!fb) {
      return null;
    }

    const user = fb.auth().currentUser;

    if (!user) {
      alert("Please log in to continue.");
      window.location.href = "login.html";
      return null;
    }

    return user;
  }

  // =========================================================
  // SIGNUP
  // =========================================================

  if (path.includes("signup.html")) {

    const form = document.getElementById("signup-form");

    if (form) {

      form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const fb = getFirebase();

        if (!fb) {
          alert("Firebase is not available.");
          return;
        }

        const name =
          document.getElementById("name")?.value.trim() || "";

        const email =
          document.getElementById("email")?.value.trim() || "";

        const password =
          document.getElementById("password")?.value || "";

        const confirmPassword =
          document.getElementById("confirm-password")?.value || "";

        const roleValue =
          document.getElementById("role")?.value || "worker";

        const skills =
          document.getElementById("skills")?.value.trim() || "";

        if (!name) {
          alert("Please enter your name.");
          return;
        }

        if (!email) {
          alert("Please enter your email.");
          return;
        }

        if (password.length < 6) {
          alert("Password must be at least 6 characters.");
          return;
        }

        if (password !== confirmPassword) {
          alert("Passwords do not match.");
          return;
        }

        const role =
          roleValue === "freelancer"
            ? "worker"
            : roleValue;

        try {

          const userCredential =
            await fb.auth()
              .createUserWithEmailAndPassword(
                email,
                password
              );

          const user = userCredential.user;

          const prefix =
            role === "worker"
              ? "SWB-F-"
              : "SWB-C-";

          const accountId =
            prefix +
            user.uid
              .substring(0, 8)
              .toUpperCase();

          const profileData = {
            uid: user.uid,
            accountId: accountId,
            name: name,
            email: email,
            role: role,
            skills: skills,

            title: "",
            bio: "",
            location: "",
            photoURL: "",

            balance: 0,
            pendingBalance: 0,

            createdAt:
              fb.firestore.FieldValue.serverTimestamp(),

            updatedAt:
              fb.firestore.FieldValue.serverTimestamp()
          };

          await fb.firestore()
            .collection("users")
            .doc(user.uid)
            .set(profileData);

          saveCurrentUser({
            uid: user.uid,
            accountId: accountId,
            name: name,
            email: email,
            role: role,
            skills: skills,
            title: "",
            bio: "",
            location: ""
          });

          await fb.auth().signOut();

          alert(
            "Account created successfully!\n\n" +
            "Your Account ID: " +
            accountId
          );

          window.location.href = "login.html";

        } catch (error) {

          console.error("Signup Error:", error);

          let message = "Unable to create your account.";

          switch (error.code) {

            case "auth/email-already-in-use":
              message =
                "An account already exists with this email.";
              break;

            case "auth/invalid-email":
              message =
                "Please enter a valid email address.";
              break;

            case "auth/weak-password":
              message =
                "Password is too weak. Use at least 6 characters.";
              break;

            case "auth/operation-not-allowed":
              message =
                "Email/password signup is not enabled in Firebase.";
              break;

            default:
              message = error.message || message;
          }

          alert("Signup Error: " + message);
        }
      });
    }
  }


  // =========================================================
  // LOGIN
  // =========================================================

  const loginForm =
    document.getElementById("login-form");

  if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

      e.preventDefault();

      const fb = getFirebase();

      if (!fb) {
        alert("Firebase is not available.");
        return;
      }

      const email =
        document.getElementById("email")?.value.trim() || "";

      const password =
        document.getElementById("password")?.value || "";

      if (!email || !password) {
        alert("Please enter your email and password.");
        return;
      }

      try {

        const result =
          await fb.auth()
            .signInWithEmailAndPassword(
              email,
              password
            );

        const user = result.user;

        const userData =
          await getUserProfile(user.uid);

        if (!userData) {

          alert(
            "Your account profile could not be found."
          );

          await fb.auth().signOut();

          return;
        }

        saveCurrentUser(userData);

        alert("Login successful!");

        const role =
          getRoleName(userData.role);

        if (role === "client") {
          window.location.href =
            "client-dashboard.html";
        } else if (role === "freelancer") {
          window.location.href =
            "worker-dashboard.html";
        } else {
          window.location.href =
            "profile.html";
        }

      } catch (error) {

        console.error("Login Error:", error);

        let message =
          "Unable to log in.";

        switch (error.code) {

          case "auth/invalid-credential":
            message =
              "Incorrect email or password.";
            break;

          case "auth/user-not-found":
            message =
              "No account was found with this email.";
            break;

          case "auth/wrong-password":
            message =
              "Incorrect password.";
            break;

          case "auth/invalid-email":
            message =
              "Please enter a valid email address.";
            break;

          case "auth/user-disabled":
            message =
              "This account has been disabled.";
            break;

          default:
            message =
              error.message || message;
        }

        alert("Login Error: " + message);
      }
    });
  }


  // =========================================================
  // HOME — LOAD FIRESTORE JOBS
  // =========================================================

  if (
    path.includes("index.html") ||
    path === "/" ||
    path.endsWith("/")
  ) {

    const fb = getFirebase();

    const jobList =
      document.getElementById("job-list");

    const searchInput =
      document.getElementById("job-search");

    const searchForm =
      document.getElementById("job-search-form");

    let allJobs = [];

    async function loadHomeJobs() {

      if (!jobList || !fb) {
        return;
      }

      try {

        const snapshot =
          await fb.firestore()
            .collection("jobs")
            .where("status", "==", "open")
            .limit(20)
            .get();

        allJobs = [];

        snapshot.forEach((doc) => {

          allJobs.push({
            id: doc.id,
            ...doc.data()
          });

        });

        allJobs.sort((a, b) => {

          const aTime =
            a.createdAt?.toMillis
              ? a.createdAt.toMillis()
              : 0;

          const bTime =
            b.createdAt?.toMillis
              ? b.createdAt.toMillis()
              : 0;

          return bTime - aTime;
        });

        renderHomeJobs("");

      } catch (error) {

        console.error(
          "Load Jobs Error:",
          error
        );

        jobList.innerHTML = `
          <div class="empty-jobs">
            <div class="empty-jobs-icon">!</div>
            <h3>Unable to load jobs</h3>
            <p>Please try again later.</p>
          </div>
        `;
      }
    }

    function renderHomeJobs(filterText = "") {

      if (!jobList) {
        return;
      }

      const search =
        filterText.trim().toLowerCase();

      const filteredJobs =
        allJobs.filter((job) => {

          const searchableText = [
            job.title || "",
            job.description || "",
            job.skills || "",
            job.category || ""
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(search);
        });

      if (filteredJobs.length === 0) {

        jobList.innerHTML = `
          <div class="empty-jobs">
            <div class="empty-jobs-icon">🔎</div>
            <h3>No matching jobs found</h3>
            <p>Try another keyword or browse all jobs.</p>
            <a href="tasks.html">Browse Jobs</a>
          </div>
        `;

        return;
      }

      jobList.innerHTML =
        filteredJobs
          .slice(0, 8)
          .map((job) => {

            const title =
              escapeHtml(job.title || "Untitled Project");

            const description =
              escapeHtml(
                job.description ||
                "No project description provided."
              );

            const skills =
              escapeHtml(job.skills || "Skills not specified");

            const budget =
              formatBudget(job.budget);

            const date =
              formatDate(job.createdAt);

            return `
              <article class="marketplace-job-card">

                <div class="job-card-content">

                  <div class="job-card-header">
                    <span class="job-status">Open</span>
                    <span class="job-date">
                      ${escapeHtml(date)}
                    </span>
                  </div>

                  <h3>${title}</h3>

                  <p>
                    ${description}
                  </p>

                  <div class="job-card-meta">

                    <span>
                      <strong>Budget</strong>
                      ${escapeHtml(budget)}
                    </span>

                    <span>
                      <strong>Skills</strong>
                      ${skills}
                    </span>

                  </div>

                </div>

                <a
                  href="job-details.html?id=${encodeURIComponent(job.id)}"
                  class="job-card-button"
                >
                  View Job
                </a>

              </article>
            `;
          })
          .join("");
    }

    searchInput?.addEventListener(
      "input",
      (e) => {
        renderHomeJobs(e.target.value);
      }
    );

    searchForm?.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();

        const value =
          searchInput?.value.trim() || "";

        renderHomeJobs(value);

        document
          .getElementById("jobs-section")
          ?.scrollIntoView({
            behavior: "smooth"
          });
      }
    );

    loadHomeJobs();
  }


  // =========================================================
  // POST JOB
  // =========================================================

  if (path.includes("post-job.html")) {

    const form =
      document.getElementById("job-form");

    if (form) {

      form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const fb = getFirebase();

        if (!fb) {
          alert("Firebase is not available.");
          return;
        }

        const user =
          await requireLogin();

        if (!user) {
          return;
        }

        try {

          const userData =
            await getUserProfile(user.uid);

          if (!userData) {
            alert(
              "Your user profile could not be found."
            );
            return;
          }

          if (
            getRoleName(userData.role) !==
            "client"
          ) {

            alert(
              "Only clients can post jobs."
            );

            return;
          }

          const title =
            document
              .getElementById("title")
              ?.value.trim() || "";

          const description =
            document
              .getElementById("desc")
              ?.value.trim() || "";

          const budget =
            Number(
              document
                .getElementById("budget")
                ?.value || 0
            );

          const skills =
            document
              .getElementById("skills")
              ?.value.trim() || "";

          const deliveryDays =
            Number(
              document
                .getElementById("delivery-days")
                ?.value || 0
            );

          if (!title) {
            alert("Please enter a job title.");
            return;
          }

          if (!description) {
            alert(
              "Please describe what you need."
            );
            return;
          }

          if (
            !Number.isFinite(budget) ||
            budget <= 0
          ) {
            alert(
              "Please enter a valid project budget."
            );
            return;
          }

          if (!skills) {
            alert(
              "Please enter the required skills."
            );
            return;
          }

          const jobData = {

            title: title,

            description: description,

            budget: budget,

            skills: skills,

            deliveryDays:
              deliveryDays > 0
                ? deliveryDays
                : null,

            category: "",

            clientId: user.uid,

            clientName:
              userData.name || "",

            clientAccountId:
              userData.accountId || "",

            status: "open",

            proposalCount: 0,

            hiredFreelancerId: null,

            createdAt:
              fb.firestore.FieldValue
                .serverTimestamp(),

            updatedAt:
              fb.firestore.FieldValue
                .serverTimestamp()
          };

          const jobRef =
            await fb.firestore()
              .collection("jobs")
              .add(jobData);

          console.log(
            "Job created:",
            jobRef.id
          );

          alert(
            "Your job has been posted successfully!"
          );

          form.reset();

          window.location.href =
            "client-dashboard.html";

        } catch (error) {

          console.error(
            "Post Job Error:",
            error
          );

          alert(
            "Unable to post the job.\n\n" +
            (error.message || "Please try again.")
          );
        }
      });
    }
  }


  // =========================================================
  // JOB DETAILS
  // =========================================================

  if (path.includes("job-details.html")) {

    const fb = getFirebase();

    const params =
      new URLSearchParams(
        window.location.search
      );

    const jobId =
      params.get("id");

    async function loadJobDetails() {

      if (!fb || !jobId) {
        showJobNotFound();
        return;
      }

      try {

        const doc =
          await fb.firestore()
            .collection("jobs")
            .doc(jobId)
            .get();

        if (!doc.exists) {
          showJobNotFound();
          return;
        }

        const job = {
          id: doc.id,
          ...doc.data()
        };

        displayJob(job);

      } catch (error) {

        console.error(
          "Job Details Error:",
          error
        );

        showJobNotFound();
      }
    }

    function showJobNotFound() {

      const title =
        document.getElementById("job-title");

      const desc =
        document.getElementById("job-desc");

      if (title) {
        title.textContent =
          "Job not found";
      }

      if (desc) {
        desc.textContent =
          "This job may have been removed or is no longer available.";
      }
    }

    function displayJob(job) {

      const title =
        document.getElementById("job-title");

      const desc =
        document.getElementById("job-desc");

      const budget =
        document.getElementById("job-budget");

      const skills =
        document.getElementById("job-skills");

      const client =
        document.getElementById("job-client");

      const delivery =
        document.getElementById("job-delivery");

      const status =
        document.getElementById("job-status");

      if (title) {
        title.textContent =
          job.title || "Untitled Job";
      }

      if (desc) {
        desc.textContent =
          job.description || "";
      }

      if (budget) {
        budget.textContent =
          formatBudget(job.budget);
      }

      if (skills) {
        skills.textContent =
          job.skills || "Not specified";
      }

      if (client) {
        client.textContent =
          job.clientName || "Client";
      }

      if (delivery) {
        delivery.textContent =
          job.deliveryDays
            ? `${job.deliveryDays} days`
            : "Flexible";
      }

      if (status) {
        status.textContent =
          job.status === "open"
            ? "Open"
            : job.status || "Unavailable";
      }

      // -------------------------------------------------------
      // PROPOSAL / BID FORM
      // -------------------------------------------------------

      const form =
        document.getElementById("bid-form");

      if (form) {

        form.addEventListener(
          "submit",
          async (e) => {

            e.preventDefault();

            const user =
              await requireLogin();

            if (!user) {
              return;
            }

            try {

              const userData =
                await getUserProfile(user.uid);

              if (!userData) {
                alert(
                  "Your user profile could not be found."
                );
                return;
              }

              if (
                getRoleName(userData.role) !==
                "freelancer"
              ) {

                alert(
                  "Only freelancers can submit proposals."
                );

                return;
              }

              if (job.clientId === user.uid) {

                alert(
                  "You cannot submit a proposal to your own job."
                );

                return;
              }

              if (job.status !== "open") {

                alert(
                  "This job is no longer accepting proposals."
                );

                return;
              }

              const cover =
                document
                  .getElementById("cover")
                  ?.value.trim() || "";

              const amount =
                Number(
                  document
                    .getElementById("bid-amount")
                    ?.value || 0
                );

              const days =
                Number(
                  document
                    .getElementById("delivery-days")
                    ?.value || 0
                );

              if (!cover) {
                alert(
                  "Please write a proposal."
                );
                return;
              }

              if (
                !Number.isFinite(amount) ||
                amount <= 0
              ) {
                alert(
                  "Please enter a valid proposal amount."
                );
                return;
              }

              // Check duplicate proposal
              const existing =
                await fb.firestore()
                  .collection("proposals")
                  .where("jobId", "==", job.id)
                  .where("freelancerId", "==", user.uid)
                  .limit(1)
                  .get();

              if (!existing.empty) {

                alert(
                  "You have already submitted a proposal for this job."
                );

                return;
              }

              await fb.firestore()
                .collection("proposals")
                .add({

                  jobId: job.id,

                  jobTitle:
                    job.title || "",

                  clientId:
                    job.clientId || "",

                  freelancerId:
                    user.uid,

                  freelancerName:
                    userData.name || "",

                  freelancerAccountId:
                    userData.accountId || "",

                  coverLetter:
                    cover,

                  amount:
                    amount,

                  deliveryDays:
                    days > 0
                      ? days
                      : null,

                  status:
                    "submitted",

                  createdAt:
                    fb.firestore.FieldValue
                      .serverTimestamp(),

                  updatedAt:
                    fb.firestore.FieldValue
                      .serverTimestamp()
                });

              // Increment proposal count
              await fb.firestore()
                .collection("jobs")
                .doc(job.id)
                .update({

                  proposalCount:
                    fb.firestore.FieldValue
                      .increment(1),

                  updatedAt:
                    fb.firestore.FieldValue
                      .serverTimestamp()
                });

              alert(
                "Your proposal has been submitted successfully!"
              );

              form.reset();

            } catch (error) {

              console.error(
                "Proposal Error:",
                error
              );

              alert(
                "Unable to submit proposal.\n\n" +
                (error.message || "Please try again.")
              );
            }
          }
        );
      }
    }

    loadJobDetails();
  }


  // =========================================================
  // PROFILE
  // =========================================================

  if (path.includes("profile.html")) {

    const fb = getFirebase();

    async function loadProfile() {

      if (!fb) {
        return;
      }

      const user =
        fb.auth().currentUser;

      const localUser =
        getCurrentUserLocal();

      if (!user && !localUser.email) {
        window.location.href =
          "login.html";
        return;
      }

      let userData =
        localUser;

      if (user) {

        try {

          const profile =
            await getUserProfile(user.uid);

          if (profile) {
            userData = profile;
            saveCurrentUser(profile);
          }

        } catch (error) {
          console.error(error);
        }
      }

      const name =
        document.getElementById("user-name");

      const email =
        document.getElementById("user-email");

      const role =
        document.getElementById("user-role");

      const skills =
        document.getElementById("user-skills");

      const bio =
        document.getElementById("user-bio");

      const accountId =
        document.getElementById("account-id");

      if (name) {
        name.textContent =
          userData.name || "-";
      }

      if (email) {
        email.textContent =
          userData.email || "-";
      }

      if (role) {
        role.textContent =
          getRoleName(userData.role) || "-";
      }

      if (skills) {
        skills.textContent =
          userData.skills || "Add your skills";
      }

      if (bio) {
        bio.textContent =
          userData.bio ||
          "Add a professional bio to your profile.";
      }

      if (accountId) {
        accountId.textContent =
          userData.accountId || "-";
      }
    }

    loadProfile();
  }


  // =========================================================
  // LOGOUT
  // =========================================================

  const logoutButton =
    document.getElementById("logout-btn");

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      async () => {

        const fb = getFirebase();

        try {

          if (fb) {
            await fb.auth().signOut();
          }

          localStorage.removeItem(
            "currentUser"
          );

          window.location.href =
            "index.html";

        } catch (error) {

          console.error(
            "Logout Error:",
            error
          );

          alert(
            "Unable to log out. Please try again."
          );
        }
      }
    );
  }


  // =========================================================
  // AUTH STATE — KEEP LOCAL PROFILE UPDATED
  // =========================================================

  const fb = getFirebase();

  if (fb) {

    fb.auth().onAuthStateChanged(
      async (user) => {

        if (!user) {
          return;
        }

        try {

          const profile =
            await getUserProfile(user.uid);

          if (profile) {

            saveCurrentUser(profile);

            // Update common profile labels
            const profileName =
              document.getElementById("user-name");

            if (profileName) {
              profileName.textContent =
                profile.name || "User";
            }
          }

        } catch (error) {

          console.error(
            "Auth Profile Error:",
            error
          );
        }
      }
    );
  }

});
