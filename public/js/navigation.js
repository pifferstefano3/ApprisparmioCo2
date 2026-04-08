/**
 * VERDENT - Shared Navigation Component
 * Eco-friendly glassmorphism bottom navigation
 */

class BottomNavigation {
  constructor() {
    this.currentPage = window.location.pathname.split('/').pop() || 'index.html';
    this.navItems = [
      { id: 'home', icon: '🏠', label: 'Home', href: '/dashboard.html' },
      { id: 'feed', icon: '📸', label: 'EcoFeed', href: '/feed.html' },
      { id: 'map', icon: '🗺️', label: 'Mappe', href: '/map.html' },
      { id: 'chat', icon: '💬', label: 'Chat', href: '/chat.html' },
      { id: 'profile', icon: '👤', label: 'Profilo', href: '/profile.html' }
    ];
    this.init();
  }

  init() {
    // Remove existing navigation
    const existingNav = document.querySelector('.bottom-nav');
    if (existingNav) existingNav.remove();

    // Create navigation container
    this.nav = document.createElement('nav');
    this.nav.className = 'bottom-nav';
    this.nav.setAttribute('role', 'navigation');
    this.nav.setAttribute('aria-label', 'Navigazione principale');

    // Create nav items
    this.navItems.forEach(item => {
      const isActive = this.currentPage.includes(item.id) || 
                      (item.id === 'home' && this.currentPage === 'dashboard.html');
      
      const button = document.createElement('a');
      button.href = item.href;
      button.className = `nav-item ${isActive ? 'active' : ''}`;
      button.setAttribute('data-page', item.id);
      button.innerHTML = `
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      `;
      
      button.addEventListener('click', (e) => this.handleNavClick(e, item));
      this.nav.appendChild(button);
    });

    // Append to body
    document.body.appendChild(this.nav);
    
    // Add padding to body to account for nav height
    document.body.classList.add('pb-nav');
  }

  handleNavClick(e, item) {
    // Visual feedback
    const allItems = this.nav.querySelectorAll('.nav-item');
    allItems.forEach(i => i.classList.remove('active'));
    e.currentTarget.classList.add('active');
  }

  setActivePage(pageId) {
    const items = this.nav.querySelectorAll('.nav-item');
    items.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-page') === pageId);
    });
  }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.bottomNav = new BottomNavigation();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BottomNavigation;
}
