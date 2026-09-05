document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // SocialWorkBD - TASK SYSTEM
  // ==========================================

  if (!window.auth || !window.db) {
    console.error("Firebase Auth/Firestore পাওয়া যায়নি।");
    return;
  }

  const taskForm =
    document.getElementById("task-form");

  const taskLinksContainer =
    document.getElementById("task-links-container");

  const addLinkBtn =
    document.getElementById("add-link-btn");

  const taskList =
    document.getElementById("task-list");


  // ==========================================
  // CREATE LINK INPUT
  // ==========================================

  function addLinkInput(value = "") {

    const row =
      document.createElement("div");

    row.className =
      "task-link-row";

    row.innerHTML = `
      <input
        type="url"
        class="task-link-input"
        placeholder="https://example.com/..."
        value="${value}"
        required
      >

      <button
        type="button"
        class="remove-link-btn"
        title="Remove"
      >×</button>
    `;

    const removeBtn =
      row.querySelector(".remove-link-btn");

    removeBtn.addEventListener(
      "click",
      () => {

        const rows =
          taskLinksContainer.querySelectorAll(
            ".task-link-row"
          );

        // অন্তত ১টি Link রাখবে
        if (rows.length <= 1) {

          alert(
            "কমপক্ষে ১টি Task Link রাখতে হবে।"
          );

          return;
        }

        row.remove();
      }
    );

    taskLinksContainer.appendChild(row);
  }


  // প্রথম Link
  if (taskLinksContainer) {
    addLinkInput();
  }


  // ==========================================
  // ADD MORE LINK
  // ==========================================

  if (addLinkBtn) {

    addLinkBtn.addEventListener(
      "click",
      () => {

        addLinkInput();

      }
    );

  }


  // ==========================================
  // LOAD TASKS
  // ==========================================

  async function loadTasks() {

    if (!taskList) return;

    taskList.innerHTML =
      "<p>Task লোড হচ্ছে...</p>";

    try {

      const snapshot =
        await db.collection("tasks")
          .where("status", "==", "open")
          .get();

      if (snapshot.empty) {

        taskList.innerHTML =
          "<p>এখনো কোনো Task পাওয়া যায়নি।</p>";

        return;
      }


      taskList.innerHTML = "";


      snapshot.forEach((doc) => {

        const task =
          doc.data();

        const card =
          document.createElement("div");

        card.style.background =
          "#ffffff";

        card.style.padding =
          "16px";

        card.style.marginBottom =
          "12px";

        card.style.borderRadius =
          "12px";

        card.style.boxShadow =
          "0 2px 10px rgba(0,0,0,0.07)";


        const links =
          Array.isArray(task.links)
            ? task.links
            : [];


        let linksHTML = "";

        links.forEach((link, index) => {

          linksHTML += `
            <a
              href="${link}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display:block;
                margin-top:6px;
                color:#2563eb;
                word-break:break-all;
              "
            >
              🔗 Link ${index + 1}
            </a>
          `;

        });


        card.innerHTML = `

          <h3 style="margin-top:0;">
            ${escapeHTML(task.title || "Task")}
          </h3>

          <p>
            ${escapeHTML(
              task.description || ""
            )}
          </p>

          <p>
            <strong>Type:</strong>
            ${task.type === "link_share"
              ? "Link Share"
              : "Link Visit"}
          </p>

          <p>
            <strong>Reward:</strong>
            ${Number(task.reward || 0)}
            MHR GOLD
          </p>

          <div>
            ${linksHTML}
          </div>

          <button
            class="small-task-btn"
            data-task-id="${doc.id}"
            style="
              margin-top:12px;
              padding:8px 14px;
              border:0;
              border-radius:8px;
              background:#2563eb;
              color:white;
              font-weight:600;
              cursor:pointer;
            "
          >
            Task করুন
          </button>

        `;


        const taskButton =
          card.querySelector(
            ".small-task-btn"
          );


        taskButton.addEventListener(
          "click",
          () => {

            alert(
              "Task গ্রহণ করার পরের ধাপ আমরা পরের অংশে যুক্ত করব।"
            );

          }
        );


        taskList.appendChild(card);

      });

    } catch (error) {

      console.error(
        "TASK LOAD ERROR:",
        error
      );

      taskList.innerHTML =
        "<p>Task লোড করা যায়নি। Firestore Rules পরীক্ষা করুন।</p>";
    }

  }


  // ==========================================
  // CREATE TASK
  // ==========================================

  if (taskForm) {

    taskForm.addEventListener(
      "submit",
      async (e) => {

        e.preventDefault();


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
          document.getElementById(
            "task-title"
          )?.value.trim() || "";


        const description =
          document.getElementById(
            "task-description"
          )?.value.trim() || "";


        const type =
          document.getElementById(
            "task-type"
          )?.value || "link_visit";


        const reward =
          Number(
            document.getElementById(
              "task-reward"
            )?.value || 0
          );


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


        // Validation

        if (!title) {

          alert(
            "Task-এর নাম লিখুন।"
          );

          return;
        }


        if (reward <= 0) {

          alert(
            "সঠিক Reward দিন।"
          );

          return;
        }


        if (links.length === 0) {

          alert(
            "কমপক্ষে ১টি Link দিন।"
          );

          return;
        }


        const button =
          document.getElementById(
            "create-task-btn"
          );


        try {

          if (button) {

            button.disabled = true;

            button.textContent =
              "Task তৈরি হচ্ছে...";

          }


          const taskData = {

            title:
              title,

            description:
              description,

            type:
              type,

            reward:
              reward,

            links:
              links,

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
                .serverTimestamp(),

            updatedAt:
              firebase.firestore.FieldValue
                .serverTimestamp()

          };


          await db.collection("tasks")
            .add(taskData);


          alert(
            "Task সফলভাবে তৈরি হয়েছে!"
          );


          taskForm.reset();


          taskLinksContainer.innerHTML =
            "";

          addLinkInput();


          await loadTasks();


        } catch (error) {

          console.error(
            "TASK CREATE ERROR:",
            error
          );

          alert(
            "Task তৈরি করা যায়নি।\n\nFirebase Error: " +
            (error.code || "unknown")
          );


        } finally {

          if (button) {

            button.disabled = false;

            button.textContent =
              "Task তৈরি করুন";

          }

        }

      }
    );

  }


  // ==========================================
  // HTML ESCAPE
  // ==========================================

  function escapeHTML(value) {

    const div =
      document.createElement("div");

    div.textContent =
      String(value);

    return div.innerHTML;

  }


  // ==========================================
  // AUTH + LOAD
  // ==========================================

  auth.onAuthStateChanged(
    (user) => {

      if (user) {

        loadTasks();

      } else {

        // Task দেখা যাবে,
        // কিন্তু তৈরি করতে Login লাগবে।

        loadTasks();

      }

    }
  );

});
