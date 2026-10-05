/* =========================================================
   SocialWorkBD - Security Utilities
   ========================================================= */

function securelyStoreUser(user) {
  if (!user) {
    localStorage.removeItem('currentUser');
    return;
  }

  const safeData = {
    id: user.uid || user.id,
    name: user.name || '',
    email: user.email || '',
    accountId: user.accountId || '',
    role: user.role || 'worker'
  };

  localStorage.setItem('currentUser', JSON.stringify(safeData));
}

function clearUserData() {
  localStorage.removeItem('currentUser');
  sessionStorage.clear();
}

function isUserSessionExpired(maxAgeMs = 3600000) {
  const stored = sessionStorage.getItem('userSessionTime');
  if (!stored) {
    sessionStorage.setItem('userSessionTime', Date.now().toString());
    return false;
  }

  const pausedAt = parseInt(stored, 10);
  const elapsed = Date.now() - pausedAt;
  if (elapsed > maxAgeMs) {
    clearUserData();
    return true;
  }

  return false;
}

window.SecurityUtils = {
  securelyStoreUser,
  clearUserData,
  isUserSessionExpired
};
