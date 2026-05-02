// ============================================
//  PWA Install Logic
//  - Registers service worker
//  - Handles beforeinstallprompt (Chrome/Edge/Android)
//  - Shows iOS Safari fallback instructions
// ============================================

let deferredPrompt = null;

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
            .catch((err) => console.error('[PWA] SW registration failed:', err));
    });
}

// --- Detect Platform ---
function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

// --- beforeinstallprompt (Chrome, Edge, Android) ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Don't show if user dismissed recently
    const dismissed = localStorage.getItem('luxe_pwa_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Show install banner after a short delay
    setTimeout(() => {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.add('show');
    }, 3000);
});

// --- Install Button ---
document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-dismiss-btn');
    const banner = document.getElementById('pwa-install-banner');

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            console.log('[PWA] Install choice:', result.outcome);
            deferredPrompt = null;
            if (banner) banner.classList.remove('show');
        });
    }

    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            if (banner) banner.classList.remove('show');
            localStorage.setItem('luxe_pwa_dismissed', Date.now().toString());
        });
    }

    // --- iOS Safari Fallback ---
    // Show manual instruction modal on iOS if not already installed
    if (isIOS() && !isInStandaloneMode()) {
        const iosDismissed = localStorage.getItem('luxe_pwa_ios_dismissed');
        if (!iosDismissed || Date.now() - parseInt(iosDismissed) > 14 * 24 * 60 * 60 * 1000) {
            setTimeout(() => {
                const iosModal = document.getElementById('pwa-ios-modal');
                if (iosModal) iosModal.classList.add('active');
            }, 5000);
        }
    }

    // Close iOS modal also saves dismissal
    const iosModal = document.getElementById('pwa-ios-modal');
    if (iosModal) {
        iosModal.addEventListener('click', (e) => {
            if (e.target === iosModal || e.target.closest('.close-modal') || e.target.closest('.btn-primary')) {
                localStorage.setItem('luxe_pwa_ios_dismissed', Date.now().toString());
            }
        });
    }
});

// --- App Installed Event ---
window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.remove('show');
    if (typeof showToast === 'function') {
        showToast('Luxe has been installed!', 'success');
    }
});
