/**
 * AFTI - Global Experience Point & Readiness Tier Tracking Engine
 * Architecture: Vanilla, self-contained utility supporting local-to-cloud portability.
 * Version: 2.1.0 - Generation 16 Stable Anchor
 */

const AFTITracker = (() => {
    // -------------------------------------------------------------------------
    // 1. CONFIGURATION & READINESS MATRIX PARAMETERS
    // -------------------------------------------------------------------------
    const CONFIG = {
        keys: {
            globalXp: 'afti_global_xp',
            trackName: 'afti_track_name',
            cloudEndpoint: 'afti_backup_endpoint_url'
        },
        defaults: {
            baseXp: 400,
            track: 'Foster-Alum Track'
        }
    };

    // The 4-Stage Architectural Readiness Matrix
    const TIERS = [
        { minXp: 0,   maxXp: 499,  title: 'Tier 1: Initial Field Placement', color: '#38bdf8' }, // Light Blue
        { minXp: 500, maxXp: 699,  title: 'Tier 2: Active Practicum',        color: '#f59e0b' }, // Amber/Yellow
        { minXp: 700, maxXp: 999,  title: 'Tier 3: Advanced Technical',       color: '#f43f5e' }, // Rose/Red
        { minXp: 1000, maxXp: Infinity, title: 'Tier 4: Enterprise Certified', color: '#22c55e' }  // Green
    ];

    // -------------------------------------------------------------------------
    // 2. INTERNAL UTILITIES
    // -------------------------------------------------------------------------
    function _initializeStorage() {
        if (!localStorage.getItem(CONFIG.keys.globalXp)) {
            localStorage.setItem(CONFIG.keys.globalXp, CONFIG.defaults.baseXp);
        }
        if (!localStorage.getItem(CONFIG.keys.trackName)) {
            localStorage.setItem(CONFIG.keys.trackName, CONFIG.defaults.track);
        }
    }

    // -------------------------------------------------------------------------
    // 3. CORE PUBLIC ENGINE API METHOD LOGIC
    // -------------------------------------------------------------------------
    /**
     * Retrieves the current clean integer score out of local storage
     * @returns {number} Current Experience Points
     */
    function getXP() {
        _initializeStorage();
        return parseInt(localStorage.getItem(CONFIG.keys.globalXp), 10) || CONFIG.defaults.baseXp;
    }

    /**
     * Safely increments the global score and triggers a UI sync log
     * @param {number} points Amount of points to add
     * @returns {number} New global point total
     */
    function addXP(points) {
        let current = getXP();
        let updated = current + parseInt(points, 10);
        localStorage.setItem(CONFIG.keys.globalXp, updated);
        syncHUD();
        return updated;
    }

    /**
     * Matches current score against the 4-Stage Readiness Matrix metrics
     * @returns {Object} Selected Tier information object
     */
    function getReadinessTier() {
        const xp = getXP();
        // Loop down through tiers array to identify current profile matching level
        for (let i = 0; i < TIERS.length; i++) {
            if (xp >= TIERS[i].minXp && xp <= TIERS[i].maxXp) {
                return TIERS[i];
            }
        }
        return TIERS[0]; // Absolute basic level fallback
    }

    /**
     * Scans active document nodes and mounts corrected data targets into HUD containers
     */
    function syncHUD() {
        _initializeStorage();
        
        const xpElement = document.getElementById('global-points');
        const trackElement = document.getElementById('hud-track');
        const tierElement = document.getElementById('hud-tier');

        const activeXP = getXP();
        const activeTrack = localStorage.getItem(CONFIG.keys.trackName);
        const activeTier = getReadinessTier();

        // Safe node injections to prevent terminal crash errors
        if (xpElement) {
            xpElement.innerText = activeXP;
        }
        if (trackElement) {
            trackElement.innerText = activeTrack;
        }
        if (tierElement) {
            tierElement.innerText = activeTier.title;
            tierElement.style.color = activeTier.color;
        }
    }

    /**
     * Local-to-Cloud Portability: Dispatches background data packets asynchronously
     * Functions cleanly offline or online via absolute relative path safety guidelines
     * @param {Object} data Custom metrics package payload
     * @returns {Promise<boolean>} Success tracking state status
     */
    async function dispatchCloudBackup(data = {}) {
        const targetEndpoint = localStorage.getItem(CONFIG.keys.cloudEndpoint);
        if (!targetEndpoint) {
            console.warn("AFTI Cloud Warning: No backup endpoint url configured inside storage registry.");
            return false;
        }

        // Bundle data payload with standard telemetry markers
        const payload = {
            track: localStorage.getItem(CONFIG.keys.trackName),
            currentXP: getXP(),
            tier: getReadinessTier().title,
            timestamp: new Date().toISOString(),
            clientCache: data
        };

        try {
            // Asynchronous fetch prevents background script layout lockups or blocks
            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return response.ok;
        } catch (err) {
            console.error("AFTI Cloud Failure: System is operating offline or network server is blocked.", err);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // 4. AUTO-LOAD LISTENER INITIALIZATION
    // -------------------------------------------------------------------------
    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => {
            _initializeStorage();
            syncHUD();
        });
    }

    // Export public endpoints cleanly
    return {
        getXP: getXP,
        addXP: addXP,
        getReadinessTier: getReadinessTier,
        syncHUD: syncHUD,
        dispatchCloudBackup: dispatchCloudBackup
    };
})();
