document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // SocialWorkBD - Tasks System
  // ==========================================

  if (!window.auth || !window.db) {
    console.error("Firebase Auth/Firestore পাওয়া যায়নি।");
    return;
  }

  const taskForm =
    document.getElementById("task-form");

  const linksContainer =
    document.getElementById("task-links-container");

  const addLinkButton =
    document.getElementById("add-link-btn");

  const taskList =
    document.getElementById("task-list");


  // ==========================================
  // নতুন Link Input যোগ করা
  // ==========================================

  function addLinkInput(value = "") {

    if (!linksContainer) return;

    const row =
      document.createElement("div");

    row.className =
      "task-link-row";

    row.style.display =
      "flex";

    row.style.gap =
      "8px";

    row.style.marginBottom =
      "10px";


    const input =
      document.createElement("input");

    input.type =
      "url";

    input.className =
      "task-link-input";

    input.placeholder =
      "https://example.com";

    input.value =
      value;

    input.style.flex =
      "1";


    const removeButton =
      document.createElement("button");

    removeButton.type =
      "button";

    removeButton.textContent =
      "×";

    removeButton.className =
      "remove-link-btn";

    removeButton.style.width =
      "42px";


    removeButton.addEventListener(
      "click",
      () => {

        row.remove();

      }
    );


    row.appendChild(input);

    row.appendChild(removeButton);

    linksContainer.appendChild(row);

  }


  // ==========================================
  // Add More Button
  // ==========================================

  if (addLinkButton) {

    addLinkButton.addEventListener(
      "click",
      () => {

        addLinkInput();

      }
    );

  }


  // ==========================================
  // প্রথম Link Box
  // ==========================================

  if (
    linksContainer &&
    linksContainer.children.length === 0
  ) {

    addLinkInput();

  }


  // ==========================================
  // Task Submit
  // ==========================================

  if (taskForm) {

    taskForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        const user =
          auth.currentUser;


        if (!user) {

          alert(
            "Task তৈরি করতে আগে Login করুন।"
          );

          window.location.href =
            "login.html";

          return;

        }


        const title =
          document
            .getElementById("task-title")
            ?.value
            .trim() || "";


        const description =
          document
            .getElementById("task-description")
            ?.value
            .trim() || "";


        const reward =
          Number(
            document
              .getElementById("task-reward")
              ?.value || 0
          );


        const taskType =
          document
            .getElementById("task-type")
            ?.value || "link_visit";


        // ======================================
        // Validation
        // ======================================

        if (!title) {

          alert(
            "Task-এর নাম লিখুন।"
          );

          return;

        }


        if (reward <= 0) {

          alert(
            "Reward লিখুন।"
          );

          return;

        }


        // ======================================
        // সব Link সংগ্রহ
        // ======================================

        const linkInputs =
          document.querySelectorAll(
            ".task-link-input"
          );


        const links = [];


        linkInputs.forEach(
          (input) => {

            const value =
              input.value.trim();

            if (value) {

              links.push(value);

            }

          }
        );


        if (links.length === 0) {

          alert(
            "কমপক্ষে একটি Link দিন।"
          );

          return;

        }


        // ======================================
        // Submit Button
        // ======================================

        const submitButton =
          document.getElementById(
            "create-task-btn"
          );


        try {

          if (submitButton) {

            submitButton.disabled =
              true;

            submitButton.textContent =
              "Task তৈরি হচ্ছে...";

          }


          // ====================================
          // Task Save to Firestore
          // ====================================

          await db.collection("tasks")
            .add({

              title:
                title,

              description:
                description,

              taskType:
                taskType,

              links:
                links,

              reward:
                reward,

              rewardCurrency:
                "MHR GOLD",

              ownerId:
                user.uid,

              ownerName:
                user.displayName ||
                user.email?.split("@")[0] ||
                "Client",

              status:
                "open",

              totalCompleted:
                0,

              createdAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp(),

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()

            });


          alert(
            "Task সফলভাবে তৈরি হয়েছে!"
          );


          taskForm.reset();


          // পুরোনো Link Box মুছুন
          if (linksContainer) {

            linksContainer.innerHTML =
              "";

            // আবার একটি খালি Link Box
            addLinkInput();

          }


          window.location.href =
            "tasks.html";


        } catch (error) {

          console.error(
            "TASK CREATE ERROR:",
            error
          );


          alert(
            "Task তৈরি করা যায়নি।\n\n" +
            (
              error.message ||
              "Unknown error"
            )
          );

        } finally {

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              "Task তৈরি করুন";

          }

        }

      }
    );

  }


  // ==========================================
  // Task List Load
  // ==========================================

  async function loadTasks() {

    if (!taskList) return;


    taskList.innerHTML =
      "<p>Task লোড হচ্ছে...</p>";


    try {

      const snapshot =
        await db.collection("tasks")
          .orderBy(
            "createdAt",
            "desc"
          )
          .limit(50)
          .get();


      taskList.innerHTML =
        "";


      if (snapshot.empty) {

        taskList.innerHTML =
          "<p>এখনো কোনো Task নেই।</p>";

        return;

      }


      snapshot.forEach(
        (doc) => {

          const task =
            doc.data() || {};


          if (
            task.status !== "open"
          ) {

            return;

          }


          const card =
            document.createElement(
              "div"
            );

          card.className =
            "task-card";


          card.style.background =
            "#ffffff";

          card.style.padding =
            "16px";

          card.style.borderRadius =
            "12px";

          card.style.marginBottom =
            "12px";

          card.style.boxShadow =
            "0 2px 10px rgba(0,0,0,0.08)";


          const title =
            document.createElement(
              "h3"
            );

          title.textContent =
            task.title ||
            "Untitled Task";


          const description =
            document.createElement(
              "p"
            );

          description.textContent =
            task.description ||
            "";


          const reward =
            document.createElement(
              "p"
            );

          reward.innerHTML =
            "<strong>🪙 Reward: " +
            Number(task.reward || 0) +
            " MHR GOLD</strong>";


          const type =
            document.createElement(
              "p"
            );

          type.textContent =
            "Task: " +
            (
              task.taskType ===
              "link_share"

                ? "Link Share"

                : "Link Visit"
            );


          card.appendChild(title);

          card.appendChild(description);

          card.appendChild(type);

          card.appendChild(reward);


          // ====================================
          // Links
          // ====================================

          const links =
            Array.isArray(task.links)
              ? task.links
              : [];


          links.forEach(
            (link, index) => {

              const linkButton =
                document.createElement(
                  "a"
                );

              linkButton.href =
                link;

              linkButton.target =
                "_blank";

              linkButton.rel =
                "noopener noreferrer";

              linkButton.textContent =
                "🔗 Link " +
                (index + 1);

              linkButton.className =
                "task-link-button";

              linkButton.style.display =
                "inline-block";

              linkButton.style.margin =
                "5px";

              linkButton.style.padding =
                "8px 12px";

              linkButton.style.borderRadius =
                "8px";

              linkButton.style.textDecoration =
                "none";


              card.appendChild(
                linkButton
              );

            }
          );


          taskList.appendChild(
            card
          );

        }
      );


      if (
        taskList.innerHTML.trim() === ""
      ) {

        taskList.innerHTML =
          "<p>এখন কোনো Open Task নেই।</p>";

      }


    } catch (error) {

      console.error(
        "TASK LOAD ERROR:",
        error
      );


      taskList.innerHTML =
        "<p>Task লোড করতে সমস্যা হয়েছে।</p>";

    }

  }


  // ==========================================
  // Load Tasks
  // ==========================================

  loadTasks();

});
