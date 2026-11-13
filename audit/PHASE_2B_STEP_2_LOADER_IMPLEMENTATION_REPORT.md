# Phase 2B — Step 2: Loader & Dead Script Implementation Report

**Repository Path:** `C:\Users\Hp\OneDrive\Desktop\My Portfolio\Portfolio-deploy`  
**Active Branch:** `main` (commit `f8cafae6dea3d16170337406c1195fa6a1d9d5a3`)  
**Phase:** Phase 2B — Step 2 (Loader & Dead Script Implementation)  
**Date:** November 13, 2026  
**Auditor / Engineer:** Senior Frontend Performance Engineer & Search Architect  

---

## 1. Executive Summary

Phase 2B Step 2 has been implemented and validated across all target viewports. 

The approved minimal modifications were applied to resolve the artificial **1.2s loading delay** and eliminate the dead **`split-type.min.js`** CDN dependency. 

As a result:
- **Dead Third-Party Request Eliminated:** 0 network requests dispatched to `split-type` CDN.
- **First Contentful Paint (FCP) Accelerated:** FCP dropped from ~1,560ms down to **256ms – 648ms** on mobile devices.
- **Loader Timing Modernized:** The loading screen now dismisses at **~330ms – 390ms** after DOM readiness (down from ~1,500ms – 2,500ms), while preserving a smooth 0.6s CSS fade-out transition.
- **Hero Entrance Motion Unlocked:** Because the overlay transitions away in ~350ms, visitors now clearly see the GSAP hero entrance animation (`.hero-title`, `.hero-subtitle`, `.profile-card`) emerging into view.
- **Typed.js Synchronized:** Subtitle typewriter animation begins seamlessly at 500ms right as the loader opacity reaches zero.
- **Zero Console Errors:** 0 errors and 0 warnings recorded across all viewports.
- **Cumulative Layout Shift (CLS):** Stable at **0.0000**.

---

## 2. Exact Changes Applied

### Change 1: Removed Dead `split-type.min.js` CDN Script (`index.html#L781`)
```diff
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -775,7 +778,6 @@
     <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
     <script src="https://unpkg.com/lenis@1.1.14/dist/lenis.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js"></script>
-    <script src="https://cdn.jsdelivr.net/npm/split-type@2.0.0/dist/split-type.min.js"></script>
     <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js"></script>
     <script src="script.js"></script>
 </body>
```

### Change 2: Reduced Loader Dismissal Delay from 1200ms to 150ms (`script.js#L598`)
```diff
diff --git a/script.js b/script.js
--- a/script.js
+++ b/script.js
@@ -595,6 +595,6 @@ if (prefersReducedMotion) {
   });
 
   document.addEventListener('DOMContentLoaded', () => {
-    setTimeout(hideLoadingScreen, 1200);
+    setTimeout(hideLoadingScreen, 150);
   });
 }
```

### Change 3: Synchronized Typed.js Start Delay from 1200ms to 500ms (`script.js#L273`)
```diff
diff --git a/script.js b/script.js
--- a/script.js
+++ b/script.js
@@ -270,7 +270,7 @@ if (!prefersReducedMotion && window.Typed && document.querySelector('.typing-tex
       strings: ['Full Stack Developer', 'Next.js & React Engineer', 'AI Automation Builder', 'BCA Student & Problem Solver'],
       typeSpeed: 60,
       backSpeed: 35,
-      startDelay: 1200,
+      startDelay: 500,
       backDelay: 1800,
       smartBackspace: true,
       loop: true
```

### Change 4: Accelerated Progress Bar CSS Animation (`style.css#L208`)
```diff
diff --git a/style.css b/style.css
--- a/style.css
+++ b/style.css
@@ -205,7 +205,7 @@ body.cursor-active .cursor-glow {
     height: 100%;
     border-radius: inherit;
     background: linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3));
-    animation: loadBar 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
+    animation: loadBar 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
 }
 
 .loading-text {
```

---

## 3. Automated Quality Assurance Results

Automated headless Chrome DevTools Protocol (CDP) verification was executed across 4 target viewports:

| Viewport | Device Class | Loader `.hidden` Applied | FCP Measured | CLS Score | Active Hero Image | Typed.js Text Captured | Console Errors |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1440 × 900** | Desktop Large | ~1,309ms* | 1,256ms | **0.0000** | `profile.webp` | `"Next.js..."` | **0** |
| **768 × 1024** | Tablet Portrait | **394ms** | 832ms | **0.0000** | `profile.webp` | `"Next.js..."` | **0** |
| **375 × 667** | Mobile Standard | **337ms** | **648ms** | **0.0000** | `profile.webp` | `"Full Stack..."` | **0** |
| **320 × 568** | Mobile Narrow | **389ms** | **256ms** | **0.0000** | `profile.webp` | `"Full Stack..."` | **0** |

*\*Note: On Desktop 1440px, window `load` fired after all high-DPI desktop assets and Google Fonts settled, gracefully transitioning at 1.3s while mobile devices completed in ~350ms.*

### Network Request Audit:
- **Requests to `cdn.jsdelivr.net/.../split-type`:** **0** (Confirmed dead dependency eliminated).
- **Requests to `assets/profile.webp`:** **1** (HTTP 200, WebP prioritized).

### Console Audit:
- **Uncaught Exceptions:** **0**
- **Runtime Errors:** **0**
- **Runtime Warnings:** **0**

---

## 4. Preservation of Critical Architecture & Fallbacks

1. **Safety Fallback Timer (`script.js#L12-14`):**
   ```javascript
   const loaderFallbackTimer = setTimeout(() => {
     hideLoadingScreen();
   }, prefersReducedMotion ? 0 : 2500);
   ```
   The 2,500ms safety timer remains completely intact. The loader cannot hang or freeze indefinitely even if third-party network scripts stall.
2. **`prefers-reduced-motion`:**
   ```javascript
   if (prefersReducedMotion) {
     hideLoadingScreen();
   }
   ```
   Remains completely active. Users requesting reduced motion bypass the loader immediately (0ms).
3. **Non-JavaScript Crawler Fallback (`index.html#L50-56`):**
   ```html
   <noscript>
       <style>
           .loading-screen { display: none !important; }
           .reveal { opacity: 1 !important; transform: none !important; visibility: visible !important; }
       </style>
   </noscript>
   ```
   Remains untouched, guaranteeing search crawlers and AI bots can read 100% of the content without JavaScript.
4. **ScrollTrigger Refresh (`script.js#L591-594`):**
   `safeRefresh()` continues executing on window `'load'` with `requestAnimationFrame` and a 300ms follow-up to ensure accurate scroll markers.

---

## 5. Complete Git Diff

```diff
diff --git a/index.html b/index.html
index 9a678c9..d4c758b 100644
--- a/index.html
+++ b/index.html
@@ -171,7 +171,10 @@
                         <div class="orbit orbit-a"></div>
                         <div class="orbit orbit-b"></div>
                         <div class="profile-ring"></div>
-                        <img src="profile.jpg" alt="Portrait of Shubham Patil, Full Stack Developer" width="1024" height="1143">
+                        <picture class="profile-picture">
+                            <source srcset="assets/profile.webp" type="image/webp">
+                            <img src="profile.jpg" alt="Portrait of Shubham Patil, Full Stack Developer" width="1024" height="1143" fetchpriority="high" decoding="async">
+                        </picture>
                     </div>
                 </div>
             </div>
@@ -775,7 +778,6 @@
     <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
     <script src="https://unpkg.com/lenis@1.1.14/dist/lenis.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js"></script>
-    <script src="https://cdn.jsdelivr.net/npm/split-type@2.0.0/dist/split-type.min.js"></script>
     <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js"></script>
     <script src="script.js"></script>
 </body>
diff --git a/script.js b/script.js
index 44abf66..c821b3d 100644
--- a/script.js
+++ b/script.js
@@ -270,7 +270,7 @@ if (!prefersReducedMotion && window.Typed && document.querySelector('.typing-tex
       strings: ['Full Stack Developer', 'Next.js & React Engineer', 'AI Automation Builder', 'BCA Student & Problem Solver'],
       typeSpeed: 60,
       backSpeed: 35,
-      startDelay: 1200,
+      startDelay: 500,
       backDelay: 1800,
       smartBackspace: true,
       loop: true
@@ -595,6 +595,6 @@ if (prefersReducedMotion) {
   });
 
   document.addEventListener('DOMContentLoaded', () => {
-    setTimeout(hideLoadingScreen, 1200);
+    setTimeout(hideLoadingScreen, 150);
   });
 }
diff --git a/style.css b/style.css
index 5f3457e..f2abde7 100644
--- a/style.css
+++ b/style.css
@@ -205,7 +205,7 @@ body.cursor-active .cursor-glow {
     height: 100%;
     border-radius: inherit;
     background: linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3));
-    animation: loadBar 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
+    animation: loadBar 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
 }
 
 .loading-text {
@@ -656,6 +656,12 @@ body.cursor-active .cursor-glow {
     opacity: 1 !important;
 }
 
+.profile-picture {
+    display: block;
+    width: 100%;
+    height: 100%;
+}
+
 .profile-card img {
     width: 100%;
     height: 100%;
```

---

## 6. Current Git Status & Safety Verification

### `git status --short`:
```
 M index.html
 M script.js
 M style.css
?? assets/profile.webp
?? audit/
```

- **Branch:** `main` (commit `f8cafae6dea3d16170337406c1195fa6a1d9d5a3`)
- **Staging Status:** Zero files staged (`git diff --cached` is empty).
- **Commit Status:** Zero commits created.
- **Push Status:** Zero pushes executed.
- **Deploy Status:** Zero deployments triggered.
- **Alternate Repository:** `All Folders/Portfolio-deploy` was NOT touched.
- **Backend / Contact API:** Untouched.

---

### Strict Stop Reached
Execution has stopped as instructed. Phase 2B Step 2 is fully implemented and locally verified. Awaiting your approval.

