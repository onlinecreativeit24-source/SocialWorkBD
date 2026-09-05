document.addEventListener("DOMContentLoaded", () => {

  const path = window.location.pathname;

  // ==========================================
  // SocialWorkBD
  // Firebase Auth + Firestore
  // ==========================================

  if (!window.auth || !window.db) {
    console.error("Firebase Auth/Firestore not available.");
    return;
  }


  // ==========================================
  // ERROR HANDLER
  // ==========================================

  function showError(error) {

    console.error("SocialWorkBD ERROR:", error);

    let message =
      "কাজটি করা যায়নি। আবার চেষ্টা করুন।";

    switch (error.code) {

      case "auth/invalid-email":
        message = "ইমেইল ঠিকানা সঠিক নয়।";
        break;

      case "auth/user-not-found":
        message =
          "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।";
        break;

      case "auth/wrong-password":
        message =
          "পাসওয়ার্ড সঠিক নয়।";
        break;

      case "auth/invalid-credential":
        message =
          "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।";
        break;

      case "auth/email-already-in-use":
        message =
          "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে।";
        break;

      case "auth/weak-password":
        message =
          "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
        break;

      case "auth/too-many-requests":
        message =
          "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
        break;

      case "auth/operation-not-allowed":
        message =
          "এই Login method Firebase-এ চালু করা হয়নি।";
        break;

      case "auth/unauthorized-domain":
        message =
          "এই website domain Firebase Authentication-এ অনুমোদিত নয়।";
        break;

      case "auth/popup-blocked":
        message =
          "Google Login popup block হয়েছে।";
        break;

      case "auth/popup-closed-by-user":
        message =
          "Google Login window বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।";
        break;

      case "auth/account-exists-with-different-credential":
        message =
          "এই Email দিয়ে আগে অন্য Login method ব্যবহার করে Account তৈরি হয়েছে।";
        break;

      case "permission-denied":
        message =
          "Firestore permission পাওয়া যায়নি।";
        break;

      case "failed-precondition":
        message =
          "Firestore database ঠিকভাবে প্রস্তুত হয়নি।";
        break;
    }

    alert(
      message +
      "\n\nFirebase Error: " +
      (error.code || "unknown")
    );
  }


  // ==========================================
  // USER PROFILE
  // ==========================================

  async function createOrLoadUserProfile(
    user,
    extraData = {}
  ) {

    const userRef =
      db.collection("users").doc(user.uid);

    try {

      const userDoc =
        await userRef.get();

      if (userDoc.exists) {

        const existing =
          userDoc.data() || {};

        return {
          uid: user.uid,

          name:
            existing.name ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "User",

          email:
            user.email ||
            existing.email ||
            "",

          role:
            existing.role ||
            extraData.role ||
            "worker",

          skills:
            existing.skills ||
            extraData.skills ||
            "",

          bio:
            existing.bio ||
            "",

          balance:
            Number(existing.balance || 0),

          pendingBalance:
            Number(existing.pendingBalance || 0)
        };
      }


      // New profile

      const profile = {

        uid:
          user.uid,

        name:
          extraData.name ||
          user.displayName ||
          user.email?.split("@")[0] ||
          "User",

        email:
          user.email ||
          "",

        role:
          extraData.role ||
          "worker",

        skills:
          extraData.skills ||
          "",

        bio:
          "",

        balance:
          0,

        pendingBalance:
          0,

        createdAt:
          firebase.firestore.FieldValue
            .serverTimestamp(),

        updatedAt:
          firebase.firestore.FieldValue
            .serverTimestamp()

      };


      await userRef.set(profile);

      return profile;

    } catch (error) {

      console.error(
        "PROFILE FIRESTORE ERROR:",
        error
      );

      /*
       * IMPORTANT:
       * Auth successful হলেও Firestore সমস্যা হলে
       * Login/Signup পুরোপুরি ব্যর্থ দেখানো হবে না।
       */

      return {

        uid:
          user.uid,

        name:
          extraData.name ||
          user.displayName ||
          user.email?.split("@")[0] ||
          "User",

        email:
          user.email ||
          "",

        role:
          extraData.role ||
          "worker",

        skills:
          extraData.skills ||
          "",

        bio:
          "",

        balance:
          0,

        pendingBalance:
          0

      };
    }
  }


  // ==========================================
  // LOCAL SESSION
  // ==========================================

  function saveLocalSession(
    user,
    profile
  ) {

    localStorage.setItem(
      "currentUser",
      JSON.stringify({

        id:
          user.uid,

        uid:
          user.uid,

        name:
          profile.name ||
          user.displayName ||
          "User",

        email:
          user.email ||
          "",

        role:
          profile.role ||
          "worker",

        skills:
          profile.skills ||
          "",

        balance:
          Number(profile.balance || 0),

        pendingBalance:
          Number(profile.pendingBalance || 0)

      })
    );
  }


  // ==========================================
  // SIGNUP
  // ==========================================

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
              ?.value.trim() || "";


          const email =
            document.getElementById("email")
              ?.value.trim() || "";


          const password =
            document.getElementById("password")
              ?.value || "";


          const confirmPassword =
            document.getElementById(
              "confirm-password"
            )?.value || "";


          const role =
            document.getElementById("role")
              ?.value || "worker";


          const skills =
            document.getElementById("skills")
              ?.value.trim() || "";


          if (!name) {

            alert("আপনার নাম লিখুন।");

            return;
          }


          if (!email) {

            alert("আপনার Email লিখুন।");

            return;
          }


          if (password.length < 6) {

            alert(
              "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"
            );

            return;
          }


          if (password !== confirmPassword) {

            alert(
              "দুইটি পাসওয়ার্ড একই নয়।"
            );

            return;
          }


          const button =
            form.querySelector(
              "button[type='submit']"
            );


          try {

            if (button) {

              button.disabled = true;

              button.textContent =
                "অ্যাকাউন্ট তৈরি হচ্ছে...";

            }


            // Firebase Authentication

            const result =
              await auth.createUserWithEmailAndPassword(
                email,
                password
              );


            const user =
              result.user;


            // Display Name

            await user.updateProfile({

              displayName:
                name

            });


            // Firestore profile

            const profile =
              await createOrLoadUserProfile(
                user,
                {
                  name:
                    name,

                  role:
                    role,

                  skills:
                    skills
                }
              );


            // Save local session

            saveLocalSession(
              user,
              {
                ...profile,

                name:
                  name,

                role:
                  role,

                skills:
                  skills
              }
            );


            alert(
              "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!"
            );


            window.location.href =
              "profile.html";


          } catch (error) {

            showError(error);

          } finally {

            if (button) {

              button.disabled = false;

              button.textContent =
                "সাইনআপ করুন";

            }

          }

        }
      );

    }

  }


  // ==========================================
  // LOGIN
  // ==========================================

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
              ?.value.trim() || "";


          const password =
            document.getElementById("password")
              ?.value || "";


          if (!email || !password) {

            alert(
              "ইমেইল ও পাসওয়ার্ড দিন।"
            );

            return;
          }


          const button =
            form.querySelector(
              "button[type='submit']"
            );


          try {

            if (button) {

              button.disabled = true;

              button.textContent =
                "Login হচ্ছে...";

            }


            const result =
              await auth.signInWithEmailAndPassword(
                email,
                password
              );


            const user =
              result.user;


            const profile =
              await createOrLoadUserProfile(
                user
              );


            saveLocalSession(
              user,
              profile
            );


            alert(
              "Login সফল হয়েছে!"
            );


            window.location.href =
              "profile.html";


          } catch (error) {

            showError(error);

          } finally {

            if (button) {

              button.disabled = false;

              button.textContent =
                "লগইন";

            }

          }

        }
      );

    }


    // ==========================================
    // FORGOT PASSWORD
    // ==========================================

    const forgot =
      document.getElementById(
        "forgot-password"
      );


    if (forgot) {

      forgot.addEventListener(
        "click",
        async (e) => {

          e.preventDefault();


          const email =
            document.getElementById("email")
              ?.value.trim() || "";


          if (!email) {

            alert(
              "আগে আপনার Email লিখুন। তারপর 'পাসওয়ার্ড ভুলে গেছেন?' চাপুন।"
            );

            return;
          }


          try {

            await auth.sendPasswordResetEmail(
              email
            );


            alert(
              "Password reset email পাঠানো হয়েছে। Gmail Inbox এবং Spam/Junk folder দেখুন।"
            );


          } catch (error) {

            showError(error);

          }

        }
      );

    }


    // ==========================================
    // GOOGLE LOGIN
    // MOBILE REDIRECT
    // ==========================================

    const googleButton =
      document.getElementById(
        "google-login"
      );


    if (googleButton) {

      // Pink / Red Google button

      googleButton.style.background =
        "linear-gradient(135deg, #ff2d55, #e91e63)";

      googleButton.style.color =
        "#ffffff";

      googleButton.style.border =
        "none";

      googleButton.style.borderRadius =
        "10px";

      googleButton.style.padding =
        "12px 16px";

      googleButton.style.fontWeight =
        "700";

      googleButton.style.cursor =
        "pointer";

      googleButton.style.width =
        "100%";


      googleButton.addEventListener(
        "click",
        async () => {

          try {

            googleButton.disabled =
              true;


            googleButton.textContent =
              "Google Login হচ্ছে...";


            const provider =
              new firebase.auth.GoogleAuthProvider();


            provider.addScope(
              "profile"
            );

            provider.addScope(
              "email"
            );


            /*
             * Mobile-এর জন্য redirect flow.
             */

            await auth.signInWithRedirect(
              provider
            );


          } catch (error) {

            showError(error);


            googleButton.disabled =
              false;

            googleButton.textContent =
              "🔵 Continue with Google";

          }

        }
      );


      // ========================================
      // GOOGLE REDIRECT RESULT
      // ========================================

      auth.getRedirectResult()
        .then(async (result) => {

          if (
            !result ||
            !result.user
          ) {

            return;
          }


          const user =
            result.user;


          const profile =
            await createOrLoadUserProfile(
              user
            );


          saveLocalSession(
            user,
            profile
          );


          alert(
            "Google Login সফল হয়েছে!"
          );


          window.location.href =
            "profile.html";

        })
        .catch((error) => {

          console.error(
            "GOOGLE REDIRECT ERROR:",
            error
          );


          showError(error);

        });

    }

  }


  // ==========================================
  // PROFILE
  // ==========================================

  if (path.includes("profile.html")) {

    const loading =
      document.getElementById(
        "profile-loading"
      );


    const content =
      document.getElementById(
        "profile-content"
      );


    const form =
      document.getElementById(
        "profile-form"
      );


    auth.onAuthStateChanged(
      async (user) => {

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


          const userName =
            document.getElementById(
              "user-name"
            );


          const userEmail =
            document.getElementById(
              "user-email"
            );


          const userRole =
            document.getElementById(
              "user-role"
            );


          const userSkills =
            document.getElementById(
              "user-skills"
            );


          const userBio =
            document.getElementById(
              "user-bio"
            );


          if (userName)
            userName.textContent =
              profile.name || "-";


          if (userEmail)
            userEmail.textContent =
              user.email || "-";


          if (userRole)
            userRole.textContent =
              profile.role || "worker";


          if (userSkills)
            userSkills.textContent =
              profile.skills || "-";


          if (userBio)
            userBio.textContent =
              profile.bio || "-";


          const profileName =
            document.getElementById(
              "profile-name"
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


          if (profileName)
            profileName.value =
              profile.name || "";


          if (profileRole)
            profileRole.value =
              profile.role || "worker";


          if (profileSkills)
            profileSkills.value =
              profile.skills || "";


          if (profileBio)
            profileBio.value =
              profile.bio || "";


          if (loading)
            loading.style.display =
              "none";


          if (content)
            content.style.display =
              "block";


          saveLocalSession(
            user,
            profile
          );


        } catch (error) {

          console.error(
            "PROFILE ERROR:",
            error
          );


          if (loading) {

            loading.textContent =
              "প্রোফাইল লোড করতে সমস্যা হয়েছে।";

          }

        }

      }
    );


    if (form) {

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();


          const user =
            auth.currentUser;


          if (!user) {

            window.location.href =
              "login.html";

            return;
          }


          const name =
            document.getElementById(
              "profile-name"
            )?.value.trim() || "";


          const role =
            document.getElementById(
              "profile-role"
            )?.value || "worker";


          const skills =
            document.getElementById(
              "profile-skills"
            )?.value.trim() || "";


          const bio =
            document.getElementById(
              "profile-bio"
            )?.value.trim() || "";


          try {

            await user.updateProfile({

              displayName:
                name

            });


            await db.collection("users")
              .doc(user.uid)
              .set({

                uid:
                  user.uid,

                name:
                  name,

                email:
                  user.email || "",

                role:
                  role,

                skills:
                  skills,

                bio:
                  bio,

                updatedAt:
                  firebase.firestore.FieldValue
                    .serverTimestamp()

              }, {
                merge: true
              });


            const profile =
              await db.collection("users")
                .doc(user.uid)
                .get();


            saveLocalSession(
              user,
              profile.exists
                ? profile.data()
                : {
                    name,
                    email: user.email || "",
                    role,
                    skills,
                    bio,
                    balance: 0,
                    pendingBalance: 0
                  }
            );


            const userName =
              document.getElementById(
                "user-name"
              );


            const userRole =
              document.getElementById(
                "user-role"
              );


            const userSkills =
              document.getElementById(
                "user-skills"
              );


            const userBio =
              document.getElementById(
                "user-bio"
              );


            if (userName)
              userName.textContent =
                name || "-";


            if (userRole)
              userRole.textContent =
                role;


            if (userSkills)
              userSkills.textContent =
                skills || "-";


            if (userBio)
              userBio.textContent =
                bio || "-";


            alert(
              "প্রোফাইল সফলভাবে Save হয়েছে!"
            );


          } catch (error) {

            showError(error);

          }

        }
      );

    }


    // ==========================================
    // LOGOUT
    // ==========================================

    const logout =
      document.getElementById(
        "logout-btn"
      );


    if (logout) {

      logout.addEventListener(
        "click",
        async () => {

          try {

            await auth.signOut();

            localStorage.removeItem(
              "currentUser"
            );

            window.location.href =
              "login.html";


          } catch (error) {

            showError(error);

          }

        }
      );

    }

  }


  // ==========================================
  // POST JOB
  // ==========================================

  if (path.includes("post-job.html")) {

    const form =
      document.getElementById(
        "job-form"
      );


    auth.onAuthStateChanged(
      (user) => {

        if (!user) {

          window.location.href =
            "login.html";

        }

      }
    );


    if (form) {

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();


          const user =
            auth.currentUser;


          if (!user) {

            alert(
              "Job Post করতে আগে Login করুন।"
            );

            window.location.href =
              "login.html";

            return;
          }


          const title =
            document.getElementById(
              "title"
            )?.value.trim() || "";


          const desc =
            document.getElementById(
              "desc"
            )?.value.trim() || "";


          const budget =
            Number(
              document.getElementById(
                "budget"
              )?.value || 0
            );


          const skills =
            document.getElementById(
              "skills"
            )?.value.trim() || "";


          const deliveryDays =
            Number(
              document.getElementById(
                "delivery-days"
              )?.value || 0
            );


          if (
            !title ||
            !desc ||
            budget <= 0
          ) {

            alert(
              "সব তথ্য সঠিকভাবে পূরণ করুন।"
            );

            return;
          }


          const button =
            document.getElementById(
              "post-job-btn"
            );


          try {

            if (button) {

              button.disabled = true;

              button.textContent =
                "Post হচ্ছে...";

            }


            await db.collection("jobs")
              .add({

                title:
                  title,

                description:
                  desc,

                budget:
                  budget,

                skills:
                  skills,

                deliveryDays:
                  deliveryDays,

                ownerId:
                  user.uid,

                ownerName:
                  user.displayName ||
                  user.email?.split("@")[0] ||
                  "Client",

                status:
                  "open",

                createdAt:
                  firebase.firestore.FieldValue
                    .serverTimestamp()

              });


            alert(
              "Job সফলভাবে Post হয়েছে!"
            );


            form.reset();


            window.location.href =
              "index.html";


          } catch (error) {

            showError(error);

          } finally {

            if (button) {

              button.disabled = false;

              button.textContent =
                "Job Post করুন";

            }

          }

        }
      );

    }

  }

});
