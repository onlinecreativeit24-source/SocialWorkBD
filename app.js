document.addEventListener("DOMContentLoaded", () => {

  const path = window.location.pathname;

  // ==========================================
  // SocialWorkBD - Main App
  // Firebase Auth + Firestore
  // ==========================================

  if (!window.auth || !window.db) {
    console.error("Firebase Auth/Firestore not available.");
    return;
  }

  // ==========================================
  // Helper
  // ==========================================

  function showError(error) {
    console.error(error);

    let message = "কাজটি করা যায়নি। আবার চেষ্টা করুন।";

    switch (error.code) {
      case "auth/invalid-email":
        message = "ইমেইল ঠিকানা সঠিক নয়।";
        break;

      case "auth/user-not-found":
        message = "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।";
        break;

      case "auth/wrong-password":
        message = "পাসওয়ার্ড সঠিক নয়।";
        break;

      case "auth/invalid-credential":
        message = "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।";
        break;

      case "auth/email-already-in-use":
        message = "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে।";
        break;

      case "auth/weak-password":
        message = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
        break;

      case "auth/too-many-requests":
        message = "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
        break;

      case "permission-denied":
        message = "Firestore permission পাওয়া যায়নি।";
        break;
    }

    alert(message);
  }

  // ==========================================
  // SIGNUP
  // ==========================================

  if (path.includes("signup.html")) {

    const form = document.getElementById("signup-form");

    if (!form) return;

    form.addEventListener("submit", async (e) => {

      e.preventDefault();

      const name =
        document.getElementById("name")?.value.trim() || "";

      const email =
        document.getElementById("email")?.value.trim() || "";

      const password =
        document.getElementById("password")?.value || "";

      const confirmPassword =
        document.getElementById("confirm-password")?.value || "";

      const role =
        document.getElementById("role")?.value || "worker";

      if (!name) {
        alert("আপনার নাম লিখুন।");
        return;
      }

      if (!email) {
        alert("আপনার ইমেইল লিখুন।");
        return;
      }

      if (password.length < 6) {
        alert("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
        return;
      }

      if (password !== confirmPassword) {
        alert("দুইটি পাসওয়ার্ড একই নয়।");
        return;
      }

      const button =
        form.querySelector("button[type='submit']");

      try {

        if (button) {
          button.disabled = true;
          button.textContent = "অ্যাকাউন্ট তৈরি হচ্ছে...";
        }

        // Firebase Authentication
        const result =
          await auth.createUserWithEmailAndPassword(
            email,
            password
          );

        const user = result.user;

        // Firebase Auth profile
        await user.updateProfile({
          displayName: name
        });

        // Firestore profile
        await db.collection("users")
          .doc(user.uid)
          .set({

            uid: user.uid,

            name: name,

            email: user.email || email,

            role: role,

            skills: "",

            bio: "",

            balance: 0,

            pendingBalance: 0,

            createdAt:
              firebase.firestore.FieldValue.serverTimestamp(),

            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()

          }, { merge: true });

        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            uid: user.uid,
            name: name,
            email: user.email || email,
            role: role
          })
        );

        alert("অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!");

        window.location.href = "profile.html";

      } catch (error) {

        showError(error);

      } finally {

        if (button) {
          button.disabled = false;
          button.textContent = "সাইনআপ করুন";
        }

      }

    });
  }

  // ==========================================
  // LOGIN
  // ==========================================

  if (path.includes("login.html")) {

    const form =
      document.getElementById("login-form");

    if (!form) return;

    form.addEventListener("submit", async (e) => {

      e.preventDefault();

      const email =
        document.getElementById("email")?.value.trim() || "";

      const password =
        document.getElementById("password")?.value || "";

      if (!email || !password) {
        alert("ইমেইল ও পাসওয়ার্ড দিন।");
        return;
      }

      const button =
        form.querySelector("button[type='submit']");

      try {

        if (button) {
          button.disabled = true;
          button.textContent = "Login হচ্ছে...";
        }

        const result =
          await auth.signInWithEmailAndPassword(
            email,
            password
          );

        const user = result.user;

        let profile = {};

        const userDoc =
          await db.collection("users")
            .doc(user.uid)
            .get();

        if (userDoc.exists) {
          profile = userDoc.data();
        } else {

          profile = {
            uid: user.uid,
            name:
              user.displayName ||
              email.split("@")[0],
            email: user.email || email,
            role: "worker",
            skills: "",
            bio: "",
            balance: 0,
            pendingBalance: 0,
            createdAt:
              firebase.firestore.FieldValue.serverTimestamp()
          };

          await db.collection("users")
            .doc(user.uid)
            .set(profile, { merge: true });
        }

        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            uid: user.uid,
            name:
              profile.name ||
              user.displayName ||
              "",
            email: user.email || email,
            role:
              profile.role || "worker"
          })
        );

        alert("Login সফল হয়েছে!");

        window.location.href = "profile.html";

      } catch (error) {

        showError(error);

      } finally {

        if (button) {
          button.disabled = false;
          button.textContent = "লগইন";
        }

      }

    });

    // ==========================================
    // FORGOT PASSWORD
    // ==========================================

    const forgot =
      document.getElementById("forgot-password");

    if (forgot) {

      forgot.addEventListener("click", async (e) => {

        e.preventDefault();

        const email =
          document.getElementById("email")?.value.trim() || "";

        if (!email) {

          alert(
            "আগে আপনার ইমেইল লিখুন। তারপর 'পাসওয়ার্ড ভুলে গেছেন?' চাপুন।"
          );

          return;
        }

        try {

          await auth.sendPasswordResetEmail(email);

          alert(
            "Password reset email পাঠানো হয়েছে। আপনার Gmail inbox এবং Spam/Junk folder দেখুন।"
          );

        } catch (error) {

          showError(error);

        }

      });

    }

  }

  // ==========================================
  // PROFILE
  // ==========================================

  if (path.includes("profile.html")) {

    const loading =
      document.getElementById("profile-loading");

    const content =
      document.getElementById("profile-content");

    const form =
      document.getElementById("profile-form");

    auth.onAuthStateChanged(async (user) => {

      if (!user) {

        window.location.href = "login.html";
        return;

      }

      try {

        const userRef =
          db.collection("users")
            .doc(user.uid);

        const userDoc =
          await userRef.get();

        let profile;

        if (userDoc.exists) {

          profile = userDoc.data();

        } else {

          profile = {
            uid: user.uid,
            name:
              user.displayName ||
              user.email?.split("@")[0] ||
              "User",
            email: user.email || "",
            role: "worker",
            skills: "",
            bio: "",
            balance: 0,
            pendingBalance: 0
          };

          await userRef.set(profile, {
            merge: true
          });
        }

        document.getElementById("user-name").textContent =
          profile.name || "-";

        document.getElementById("user-email").textContent =
          user.email || "-";

        document.getElementById("user-role").textContent =
          profile.role || "worker";

        document.getElementById("user-skills").textContent =
          profile.skills || "-";

        document.getElementById("user-bio").textContent =
          profile.bio || "-";

        document.getElementById("profile-name").value =
          profile.name || "";

        document.getElementById("profile-role").value =
          profile.role || "worker";

        document.getElementById("profile-skills").value =
          profile.skills || "";

        document.getElementById("profile-bio").value =
          profile.bio || "";

        if (loading)
          loading.style.display = "none";

        if (content)
          content.style.display = "block";

      } catch (error) {

        console.error("PROFILE ERROR:", error);

        if (loading)
          loading.textContent =
            "প্রোফাইল লোড করতে সমস্যা হয়েছে।";

      }

    });

    if (form) {

      form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const user = auth.currentUser;

        if (!user) {
          window.location.href = "login.html";
          return;
        }

        const name =
          document.getElementById("profile-name")
            .value.trim();

        const role =
          document.getElementById("profile-role")
            .value;

        const skills =
          document.getElementById("profile-skills")
            .value.trim();

        const bio =
          document.getElementById("profile-bio")
            .value.trim();

        try {

          await user.updateProfile({
            displayName: name
          });

          await db.collection("users")
            .doc(user.uid)
            .set({

              uid: user.uid,

              name: name,

              email: user.email || "",

              role: role,

              skills: skills,

              bio: bio,

              updatedAt:
                firebase.firestore.FieldValue
                  .serverTimestamp()

            }, {
              merge: true
            });

          document.getElementById("user-name")
            .textContent = name || "-";

          document.getElementById("user-role")
            .textContent = role;

          document.getElementById("user-skills")
            .textContent = skills || "-";

          document.getElementById("user-bio")
            .textContent = bio || "-";

          alert("প্রোফাইল সফলভাবে Save হয়েছে!");

        } catch (error) {

          showError(error);

        }

      });

    }

    const logout =
      document.getElementById("logout-btn");

    if (logout) {

      logout.addEventListener("click", async () => {

        try {

          await auth.signOut();

          localStorage.removeItem("currentUser");

          window.location.href = "login.html";

        } catch (error) {

          showError(error);

        }

      });

    }

  }

  // ==========================================
  // POST JOB
  // ==========================================

  if (path.includes("post-job.html")) {

    const form =
      document.getElementById("job-form");

    if (!form) return;

    auth.onAuthStateChanged((user) => {

      if (!user) {
        window.location.href = "login.html";
      }

    });

    form.addEventListener("submit", async (e) => {

      e.preventDefault();

      const user = auth.currentUser;

      if (!user) {

        alert("Job Post করতে আগে Login করুন।");

        window.location.href = "login.html";

        return;
      }

      const title =
        document.getElementById("title")
          .value.trim();

      const desc =
        document.getElementById("desc")
          .value.trim();

      const budget =
        Number(
          document.getElementById("budget")
            .value
        );

      const skills =
        document.getElementById("skills")
          .value.trim();

      const deliveryDays =
        Number(
          document.getElementById("delivery-days")
            .value
        );

      if (!title || !desc || budget <= 0) {

        alert("সব তথ্য সঠিকভাবে পূরণ করুন।");

        return;
      }

      const button =
        document.getElementById("post-job-btn");

      try {

        if (button) {
          button.disabled = true;
          button.textContent = "Post হচ্ছে...";
        }

        await db.collection("jobs").add({

          title: title,

          description: desc,

          budget: budget,

          skills: skills,

          deliveryDays: deliveryDays,

          ownerId: user.uid,

          ownerName:
            user.displayName ||
            user.email?.split("@")[0] ||
            "Client",

          status: "open",

          createdAt:
            firebase.firestore.FieldValue.serverTimestamp()

        });

        alert("Job সফলভাবে Post হয়েছে!");

        form.reset();

        window.location.href = "index.html";

      } catch (error) {

        showError(error);

      } finally {

        if (button) {
          button.disabled = false;
          button.textContent = "Job Post করুন";
        }

      }

    });

  }

});
