class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
    <header class="site-header">
      <div class="dash-menu">
        <h1>Menu</h1>
        <h3>Navigation</h3>
        <ul>
          <li><a href="dashboard.html">Home</a></li>
          <li><a href="projects.html">Projects</a></li>
          <li><a href="calendar.html">Calendar</a></li>
          <li><a href="#">Settings</a></li>
        </ul>
        <div class="header-actions">
          <button id="logoutBtn" class="logout-btn">Logout</button>
        </ul>
      </div>
    </header>
    `;
    const btn = this.querySelector('#logoutBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (typeof logout === 'function') {
          logout();
        } else {
          localStorage.removeItem('currentUser');
          location.href = 'login.html';
        }
      });
    }
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <p>&copy; 2026 Project Manager. All rights reserved.</p>
      </div>
    </footer>
    `;
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
