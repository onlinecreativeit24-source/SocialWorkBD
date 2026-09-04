document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  // সাইনআপ
  if (path.includes("signup.html")) {
    const form = document.getElementById("signup-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value.trim(),
        role: document.getElementById("role").value,
        skills: document.getElementById("skills").value.trim(),
      };
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      users.push(user);
      localStorage.setItem("users", JSON.stringify(users));
      alert("সাইনআপ সফল! এখন লগইন করুন।");
      window.location.href = "login.html";
    });
  }

  // লগইন
  if (path.includes("login.html")) {
    const form = document.getElementById("login-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const user = users.find((u) => u.email === email && u.password === password);
      if (user) {
        localStorage.setItem("currentUser", JSON.stringify(user));
        alert("লগইন সফল!");
        window.location.href = "dashboard.html";
      } else {
        alert("ভুল ইমেইল/পাসওয়ার্ড");
      }
    });
  }

  // হোমপেজ: জব লিস্ট
  if (path.includes("index.html") || path === "/" || path.endsWith("/")) {
    const jobList = document.getElementById("job-list");
    const searchInput = document.getElementById("job-search");
    const jobs = JSON.parse(localStorage.getItem("jobs") || "[]");

    function renderJobs(filterText = "") {
      jobList.innerHTML = "";
      jobs
        .filter((job) =>
          job.title.toLowerCase().includes(filterText.toLowerCase()) ||
          job.desc.toLowerCase().includes(filterText.toLowerCase())
        )
        .forEach((job) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${job.title}</strong><br/>
            ${job.desc}<br/>
            <em>বাজেট: ${job.budget} BDT | স্কিল: ${job.skills}</em><br/>
            <a href="job-details.html?id=${job.id}">বিস্তারিত</a>
          `;
          jobList.appendChild(li);
        });
    }

    renderJobs();
    searchInput?.addEventListener("input", (e) => renderJobs(e.target.value));
  }

  // জব পোস্ট
  if (path.includes("post-job.html")) {
    const form = document.getElementById("job-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const job = {
        id: Date.now(),
        title: document.getElementById("title").value.trim(),
        desc: document.getElementById("desc").value.trim(),
        budget: document.getElementById("budget").value,
        skills: document.getElementById("skills").value.trim(),
        postedBy: localStorage.getItem("currentUser"),
      };
      const jobs = JSON.parse(localStorage.getItem("jobs") || "[]");
      jobs.unshift(job);
      localStorage.setItem("jobs", JSON.stringify(jobs));
      alert("জব পোস্ট হয়েছে!");
      window.location.href = "dashboard.html";
    });
  }

  // জব ডিটেইলস + বিড
  if (path.includes("job-details.html")) {
    const params = new URLSearchParams(window.location.search);
    const jobId = parseInt(params.get("id") || "0", 10);
    const jobs = JSON.parse(localStorage.getItem("jobs") || "[]");
    const job = jobs.find((j) => j.id === jobId);

    if (!job) {
      document.getElementById("job-title").textContent = "জব পাওয়া যায়নি";
    } else {
      document.getElementById("job-title").textContent = job.title;
      document.getElementById("job-desc").textContent = job.desc;
      document.getElementById("job-budget").textContent = job.budget;
      document.getElementById("job-skills").textContent = job.skills;

      const form = document.getElementById("bid-form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const bid = {
          jobId: job.id,
          jobTitle: job.title,
          cover: document.getElementById("cover").value.trim(),
          amount: document.getElementById("bid-amount").value,
          days: document.getElementById("delivery-days").value,
          time: new Date().toLocaleString(),
        };
        const bids = JSON.parse(localStorage.getItem("bids") || "[]");
        bids.push(bid);
        localStorage.setItem("bids", JSON.stringify(bids));
        alert("বিড জমা হয়েছে!");
        form.reset();
      });
    }
  }

  // প্রোফাইল
  if (path.includes("profile.html")) {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    document.getElementById("user-name").textContent = user.name || "-";
    document.getElementById("user-email").textContent = user.email || "-";
    document.getElementById("user-role").textContent = user.role || "-";
    document.getElementById("user-skills").textContent = user.skills || "-";
  }

  // ড্যাশবোর্ড
  if (path.includes("dashboard.html")) {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const jobs = JSON.parse(localStorage.getItem("jobs") || "[]");
    const bids = JSON.parse(localStorage.getItem("bids") || "[]");

    const jobsList = document.getElementById("jobs-list");
    const myJobs = jobs.filter((j) => j.postedBy === user.email);
    if (myJobs.length === 0) {
      jobsList.innerHTML = "<li>কোনো জব নেই</li>";
    } else {
      myJobs.forEach((j) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${j.title}</strong> - ${j.budget} BDT`;
        jobsList.appendChild(li);
      });
    }

    const bidsList = document.getElementById("bids-list");
    const myBids = bids; // সব বিড দেখাচ্ছে (ডেমো)
    if (myBids.length === 0) {
      bidsList.innerHTML = "<li>কোনো বিড নেই</li>";
    } else {
      myBids.forEach((b) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${b.jobTitle}</strong> - ${b.amount} BDT (${b.days} দিন)`;
        bidsList.appendChild(li);
      });
    }
  }
});
