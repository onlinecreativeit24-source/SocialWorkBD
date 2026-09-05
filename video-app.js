/*
==================================================
SocialWorkBD
VIDEO APP
Watch Time + MHR GOLD
==================================================

Fixed Reward:
50 minutes = 100 MHR GOLD
1 minute = 2 MHR GOLD

Important:
This is an initial client-side reward system.
Production security should later validate rewards
on a trusted backend.
*/

document.addEventListener("DOMContentLoaded", () => {

  if (!window.auth || !window.db) {
    console.error("Firebase Auth/Firestore not available.");
    return;
  }

  // ==========================================
  // MHR GOLD SETTINGS
  // ==========================================

  const GOLD_PER_MINUTE = 2;
  const GOLD_PER_TAKA = 100;

  // Reward only after a complete valid minute.
  const REWARD_INTERVAL = 60;

  // ==========================================
  // Helper
  // ==========================================

  function getCurrentUser() {
    return auth.currentUser;
  }

  function showMessage(message) {
    alert(message);
  }

  function saveLocalGold(gold) {

    const current =
      JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );

    current.balance =
      Number(current.balance || 0) +
      Number(gold || 0);

    localStorage.setItem(
      "currentUser",
      JSON.stringify(current)
    );
  }

  // ==========================================
  // WATCH TIME SYSTEM
  // ==========================================

  function setupVideoReward(
    videoElement,
    videoId,
    ownerId,
    goldElement,
    watchElement
  ) {

    let watchSeconds = 0;
    let rewardedMinutes = 0;
    let started = false;
    let lastTime = null;

    /*
     * Do not reward video owner
     * for watching their own video.
     */

    videoElement.addEventListener(
      "play",
      () => {

        const user =
          getCurrentUser();

        if (!user) {
          videoElement.pause();

          showMessage(
            "ভিডিও দেখতে আগে Login করুন।"
          );

          return;
        }

        if (
          ownerId &&
          user.uid === ownerId
        ) {

          watchElement.textContent =
            "নিজের ভিডিও — Reward নেই";

          return;
        }

        started = true;

        lastTime =
          Date.now();

      }
    );


    /*
     * Count real playing time.
     */

    videoElement.addEventListener(
      "timeupdate",
      async () => {

        const user =
          getCurrentUser();

        if (
          !user ||
          !started
        ) {
          return;
        }

        if (
          ownerId &&
          user.uid === ownerId
        ) {
          return;
        }

        if (
          videoElement.paused ||
          videoElement.ended
        ) {
          return;
        }

        const now =
          Date.now();

        if (lastTime === null) {
          lastTime = now;
          return;
        }

        const elapsed =
          (now - lastTime) / 1000;

        /*
         * Prevent abnormal jumps.
         */

        if (
          elapsed > 5
        ) {

          lastTime = now;
          return;

        }

        if (
          elapsed < 0
        ) {

          lastTime = now;
          return;

        }

        watchSeconds +=
          elapsed;

        lastTime =
          now;


        const completeMinutes =
          Math.floor(
            watchSeconds /
            REWARD_INTERVAL
          );


        if (
          completeMinutes >
          rewardedMinutes
        ) {

          const newMinutes =
            completeMinutes -
            rewardedMinutes;

          rewardedMinutes =
            completeMinutes;


          const gold =
            newMinutes *
            GOLD_PER_MINUTE;


          watchElement.textContent =
            "Watch Time: " +
            formatTime(
              watchSeconds
            );


          goldElement.textContent =
            "🪙 Session Earned: " +
            gold +
            " MHR GOLD";


          await addWatchReward(
            videoId,
            user.uid,
            newMinutes,
            gold
          );

        } else {

          watchElement.textContent =
            "Watch Time: " +
            formatTime(
              watchSeconds
            );

        }

      }
    );


    /*
     * Reset timer state when paused.
     */

    videoElement.addEventListener(
      "pause",
      () => {

        lastTime = null;

      }
    );


    /*
     * End of video.
     */

    videoElement.addEventListener(
      "ended",
      () => {

        lastTime = null;

        watchElement.textContent =
          "Watch Time: " +
          formatTime(
            watchSeconds
          );

      }
    );

  }


  // ==========================================
  // ADD WATCH REWARD
  // ==========================================

  async function addWatchReward(
    videoId,
    uid,
    minutes,
    gold
  ) {

    if (
      !videoId ||
      !uid ||
      minutes <= 0 ||
      gold <= 0
    ) {
      return;
    }


    try {

      /*
       * One reward document for this
       * user + video session.
       */

      const rewardRef =
        db.collection("videoRewards")
          .doc(
            videoId +
            "_" +
            uid
          );


      await db.runTransaction(
        async (transaction) => {

          const rewardDoc =
            await transaction.get(
              rewardRef
            );

          let oldMinutes = 0;
          let oldGold = 0;

          if (
            rewardDoc.exists
          ) {

            const data =
              rewardDoc.data() || {};

            oldMinutes =
              Number(
                data.watchMinutes || 0
              );

            oldGold =
              Number(
                data.gold || 0
              );

          }


          const newMinutes =
            oldMinutes +
            minutes;

          const newGold =
            oldGold +
            gold;


          transaction.set(
            rewardRef,
            {

              videoId:
                videoId,

              userId:
                uid,

              watchMinutes:
                newMinutes,

              gold:
                newGold,

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp(),

              createdAt:
                rewardDoc.exists
                  ? (
                      rewardDoc.data()
                        .createdAt ||
                      firebase.firestore
                        .FieldValue
                        .serverTimestamp()
                    )
                  :
                    firebase.firestore
                      .FieldValue
                      .serverTimestamp()

            },
            {
              merge: true
            }
          );

        }
      );


      /*
       * Update user's MHR GOLD.
       */

      const userRef =
        db.collection("users")
          .doc(uid);


      await db.runTransaction(
        async (transaction) => {

          const userDoc =
            await transaction.get(
              userRef
            );

          let oldBalance = 0;

          if (
            userDoc.exists
          ) {

            const data =
              userDoc.data() || {};

            oldBalance =
              Number(
                data.balance || 0
              );

          }


          const newBalance =
            oldBalance +
            gold;


          transaction.set(
            userRef,
            {

              balance:
                newBalance,

              updatedAt:
                firebase.firestore
                  .FieldValue
                  .serverTimestamp()

            },
            {
              merge: true
            }
          );

        }
      );


      /*
       * Update local display.
       */

      saveLocalGold(gold);


      const balanceElement =
        document.getElementById(
          "mhr-balance"
        );

      if (
        balanceElement
      ) {

        const current =
          JSON.parse(
            localStorage.getItem(
              "currentUser"
            ) || "{}"
          );

        balanceElement.textContent =
          Number(
            current.balance || 0
          ) +
          " MHR GOLD";

      }


    } catch (error) {

      console.error(
        "REWARD ERROR:",
        error
      );

    }

  }


  // ==========================================
  // FORMAT TIME
  // ==========================================

  function formatTime(
    seconds
  ) {

    seconds =
      Math.floor(
        Number(seconds || 0)
      );

    const minutes =
      Math.floor(
        seconds / 60
      );

    const remaining =
      seconds % 60;

    return (
      minutes +
      ":" +
      String(
        remaining
      ).padStart(
        2,
        "0"
      )
    );

  }


  // ==========================================
  // VIEW COUNTER
  // ==========================================

  async function countVideoView(
    videoId,
    userId,
    viewElement
  ) {

    if (
      !videoId ||
      !userId
    ) {
      return;
    }


    try {

      const viewRef =
        db.collection("videos")
          .doc(videoId)
          .collection("viewers")
          .doc(userId);


      const viewDoc =
        await viewRef.get();


      /*
       * One view per user per video.
       */

      if (
        viewDoc.exists
      ) {
        return;
      }


      await viewRef.set({

        userId:
          userId,

        viewedAt:
          firebase.firestore
            .FieldValue
            .serverTimestamp()

      });


      await db.collection("videos")
        .doc(videoId)
        .update({

          views:
            firebase.firestore
              .FieldValue
              .increment(1)

        });


      if (
        viewElement
      ) {

        const current =
          Number(
            viewElement.dataset.views ||
            0
          ) + 1;

        viewElement.dataset.views =
          current;

        viewElement.textContent =
          "👁️ Views: " +
          current;

      }


    } catch (error) {

      console.error(
        "VIEW ERROR:",
        error
      );

    }

  }


  // ==========================================
  // CONNECT TO VIDEO CARDS
  // ==========================================

  window.SocialWorkVideo = {

    setupVideoReward:
      setupVideoReward,

    countVideoView:
      countVideoView,

    formatTime:
      formatTime,

    GOLD_PER_MINUTE:
      GOLD_PER_MINUTE,

    GOLD_PER_TAKA:
      GOLD_PER_TAKA

  };


});
