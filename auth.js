// auth.js
function isLoggedIn() {
  return !!localStorage.getItem('currentUser');
}

function requireAuth() {
  if (!isLoggedIn()) {
    // optional: remember attempted URL so user returns after login
    localStorage.setItem('postLoginRedirect', location.pathname + location.search);
    location.href = 'login.html';
  }
}

function logout() {
  // remove stored credentials for the current user from localStorage
  const user = localStorage.getItem('currentUser');
  if (user) {
    const raw = localStorage.getItem('users');
    const users = raw ? JSON.parse(raw) : {};
    if (users[user]) {
      delete users[user];
      localStorage.setItem('users', JSON.stringify(users));
    }
  }
  // remove session markers
  localStorage.removeItem('currentUser');
  localStorage.removeItem('postLoginRedirect');
  // optional: clear other session data
  // localStorage.removeItem('someSessionKey');
  location.href = 'login.html';
}