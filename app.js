document.addEventListener("DOMContentLoaded", async () => {

  // =========================================================
  // SocialWorkBD
  // Firebase Authentication + Firestore
  // =========================================================

  const path = window.location.pathname;

  // ---------------------------------------------------------
  // Firebase Configuration
  // ---------------------------------------------------------

  const firebaseConfig = {
    apiKey: "AIzaSyDsqRgRZTKZFvfu0r4UJc8Q5xlS7lBL41c",
    authDomain: "socialworkbd-b1c00.firebaseapp.com",
    projectId: "socialworkbd-b1c00",
    storageBucket: "socialworkbd-b1c00.firebasestorage.app",
    messagingSenderId: "999070456562",
    appId: "1:999070456562:web:67101bb3148b157e67ce6b",
    measurementId: "G-XVBRYV71BZ"
  };

  // ---------------------------------------------------------
  // Load Firebase
  // ---------------------------------------------------------

  function loadScript(src) {
    return new Promise((resolve, reject) => {

      const existing =
        document.querySelector(`script[src="${src}"]`);

      if (existing) {
        existing.addEventListener("load", resolve);
        return;
      }

      const script =
        document.createElement("script");

      script.src = src;
      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  try {

    await loadScript(
      "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"
    );

    await loadScript(
      "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"
    );

    await loadScript(
      "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"
    );

  } catch (error) {

    console.error(
      "Firebase load error:",
      error
    );

    alert(
      "Firebase লোড করা যায়নি। Internet connection check করুন।"
    );

    return;
  }

  // ---------------------------------------------------------
  // Initialize Firebase
  // ---------------------------------------------------------

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // =========================================================
  // Helper Functions
  // =========================================================

  function getCurrentUser() {
    return auth.currentUser;
  }

  function requireLogin() {

    if (!auth.currentUser) {

      alert(
        "এই কাজটি করতে আগে Login করুন।"
      );

      window.location.href =
        "login.html";

      return false;
    }

    return true;
  }

  // =========================================================
  // SIGNUP
  // =========================================================

  if (path.includes("signup.html")) {

    const form =
      document.getElementById("signup-form");

    if (form) {

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();

          const name =
            document.getElementById("name")
              ?.value
              .trim();

          const email =
            document.getElementById("email")
              ?.value
              .trim()
              .toLowerCase();

          const password =
            document.getElementById("password")
              ?.value;

          const role =
            document.getElementById("role")
              ?.value;

          const skills =
            document.getElementById("skills")
              ?.value
              .trim();

          if (!name || !email || !password || !role) {

            alert(
              "সব প্রয়োজনীয় তথ্য পূরণ করুন।"
            );

            return;
          }

          if (password.length < 6) {

            alert(
              "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"
            );

            return;
          }

          try {

            // Firebase Authentication account
            const credential =
              await auth.createUserWithEmailAndPassword(
                email,
                password
              );

            const user =
              credential.user;

            // Display name
            await user.updateProfile({
              displayName: name
            });

            // Firestore profile
            await db
              .collection("users")
              .doc(user.uid)
              .set({

                uid: user.uid,

                name: name,

                email: email,

                role: role,

                skills: skills || "",

                createdAt:
                  firebase.firestore.FieldValue.serverTimestamp()

              });

            alert(
              "সাইনআপ সফল! আপনার অ্যাকাউন্ট তৈরি হয়েছে।"
            );

            window.location.href =
              "dashboard.html";

          } catch (error) {

            console.error(
              "Signup error:",
              error
            );

            let message =
              "সাইনআপ করা যায়নি।";

            if (
              error.code ===
              "auth/email-already-in-use"
            ) {

              message =
                "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।";

            } else if (
              error.code ===
              "auth/invalid-email"
            ) {

              message =
                "ইমেইল ঠিক নয়।";

            } else if (
              error.code ===
              "auth/weak-password"
            ) {

              message =
                "পাসওয়ার্ড আরও শক্তিশালী দিন।";
            }

            alert(message);
          }
        }
      );
    }
  }

  // =========================================================
  // LOGIN
  // =========================================================

  if (path.includes("login.html")) {

    const form =
      document.getElementById("login-form");

    if (form) {

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();

          const email =
            document.getElementById("email")
              ?.value
              .trim()
              .toLowerCase();

          const password =
            document.getElementById("password")
              ?.value;

          if (!email || !password) {

            alert(
              "ইমেইল এবং পাসওয়ার্ড দিন।"
            );

            return;
          }

          try {

            await auth.signInWithEmailAndPassword(
              email,
              password
            );

            alert(
              "লগইন সফল!"
            );

            window.location.href =
              "dashboard.html";

          } catch (error) {

            console.error(
              "Login error:",
              error
            );

            let message =
              "ইমেইল অথবা পাসওয়ার্ড ভুল।";

            if (
              error.code ===
              "auth/user-not-found"
            ) {

              message =
                "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।";

            } else if (
              error.code ===
              "auth/wrong-password"
            ) {

              message =
                "পাসওয়ার্ড ভুল।";

            } else if (
              error.code ===
              "auth/invalid-credential"
            ) {

              message =
                "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।";
            }

            alert(message);
          }
        }
      );
    }

    // =======================================================
    // FORGOT PASSWORD
    // =======================================================

    const forgotPassword =
      document.getElementById(
        "forgot-password"
      );

    if (forgotPassword) {

      forgotPassword.addEventListener(
        "click",
        async (e) => {

          e.preventDefault();

          const emailInput =
            document.getElementById("email");

          const email =
            emailInput
              ? emailInput.value.trim().toLowerCase()
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

            await auth.sendPasswordResetEmail(
              email
            );

            alert(
              "Password reset link আপনার ইমেইলে পাঠানো হয়েছে। Inbox এবং Spam folder দুটিই দেখুন।"
            );

          } catch (error) {

            console.error(
              "Password reset error:",
              error
            );

            let message =
              "Password reset email পাঠানো যায়নি।";

            if (
              error.code ===
              "auth/user-not-found"
            ) {

              message =
                "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।";

            } else if (
              error.code ===
              "auth/invalid-email"
            ) {

              message =
                "সঠিক ইমেইল লিখুন।";

            } else if (
              error.code ===
              "auth/too-many-requests"
            ) {

              message =
                "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
            }

            alert(message);
          }
        }
      );
    }
  }

  // =========================================================
  // HOME PAGE - JOB LIST
  // =========================================================

  if (
    path.includes("index.html") ||
    path === "/" ||
    path.endsWith("/")
  ) {

    const jobList =
      document.getElementById("job-list");

    const searchInput =
      document.getElementById("job-search");

    if (jobList) {

      try {

        const snapshot =
          await db
            .collection("jobs")
            .orderBy(
              "createdAt",
              "desc"
            )
            .get();

        const jobs =
          snapshot.docs.map(
            (doc) => ({
              id: doc.id,
              ...doc.data()
            })
          );

        function renderJobs(
          filterText = ""
        ) {

          jobList.innerHTML = "";

          const search =
            filterText.toLowerCase();

          const filteredJobs =
            jobs.filter((job) => {

              const title =
                String(
                  job.title || ""
                ).toLowerCase();

              const desc =
                String(
                  job.desc || ""
                ).toLowerCase();

              return (
                title.includes(search) ||
                desc.includes(search)
              );
            });

          if (
            filteredJobs.length === 0
          ) {

            jobList.innerHTML =
              "<li>কোনো জব পাওয়া যায়নি।</li>";

            return;
          }

          filteredJobs.forEach(
            (job) => {

              const li =
                document.createElement(
                  "li"
                );

              li.innerHTML = `
                <strong>${job.title || ""}</strong><br/>
                ${job.desc || ""}<br/>
                <em>
                  বাজেট:
                  ${job.budget || 0} BDT
                  |
                  স্কিল:
                  ${job.skills || "-"}
                </em>
                <br/>
                <a href="job-details.html?id=${job.id}">
                  বিস্তারিত
                </a>
              `;

              jobList.appendChild(li);
            }
          );
        }

        renderJobs();

        if (searchInput) {

          searchInput.addEventListener(
            "input",
            (e) => {

              renderJobs(
                e.target.value
              );
            }
          );
        }

      } catch (error) {

        console.error(
          "Job loading error:",
          error
        );

        jobList.innerHTML =
          "<li>জব লোড করা যায়নি।</li>";
      }
    }
  }

  // =========================================================
  // POST JOB
  // =========================================================

  if (path.includes("post-job.html")) {

    const form =
      document.getElementById("job-form");

    if (form) {

      if (!requireLogin()) {
        return;
      }

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();

          const user =
            getCurrentUser();

          if (!user) {
            return;
          }

          const title =
            document.getElementById("title")
              ?.value
              .trim();

          const desc =
            document.getElementById("desc")
              ?.value
              .trim();

          const budget =
            document.getElementById("budget")
              ?.value;

          const skills =
            document.getElementById("skills")
              ?.value
              .trim();

          if (
            !title ||
            !desc ||
            !budget
          ) {

            alert(
              "জবের প্রয়োজনীয় তথ্য পূরণ করুন।"
            );

            return;
          }

          try {

            await db
              .collection("jobs")
              .add({

                title,

                desc,

                budget:
                  Number(budget),

                skills:
                  skills || "",

                clientId:
                  user.uid,

                clientEmail:
                  user.email,

                status:
                  "open",

                createdAt:
                  firebase.firestore.FieldValue.serverTimestamp()

              });

            alert(
              "জব সফলভাবে পোস্ট হয়েছে!"
            );

            window.location.href =
              "dashboard.html";

          } catch (error) {

            console.error(
              "Job post error:",
              error
            );

            alert(
              "জব পোস্ট করা যায়নি।"
            );
          }
        }
      );
    }
  }

  // =========================================================
  // JOB DETAILS + BID
  // =========================================================

  if (path.includes("job-details.html")) {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const jobId =
      params.get("id");

    if (!jobId) {
      return;
    }

    try {

      const jobDoc =
        await db
          .collection("jobs")
          .doc(jobId)
          .get();

      if (!jobDoc.exists) {

        const title =
          document.getElementById(
            "job-title"
          );

        if (title) {
          title.textContent =
            "জব পাওয়া যায়নি";
        }

        return;
      }

      const job =
        jobDoc.data();

      const title =
        document.getElementById(
          "job-title"
        );

      const desc =
        document.getElementById(
          "job-desc"
        );

      const budget =
        document.getElementById(
          "job-budget"
        );

      const skills =
        document.getElementById(
          "job-skills"
        );

      if (title)
        title.textContent =
          job.title || "";

      if (desc)
        desc.textContent =
          job.desc || "";

      if (budget)
        budget.textContent =
          job.budget || 0;

      if (skills)
        skills.textContent =
          job.skills || "-";

      const form =
        document.getElementById(
          "bid-form"
        );

      if (form) {

        form.addEventListener(
          "submit",
          async (e) => {

            e.preventDefault();

            if (!requireLogin()) {
              return;
            }

            const user =
              getCurrentUser();

            // Client নিজের জবে bid দিতে পারবে না
            if (
              user.uid ===
              job.clientId
            ) {

              alert(
                "নিজের জবে নিজে বিড দিতে পারবেন না।"
              );

              return;
            }

            const cover =
              document.getElementById(
                "cover"
              )?.value.trim();

            const amount =
              document.getElementById(
                "bid-amount"
              )?.value;

            const days =
              document.getElementById(
                "delivery-days"
              )?.value;

            if (
              !amount ||
              !days
            ) {

              alert(
                "Bid amount এবং delivery days দিন।"
              );

              return;
            }

            try {

              await db
                .collection("bids")
                .add({

                  jobId,

                  jobTitle:
                    job.title || "",

                  workerId:
                    user.uid,

                  workerEmail:
                    user.email,

                  workerName:
                    user.displayName || "",

                  clientId:
                    job.clientId,

                  clientEmail:
                    job.clientEmail || "",

                  cover:
                    cover || "",

                  amount:
                    Number(amount),

                  days:
                    Number(days),

                  status:
                    "pending",

                  createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()

                });

              alert(
                "বিড সফলভাবে জমা হয়েছে!"
              );

              form.reset();

            } catch (error) {

              console.error(
                "Bid error:",
                error
              );

              alert(
                "বিড জমা দেওয়া যায়নি।"
              );
            }
          }
        );
      }

    } catch (error) {

      console.error(
        "Job details error:",
        error
      );

      alert(
        "জবের তথ্য লোড করা যায়নি।"
      );
    }
  }

  // =========================================================
  // PROFILE
  // =========================================================

  if (path.includes("profile.html")) {

    if (!requireLogin()) {
      return;
    }

    const user =
      getCurrentUser();

    const nameElement =
      document.getElementById(
        "user-name"
      );

    const emailElement =
      document.getElementById(
        "user-email"
      );

    const roleElement =
      document.getElementById(
        "user-role"
      );

    const skillsElement =
      document.getElementById(
        "user-skills"
      );

    if (emailElement) {
      emailElement.textContent =
        user.email || "-";
    }

    try {

      const userDoc =
        await db
          .collection("users")
          .doc(user.uid)
          .get();

      const profile =
        userDoc.exists
          ? userDoc.data()
          : {};

      if (nameElement) {
        nameElement.textContent =
          profile.name ||
          user.displayName ||
          "-";
      }

      if (roleElement) {
        roleElement.textContent =
          profile.role || "-";
      }

      if (skillsElement) {
        skillsElement.textContent =
          profile.skills || "-";
      }

    } catch (error) {

      console.error(
        "Profile error:",
        error
      );
    }
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  if (path.includes("dashboard.html")) {

    if (!requireLogin()) {
      return;
    }

    const user =
      getCurrentUser();

    // -------------------------------------------------------
    // MY JOBS
    // -------------------------------------------------------

    const jobsList =
      document.getElementById(
        "jobs-list"
      );

    if (jobsList) {

      try {

        const snapshot =
          await db
            .collection("jobs")
            .where(
              "clientId",
              "==",
              user.uid
            )
            .get();

        jobsList.innerHTML = "";

        if (snapshot.empty) {

          jobsList.innerHTML =
            "<li>কোনো জব নেই</li>";

        } else {

          snapshot.forEach(
            (doc) => {

              const job =
                doc.data();

              const li =
                document.createElement(
                  "li"
                );

              li.innerHTML = `
                <strong>
                  ${job.title || ""}
                </strong>
                -
                ${job.budget || 0} BDT
                <br/>
                <small>
                  Status:
                  ${job.status || "open"}
                </small>
              `;

              jobsList.appendChild(li);
            }
          );
        }

      } catch (error) {

        console.error(
          "My jobs error:",
          error
        );

        jobsList.innerHTML =
          "<li>জব লোড করা যায়নি।</li>";
      }
    }

    // -------------------------------------------------------
    // MY BIDS
    // -------------------------------------------------------

    const bidsList =
      document.getElementById(
        "bids-list"
      );

    if (bidsList) {

      try {

        const workerSnapshot =
          await db
            .collection("bids")
            .where(
              "workerId",
              "==",
              user.uid
            )
            .get();

        const clientSnapshot =
          await db
            .collection("bids")
            .where(
              "clientId",
              "==",
              user.uid
            )
            .get();

        const bidMap =
          new Map();

        workerSnapshot.forEach(
          (doc) => {
            bidMap.set(
              doc.id,
              doc.data()
            );
          }
        );

        clientSnapshot.forEach(
          (doc) => {
            bidMap.set(
              doc.id,
              doc.data()
            );
          }
        );

        const myBids =
          Array.from(
            bidMap.values()
          );

        bidsList.innerHTML = "";

        if (myBids.length === 0) {

          bidsList.innerHTML =
            "<li>কোনো বিড নেই</li>";

        } else {

          myBids.forEach(
            (bid) => {

              const li =
                document.createElement(
                  "li"
                );

              li.innerHTML = `
                <strong>
                  ${bid.jobTitle || ""}
                </strong>
                -
                ${bid.amount || 0} BDT
                (${bid.days || 0} দিন)
                <br/>
                <small>
                  Status:
                  ${bid.status || "pending"}
                </small>
              `;

              bidsList.appendChild(li);
            }
          );
        }

      } catch (error) {

        console.error(
          "My bids error:",
          error
        );

        bidsList.innerHTML =
          "<li>বিড লোড করা যায়নি।</li>";
      }
    }

    // -------------------------------------------------------
    // EARNINGS
    // -------------------------------------------------------

    const earningsAmount =
      document.getElementById(
        "earnings-amount"
      );

    const earningsMessage =
      document.getElementById(
        "earnings-message"
      );

    if (earningsAmount) {

      try {

        const earningsSnapshot =
          await db
            .collection("payments")
            .where(
              "workerId",
              "==",
              user.uid
            )
            .where(
              "status",
              "==",
              "paid"
            )
            .get();

        let total =
          0;

        earningsSnapshot.forEach(
          (doc) => {

            const payment =
              doc.data();

            total +=
              Number(
                payment.workerAmount ||
                payment.amount ||
                0
              );
          }
        );

        earningsAmount.textContent =
          total.toLocaleString(
            "bn-BD"
          );

        if (earningsMessage) {

          earningsMessage.textContent =
            total > 0
              ? "আপনার সম্পন্ন কাজের আয় এখানে দেখানো হচ্ছে।"
              : "আপনার সম্পন্ন কাজের আয় এখানে দেখানো হবে।";
        }

      } catch (error) {

        console.error(
          "Earnings error:",
          error
        );

        earningsAmount.textContent =
          "0";
      }
    }

    // -------------------------------------------------------
    // TRANSACTIONS
    // -------------------------------------------------------

    const transactionsList =
      document.getElementById(
        "transactions-list"
      );

    if (transactionsList) {

      try {

        const paymentsSnapshot =
          await db
            .collection("payments")
            .where(
              "clientId",
              "==",
              user.uid
            )
            .get();

        const workerPaymentsSnapshot =
          await db
            .collection("payments")
            .where(
              "workerId",
              "==",
              user.uid
            )
            .get();

        const paymentMap =
          new Map();

        paymentsSnapshot.forEach(
          (doc) => {
            paymentMap.set(
              doc.id,
              doc.data()
            );
          }
        );

        workerPaymentsSnapshot.forEach(
          (doc) => {
            paymentMap.set(
              doc.id,
              doc.data()
            );
          }
        );

        const payments =
          Array.from(
            paymentMap.values()
          );

        transactionsList.innerHTML = "";

        if (payments.length === 0) {

          transactionsList.innerHTML =
            "<li>কোনো transaction নেই</li>";

        } else {

          payments
            .slice(-10)
            .reverse()
            .forEach(
              (payment) => {

                const li =
                  document.createElement(
                    "li"
                  );

                li.innerHTML = `
                  <strong>
                    ৳ ${Number(
                      payment.amount || 0
                    ).toLocaleString("bn-BD")}
                  </strong>
                  <br/>
                  Status:
                  ${payment.status || "pending"}
                `;

                transactionsList.appendChild(
                  li
                );
              }
            );
        }

      } catch (error) {

        console.error(
          "Transactions error:",
          error
        );

        transactionsList.innerHTML =
          "<li>Transaction লোড করা যায়নি।</li>";
      }
    }
  }

});
