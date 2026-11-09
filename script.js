const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = reduceMotionQuery.matches;

// Touch devices (phones/tablets) get native scrolling. Lenis's smoothTouch
// inertia fights the browser's address-bar-driven viewport changes and makes
// momentum feel sluggish, so it is desktop-only.
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const loadingScreen = document.querySelector('.loading-screen');

// Immediate absolute safety fallback: guaranteed to dismiss loader even if external CDNs, fonts, or scripts hang
const loaderFallbackTimer = setTimeout(() => {
  hideLoadingScreen();
}, prefersReducedMotion ? 0 : 2500);

function hideLoadingScreen() {
  if (!loadingScreen) return;
  if (loadingScreen.classList.contains('hidden')) return;
  try {
    clearTimeout(loaderFallbackTimer);
  } catch (_) {}
  loadingScreen.classList.add('hidden');
}
const cursor = document.querySelector('.cursor');
const cursorGlow = document.querySelector('.cursor-glow');
const navbar = document.querySelector('.navbar');
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const backToTop = document.querySelector('.back-to-top');
const contactForm = document.querySelector('.contact-form');
const sections = document.querySelectorAll('main section[id]');
const navItems = document.querySelectorAll('.nav-link');
const revealItems = document.querySelectorAll('.reveal');
const magneticButtons = document.querySelectorAll('.magnetic');
const tiltItems = document.querySelectorAll('.tilt-card');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealItems.forEach((item) => revealObserver.observe(item));

if (!prefersReducedMotion) {
  document.body.classList.add('cursor-active');
}

window.addEventListener('mousemove', (event) => {
  if (prefersReducedMotion) return;
  cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  cursorGlow.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
});

let lenis = null;

if (!isTouchDevice && window.Lenis) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
    touchInertiaMultiplier: 1.6,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    syncTouch: false
  });
  window.__lenis = lenis;

  // Lenis drives the native scroll position; GSAP ScrollTrigger reads from it.
  // Wrapped in try/catch so a missing/optional library can never block the
  // rest of the script (and therefore can never trap the loading screen).
  try {
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  } catch (err) {
    console.warn('ScrollTrigger/Lenis sync failed, falling back to native scroll:', err);
    function raf(time) {
      if (lenis) lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
}

// Active Navigation State Synchronization
let isNavClicking = false;
let navClickTimer = null;

function setActiveNavItem(targetId) {
  navItems.forEach((navItem) => {
    const isTarget = navItem.getAttribute('href') === `#${targetId}`;
    navItem.classList.toggle('active', isTarget);
    if (isTarget) {
      navItem.setAttribute('aria-current', 'page');
    } else {
      navItem.removeAttribute('aria-current');
    }
  });
}

function updateActiveNav() {
  if (isNavClicking) return;

  const scrollY = window.scrollY || window.pageYOffset || 0;
  const viewportHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const navbarHeight = navbar ? navbar.offsetHeight : 74;

  // 1. Extreme Top: Home is always active
  if (scrollY < 80) {
    setActiveNavItem('home');
    return;
  }

  // 2. Extreme Bottom: Contact is active when scrolled to bottom of document
  if (scrollY + viewportHeight >= docHeight - 60) {
    setActiveNavItem('contact');
    return;
  }

  // 3. Focal gaze line in viewport coordinates:
  // Positioned just below the fixed navbar
  const gazeY = navbarHeight + 90;

  let activeId = null;
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    const rect = sec.getBoundingClientRect();
    if (rect.top <= gazeY && rect.bottom > navbarHeight) {
      activeId = sec.id;
      break;
    }
  }

  if (activeId) {
    setActiveNavItem(activeId);
  }
}

// Cancel navigation click lock immediately if user manually interacts with scroll
['wheel', 'touchmove', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => {
    if (isNavClicking) {
      isNavClicking = false;
      clearTimeout(navClickTimer);
      updateActiveNav();
    }
  }, { passive: true });
});

// Navbar / back-to-top / active nav scroll listener
let scrollTick = false;
window.addEventListener('scroll', () => {
  navbar.classList.toggle('shrink', window.scrollY > 24);
  backToTop.classList.toggle('visible', window.scrollY > 700);

  if (!scrollTick) {
    requestAnimationFrame(() => {
      updateActiveNav();
      scrollTick = false;
    });
    scrollTick = true;
  }
}, { passive: true });

if (lenis) {
  lenis.on('scroll', () => {
    updateActiveNav();
  });
}

window.addEventListener('resize', updateActiveNav, { passive: true });

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// Close mobile menu on Escape key or outside click
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navLinks.classList.contains('open')) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('click', (event) => {
  if (navLinks.classList.contains('open') && !navbar.contains(event.target)) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 760 && navLinks.classList.contains('open')) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

// Initial active nav check
updateActiveNav();

magneticButtons.forEach((button) => {
  button.addEventListener('mousemove', (event) => {
    if (prefersReducedMotion) return;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const offsetX = (x / rect.width - 0.5) * 8;
    const offsetY = (y / rect.height - 0.5) * 8;
    button.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = '';
  });

  button.addEventListener('click', (event) => {
    if (prefersReducedMotion) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = button.getBoundingClientRect();
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
});

if (!prefersReducedMotion && window.VanillaTilt) {
  VanillaTilt.init(tiltItems, {
    max: 14,
    speed: 500,
    glare: true,
    'max-glare': 0.16,
    scale: 1.02
  });
}

if (!prefersReducedMotion && window.Typed && document.querySelector('.typing-text')) {
  try {
    new Typed('.typing-text', {
      strings: ['Full Stack Developer', 'Next.js & React Engineer', 'AI Automation Builder', 'BCA Student & Problem Solver'],
      typeSpeed: 60,
      backSpeed: 35,
      startDelay: 1200,
      backDelay: 1800,
      smartBackspace: true,
      loop: true
    });
  } catch (typedErr) {
    console.warn('Typed.js initialization failed (non-fatal):', typedErr);
  }
}

if (!prefersReducedMotion && window.gsap && window.ScrollTrigger) {
  try {
    gsap.from('.hero-title', { y: 35, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.1 });
    gsap.from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.25 });
    gsap.from('.hero-description', { y: 20, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.35 });
    gsap.from('.hero-actions .btn', { y: 15, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out', delay: 0.5 });
    gsap.from('.hero-stats', { y: 15, opacity: 0, duration: 0.6, ease: 'power3.out', delay: 0.65 });
    gsap.from('.profile-card', { scale: 0.94, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.3 });

    gsap.utils.toArray('.section-title, .section-subtitle, .glass-card, .skill-card, .service-card, .project-card, .timeline-item').forEach((el) => {
      gsap.fromTo(el, { y: 28, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 86%'
        }
      });
    });
  } catch (err) {
    console.warn('GSAP animations failed (non-fatal):', err);
  }
}

if (contactForm) {
  const formStatus = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const nameInput = document.getElementById('contact-name');
  const emailInput = document.getElementById('contact-email-input');
  const messageInput = document.getElementById('contact-message');
  const hpInput = document.getElementById('contact-hp-company');

  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const messageError = document.getElementById('message-error');

  let isSubmitting = false;

  function clearErrors() {
    [nameInput, emailInput, messageInput].forEach((input) => {
      if (input) input.removeAttribute('aria-invalid');
    });
    [nameError, emailError, messageError].forEach((err) => {
      if (err) {
        err.textContent = '';
        err.classList.remove('visible');
      }
    });
  }

  function setFieldError(input, errorEl, message) {
    if (input) input.setAttribute('aria-invalid', 'true');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  function validateClientSide(name, email, message) {
    clearErrors();
    let isValid = true;

    if (!name) {
      setFieldError(nameInput, nameError, 'Please enter your name.');
      isValid = false;
    } else if (name.length < 2) {
      setFieldError(nameInput, nameError, 'Name must be at least 2 characters.');
      isValid = false;
    } else if (name.length > 100) {
      setFieldError(nameInput, nameError, 'Name cannot exceed 100 characters.');
      isValid = false;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!email) {
      setFieldError(emailInput, emailError, 'Please enter your email address.');
      isValid = false;
    } else if (email.length > 254 || !emailRegex.test(email)) {
      setFieldError(emailInput, emailError, 'Please enter a valid email address.');
      isValid = false;
    }

    if (!message) {
      setFieldError(messageInput, messageError, 'Please enter a message.');
      isValid = false;
    } else if (message.length < 10) {
      setFieldError(messageInput, messageError, 'Message must be at least 10 characters.');
      isValid = false;
    } else if (message.length > 3000) {
      setFieldError(messageInput, messageError, 'Message cannot exceed 3,000 characters.');
      isValid = false;
    }

    return isValid;
  }

  // Clear field-specific error dynamically when user starts editing
  [nameInput, emailInput, messageInput].forEach((input) => {
    if (input) {
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') {
          input.removeAttribute('aria-invalid');
          const errId = input.getAttribute('aria-describedby');
          const errEl = errId ? document.getElementById(errId) : null;
          if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
          }
        }
      });
    }
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Prevent duplicate rapid submissions
    if (isSubmitting) return;

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';
    const _hp_company = hpInput ? hpInput.value.trim() : '';

    if (!validateClientSide(name, email, message)) {
      if (formStatus) {
        formStatus.textContent = 'Please fix the highlighted fields above.';
        formStatus.className = 'form-status error';
      }
      return;
    }

    // Set loading state
    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      if (btnText) {
        btnText.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending...';
      }
    }
    if (formStatus) {
      formStatus.textContent = 'Sending your message securely...';
      formStatus.className = 'form-status info';
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          message,
          _hp_company
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        if (formStatus) {
          formStatus.textContent = data.message || 'Thank you! Your message has been sent successfully.';
          formStatus.className = 'form-status success';
        }
        contactForm.reset();
        clearErrors();
      } else {
        let errorMsg = data.error;
        if (!errorMsg) {
          if (response.status === 404) {
            errorMsg = 'Contact API endpoint not found (404). Serverless API is unavailable on this environment.';
          } else if (response.status >= 500) {
            errorMsg = `Server error (${response.status}${response.statusText ? ' ' + response.statusText : ''}). Please email directly at shubhampatil282487@gmail.com.`;
          } else {
            errorMsg = `Request failed (${response.status}${response.statusText ? ' ' + response.statusText : ''}). Please email directly at shubhampatil282487@gmail.com.`;
          }
        }
        if (formStatus) {
          formStatus.textContent = errorMsg;
          formStatus.className = 'form-status error';
        }
      }
    } catch (networkError) {
      console.error('Contact form submission error:', networkError);
      if (formStatus) {
        formStatus.textContent = 'Network error. Please check your connection or reach out via email directly.';
        formStatus.className = 'form-status error';
      }
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        if (btnText) {
          btnText.textContent = 'Send Message';
        }
      }
    }
  });
}

backToTop.addEventListener('click', (event) => {
  event.preventDefault();
  if (lenis) {
    lenis.scrollTo(0, { immediate: prefersReducedMotion });
  } else {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }
});

// Touch devices get native smooth scrolling. Lenis handles desktop only, so
// enabling scroll-behavior here would only affect the touch fallback path.
if (isTouchDevice) {
  document.documentElement.style.scrollBehavior = 'smooth';
}

// Smooth scroll for all internal anchor links (nav links, hero buttons, footer links)
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href') || '';
    if (href === '#' || !href.startsWith('#')) return;
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();

    // If target is one of the main sections, immediately synchronize active nav state
    const isNavSection = Array.from(sections).some((sec) => sec.id === id);
    if (isNavSection) {
      setActiveNavItem(id);
      isNavClicking = true;
      clearTimeout(navClickTimer);
      navClickTimer = setTimeout(() => {
        isNavClicking = false;
        updateActiveNav();
      }, 1000);
    }

    if (lenis) {
      lenis.scrollTo(target, { offset: -88, immediate: prefersReducedMotion });
    } else {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  });
});

// Dismiss skill card tooltip on mobile when tapping outside
document.addEventListener('touchstart', (event) => {
  const activeEl = document.activeElement;
  if (activeEl && activeEl.classList && activeEl.classList.contains('skill-card')) {
    if (!activeEl.contains(event.target)) {
      activeEl.blur();
    }
  }
}, { passive: true });

// Email copy button in contact info card
const copyEmailBtn = document.getElementById('copy-email-btn');
if (copyEmailBtn) {
  copyEmailBtn.addEventListener('click', async () => {
    const emailToCopy = copyEmailBtn.getAttribute('data-email') || 'shubhampatil282487@gmail.com';
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(emailToCopy);
      } else {
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = emailToCopy;
        tempTextarea.style.position = 'fixed';
        tempTextarea.style.left = '-9999px';
        document.body.appendChild(tempTextarea);
        tempTextarea.focus();
        tempTextarea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextarea);
      }
      const originalHTML = copyEmailBtn.innerHTML;
      copyEmailBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
      copyEmailBtn.classList.add('copied');
      setTimeout(() => {
        copyEmailBtn.innerHTML = originalHTML;
        copyEmailBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  });
}

function safeRefresh() {
  try {
    if (window.gsap && window.ScrollTrigger && typeof ScrollTrigger.refresh === 'function') {
      ScrollTrigger.refresh();
    }
  } catch (err) {
    console.warn('ScrollTrigger.refresh failed (non-fatal):', err);
  }
}

if (prefersReducedMotion) {
  hideLoadingScreen();
} else if (document.readyState === 'complete') {
  hideLoadingScreen();
} else {
  window.addEventListener('load', () => {
    requestAnimationFrame(safeRefresh);
    setTimeout(safeRefresh, 300);
    setTimeout(hideLoadingScreen, 200);
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(hideLoadingScreen, 1200);
  });
}
