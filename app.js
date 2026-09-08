document.addEventListener("DOMContentLoaded", () => {

  const path = window.location.pathname;

  // =========================
  // SIGNUP
  // =========================
  if (path.includes("signup.html")) {

    const form = document.getElementById("signup-form");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword =
          document.getElementById("confirm-password").value;
        const role = document.getElementById("role").value;
        const skills =
          document.getElementById("skills").value.trim();

        if (password !== confirmPassword) {
          alert("পাসওয়ার্ড দুইটি একই নয়।");
          return;
        }

        try {

          const userCredential =
            await firebase.auth()
              .createUserWithEmailAndPassword(email, password);

          const user = userCredential.user;

          const prefix =
            role === "worker" ? "SWB-W-" : "SWB-C-";

          const accountId =
            prefix + user.uid.substring(0, 8).toUpperCase();

          await firebase.firestore()
            .collection("users")
            .doc(user.uid)
            .set({
              uid: user.uid,
              accountId: accountId,
              name: name,
              email: email,
              role: role,
              skills: skills,
              balance: 0,
              pendingBalance: 0,
              createdAt:
                firebase.firestore.FieldValue.serverTimestamp()
            });

          alert(
            "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!\n\n" +
            "আপনার Account ID: " +
            accountId
          );

          window.location.href = "login.html";

        } catch (error) {

          console.error(error);

          let message = error.message;

          if (error.code === "auth/email-already-in-use") {
            message = "এই ইমেইল দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে।";
          }

          if (error.code === "auth/invalid-email") {
            message = "ইমেইল ঠিকানা সঠিক নয়।";
          }

          if (error.code === "auth/weak-password") {
            message = "পাসওয়ার্ড আরও শক্তিশালী দিন।";
          }

          alert("Signup Error: " + message);
        }
      });
    }
  }


  // =========================
  // LOGIN
  // =========================
  if (path.includes("login.html")) {

    const form = document.getElementById("login-form");

    if (form) {

      form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email =
          document.getElementById("email").value.trim();

        const password =
          document.getElementById("password").value;

        try {

          const userCredential =
            await firebase.auth()
              .signInWithEmailAndPassword(
                email,
                password
              );

          const user = userCredential.user;

          const userDoc =
            await firebase.firestore()
              .collection("users")
              .doc(user.uid)
              .get();

          if (!userDoc.exists) {
            alert("User profile পাওয়া যায়নি।");
            return;
          }

          const userData = userDoc.data();

          localStorage.setItem(
            "currentUser",
            JSON.stringify(userData)
          );

          alert("লগইন সফল হয়েছে!");

          window.location.href = "dashboard.html";

        } catch (error) {

          console.error(error);

          let message = error.message;

          if (
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password"
          ) {
            message = "ইমেইল অথবা পাসওয়ার্ড ভুল।";
          }

          alert("Login Error: " + message);
        }
      });
    }
  }


  // =========================
  // HOME - JOB LIST
  // =========================
  if (
    path.includes("index.html") ||
    path === "/" ||
    path.endsWith("/")
  ) {

    const jobList =
      document.getElementById("job-list");

    const searchInput =
      document.getElementById("job-search");

    const jobs =
      JSON.parse(
        localStorage.getItem("jobs") || "[]"
      );

    function renderJobs(filterText = "") {

      if (!jobList) return;

      jobList.innerHTML = "";

      jobs
        .filter((job) =>
          job.title
            .toLowerCase()
            .includes(filterText.toLowerCase()) ||

          job.desc
            .toLowerCase()
            .includes(filterText.toLowerCase())
        )
        .forEach((job) => {

          const li =
            document.createElement("li");

          li.innerHTML = `
            <strong>${job.title}</strong><br/>
            ${job.desc}<br/>
            <em>
              বাজেট: ${job.budget} BDT |
              স্কিল: ${job.skills}
            </em><br/>
            <a href="job-details.html?id=${job.id}">
              বিস্তারিত
            </a>
          `;

          jobList.appendChild(li);
        });
    }

    renderJobs();

    searchInput?.addEventListener(
      "input",
      (e) => renderJobs(e.target.value)
    );
  }


  // =========================
  // JOB POST
  // =========================
  if (path.includes("post-job.html")) {

    const form =
      document.getElementById("job-form");

    if (form) {

      form.addEventListener("submit", (e) => {

        e.preventDefault();

        const currentUser =
          JSON.parse(
            localStorage.getItem("currentUser") || "{}"
          );

        if (!currentUser.email) {
          alert("আগে লগইন করুন।");
          window.location.href = "login.html";
          return;
        }

        const job = {

          id: Date.now(),

          title:
            document.getElementById("title")
              .value.trim(),

          desc:
            document.getElementById("desc")
              .value.trim(),

          budget:
            document.getElementById("budget")
              .value,

          skills:
            document.getElementById("skills")
              .value.trim(),

          postedBy:
            currentUser.email
        };

        const jobs =
          JSON.parse(
            localStorage.getItem("jobs") || "[]"
          );

        jobs.unshift(job);

        localStorage.setItem(
          "jobs",
          JSON.stringify(jobs)
        );

        alert("জব পোস্ট হয়েছে!");

        window.location.href = "dashboard.html";
      });
    }
  }


  // =========================
  // JOB DETAILS + BID
  // =========================
  if (path.includes("job-details.html")) {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const jobId =
      parseInt(
        params.get("id") || "0",
        10
      );

    const jobs =
      JSON.parse(
        localStorage.getItem("jobs") || "[]"
      );

    const job =
      jobs.find(
        (j) => j.id === jobId
      );

    if (!job) {

      const title =
        document.getElementById("job-title");

      if (title) {
        title.textContent =
          "জব পাওয়া যায়নি";
      }

    } else {

      const title =
        document.getElementById("job-title");

      const desc =
        document.getElementById("job-desc");

      const budget =
        document.getElementById("job-budget");

      const skills =
        document.getElementById("job-skills");

      if (title) title.textContent = job.title;
      if (desc) desc.textContent = job.desc;
      if (budget) budget.textContent = job.budget;
      if (skills) skills.textContent = job.skills;

      const form =
        document.getElementById("bid-form");

      if (form) {

        form.addEventListener(
          "submit",
          (e) => {

            e.preventDefault();

            const bid = {

              jobId: job.id,

              jobTitle: job.title,

              cover:
                document.getElementById("cover")
                  .value.trim(),

              amount:
                document.getElementById("bid-amount")
                  .value,

              days:
                document.getElementById("delivery-days")
                  .value,

              time:
                new Date().toLocaleString()
            };

            const bids =
              JSON.parse(
                localStorage.getItem("bids") || "[]"
              );

            bids.push(bid);

            localStorage.setItem(
              "bids",
              JSON.stringify(bids)
            );

            alert("বিড জমা হয়েছে!");

            form.reset();
          }
        );
      }
    }
  }


  // =========================
  // PROFILE
  // =========================
  if (path.includes("profile.html")) {

    const user =
      JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );

    const name =
      document.getElementById("user-name");

    const email =
      document.getElementById("user-email");

    const role =
      document.getElementById("user-role");

    const skills =
      document.getElementById("user-skills");

    if (name) name.textContent = user.name || "-";
    if (email) email.textContent = user.email || "-";
    if (role) role.textContent = user.role || "-";
    if (skills) skills.textContent = user.skills || "-";
  }


  // =========================
  // DASHBOARD
  // =========================
  if (path.includes("dashboard.html")) {

    const user =
      JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );

    if (!user.email) {
      window.location.href = "login.html";
      return;
    }

    const jobs =
      JSON.parse(
        localStorage.getItem("jobs") || "[]"
      );

    const bids =
      JSON.parse(
        localStorage.getItem("bids") || "[]"
      );

    const jobsList =
      document.getElementById("jobs-list");

    if (jobsList) {

      const myJobs =
        jobs.filter(
          (j) => j.postedBy === user.email
        );

      if (myJobs.length === 0) {

        jobsList.innerHTML =
          "<li>কোনো জব নেই</li>";

      } else {

        myJobs.forEach((j) => {

          const li =
            document.createElement("li");

          li.innerHTML =
            `<strong>${j.title}</strong> -
             ${j.budget} BDT`;

          jobsList.appendChild(li);
        });
      }
    }

    const bidsList =
      document.getElementById("bids-list");

    if (bidsList) {

      if (bids.length === 0) {

        bidsList.innerHTML =
          "<li>কোনো বিড নেই</li>";

      } else {

        bids.forEach((b) => {

          const li =
            document.createElement("li");

          li.innerHTML =
            `<strong>${b.jobTitle}</strong> -
             ${b.amount} BDT
             (${b.days} দিন)`;

          bidsList.appendChild(li);
        });
      }
    }
  }

});
