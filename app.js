document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  // ==========================================
  // SocialWorkBD
  // Firebase Authentication + Firestore
  // ==========================================

  // ------------------------------------------
  // Profile Page
  // ------------------------------------------

  if (path.includes("profile.html")) {

    const loading =
      document.getElementById("profile-loading");

    const content =
      document.getElementById("profile-content");

    const form =
      document.getElementById("profile-form");

    if (!window.auth || !window.db) {

      if (loading) {
        loading.textContent =
          "Firebase load হয়নি।";
      }

      return;
    }

    auth.onAuthStateChanged(async (user) => {

      // User login করা না থাকলে
      if (!user) {

        alert("প্রোফাইল দেখতে আগে Login করুন।");

        window.location.href =
          "login.html";

        return;
      }

      try {

        const userRef =
          db.collection("users")
            .doc(user.uid);

        const userDoc =
          await userRef.get();

        let profile = {};

        // Firestore profile থাকলে
        if (userDoc.exists) {

          profile =
            userDoc.data();

        } else {

          // না থাকলে নতুন profile তৈরি
          profile = {

            uid: user.uid,

            name:
              user.displayName ||
              user.email?.split("@")[0] ||
              "User",

            email:
              user.email || "",

            role:
              "worker",

            skills:
              "",

            bio:
              "",

            balance:
              0,

            pendingBalance:
              0,

            createdAt:
              firebase.firestore
                .FieldValue
                .serverTimestamp()

          };

          await userRef.set(profile);

        }

        // --------------------------------
        // Profile তথ্য দেখানো
        // --------------------------------

        document.getElementById(
          "user-name"
        ).textContent =
          profile.name || "-";

        document.getElementById(
          "user-email"
        ).textContent =
          user.email || "-";

        document.getElementById(
          "user-role"
        ).textContent =
          profile.role || "worker";

        document.getElementById(
          "user-skills"
        ).textContent =
          profile.skills || "-";

        document.getElementById(
          "user-bio"
        ).textContent =
          profile.bio || "-";

        // --------------------------------
        // Form-এ পুরোনো তথ্য
        // --------------------------------

        document.getElementById(
          "profile-name"
        ).value =
          profile.name || "";

        document.getElementById(
          "profile-role"
        ).value =
          profile.role || "worker";

        document.getElementById(
          "profile-skills"
        ).value =
          profile.skills || "";

        document.getElementById(
          "profile-bio"
        ).value =
          profile.bio || "";

        // Loading শেষ
        if (loading) {

          loading.style.display =
            "none";

        }

        if (content) {

          content.style.display =
            "block";

        }

      } catch (error) {

        console.error(
          "PROFILE LOAD ERROR:",
          error
        );

        if (loading) {

          loading.textContent =
            "প্রোফাইল লোড করতে সমস্যা হয়েছে।";

        }

      }

    });

    // ------------------------------------------
    // Save Profile
    // ------------------------------------------

    if (form) {

      form.addEventListener(
        "submit",
        async (e) => {

          e.preventDefault();

          const user =
            auth.currentUser;

          if (!user) {

            alert(
              "আপনি Login করা নেই।"
            );

            window.location.href =
              "login.html";

            return;

          }

          const button =
            document.getElementById(
              "save-profile"
            );

          const name =
            document.getElementById(
              "profile-name"
            ).value.trim();

          const role =
            document.getElementById(
              "profile-role"
            ).value;

          const skills =
            document.getElementById(
              "profile-skills"
            ).value.trim();

          const bio =
            document.getElementById(
              "profile-bio"
            ).value.trim();

          try {

            if (button) {

              button.disabled = true;

              button.textContent =
                "Save হচ্ছে...";

            }

            // Firebase Auth name update
            await user.updateProfile({

              displayName:
                name

            });

            // Firestore update
            await db
              .collection("users")
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
                  firebase.firestore
                    .FieldValue
                    .serverTimestamp()

              }, {
                merge: true
              });

            // Page-এর তথ্য update
            document.getElementById(
              "user-name"
            ).textContent =
              name || "-";

            document.getElementById(
              "user-role"
            ).textContent =
              role;

            document.getElementById(
              "user-skills"
            ).textContent =
              skills || "-";

            document.getElementById(
              "user-bio"
            ).textContent =
              bio || "-";

            // Local current user update
            localStorage.setItem(
              "currentUser",
              JSON.stringify({

                id:
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
                  bio

              })
            );

            alert(
              "প্রোফাইল সফলভাবে Save হয়েছে!"
            );

          } catch (error) {

            console.error(
              "PROFILE SAVE ERROR:",
              error
            );

            alert(
              "প্রোফাইল Save করা যায়নি:\n" +
              error.message
            );

          } finally {

            if (button) {

              button.disabled = false;

              button.textContent =
                "💾 Save Profile";

            }

          }

        }
      );

    }

    // ------------------------------------------
    // Logout
    // ------------------------------------------

    const logoutButton =
      document.getElementById(
        "logout-btn"
      );

    if (logoutButton) {

      logoutButton.addEventListener(
        "click",
        async () => {

          try {

            await auth.signOut();

            localStorage.removeItem(
              "currentUser"
            );

            alert(
              "আপনি সফলভাবে Logout করেছেন।"
            );

            window.location.href =
              "login.html";

          } catch (error) {

            console.error(
              "LOGOUT ERROR:",
              error
            );

            alert(
              "Logout করতে সমস্যা হয়েছে।"
            );

          }

        }
      );

    }

  }

});
