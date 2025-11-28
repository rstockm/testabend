/**
 * Mobile Navigation (Burger-Menü) Logik
 */

/**
 * Mobile Navigation initialisieren
 */
export function setupMobileNavigation() {
  const burgerButton = document.getElementById('burger-menu-button');
  const overlay = document.getElementById('mobile-nav-overlay');
  const mobileNavLinks = overlay?.querySelectorAll('nav a');
  
  if (!burgerButton || !overlay) {
    console.warn('Mobile Navigation Elemente nicht gefunden');
    return;
  }
  
  // Burger-Button Click: Menü öffnen/schließen
  burgerButton.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileMenu();
  });
  
  // Overlay Click (außerhalb Panel): Menü schließen
  overlay.addEventListener('click', (e) => {
    // Nur schließen wenn direkt auf Overlay geklickt (nicht auf Panel)
    if (e.target === overlay) {
      closeMobileMenu();
    }
  });
  
  // Mobile Navigation Links: Menü schließen nach Klick
  if (mobileNavLinks) {
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        // Kleine Verzögerung für bessere UX (Animation sichtbar)
        setTimeout(() => {
          closeMobileMenu();
        }, 150);
      });
    });
  }
  
  // ESC-Taste: Menü schließen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMobileMenuOpen()) {
      closeMobileMenu();
    }
  });
  
  // Hash-Change: Menü schließen (wenn Route wechselt)
  window.addEventListener('hashchange', () => {
    if (isMobileMenuOpen()) {
      closeMobileMenu();
    }
  });
}

/**
 * Mobile Menü öffnen/schließen
 */
function toggleMobileMenu() {
  const burgerButton = document.getElementById('burger-menu-button');
  const overlay = document.getElementById('mobile-nav-overlay');
  
  if (!burgerButton || !overlay) return;
  
  const isOpen = overlay.classList.contains('active');
  
  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

/**
 * Mobile Menü öffnen
 */
function openMobileMenu() {
  const burgerButton = document.getElementById('burger-menu-button');
  const overlay = document.getElementById('mobile-nav-overlay');
  
  if (!burgerButton || !overlay) return;
  
  burgerButton.classList.add('active');
  overlay.classList.add('active');
  burgerButton.setAttribute('aria-expanded', 'true');
  burgerButton.setAttribute('aria-label', 'Menü schließen');
  
  // Body Scroll verhindern wenn Menü offen
  document.body.style.overflow = 'hidden';
}

/**
 * Mobile Menü schließen
 */
function closeMobileMenu() {
  const burgerButton = document.getElementById('burger-menu-button');
  const overlay = document.getElementById('mobile-nav-overlay');
  
  if (!burgerButton || !overlay) return;
  
  burgerButton.classList.remove('active');
  overlay.classList.remove('active');
  burgerButton.setAttribute('aria-expanded', 'false');
  burgerButton.setAttribute('aria-label', 'Menü öffnen');
  
  // Body Scroll wieder erlauben
  document.body.style.overflow = '';
}

/**
 * Prüfen ob Mobile Menü offen ist
 */
function isMobileMenuOpen() {
  const overlay = document.getElementById('mobile-nav-overlay');
  return overlay?.classList.contains('active') || false;
}
