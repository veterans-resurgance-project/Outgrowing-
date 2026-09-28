/**
 * AFTI - Global Experience Point, Readiness Tier & Workforce Cell Matching Engine
 * Architecture: Vanilla, self-contained utility supporting local-to-cloud portability.
 * Version: 2.2.0 - Generation 16 Stable Anchor with Supabase Integration
 */

// =========================================================================
// 1. INITIALIZE SUPABASE CLIENT
// =========================================================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';      // Replace with your Supabase Project URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE'; // Replace with your Supabase Anon/Public Key

// Safely initialize Supabase if the script library is loaded
const supabase = (typeof window !== 'undefined' && window.supabase) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

// =========================================================================
// 2. ALPINE.JS MATCHING ENGINE COMPONENT
// =========================================================================
if (typeof document !== 'undefined') {
    document.addEventListener('alpine:init', () => {
        Alpine.data('matchEngine', () => ({
            participants: [],
            jobRequests: [],
            newParticipant: { name: '', skillTrack: 'Restoration' },
            isSubmitting: false,
            successMessage: '',

            // Runs automatically when the component loads on the page
            async init() {
                await this.fetchData();
            },

            // Fetch live records from Supabase tables
            async fetchData() {
                if (!supabase) {
                    console.warn("Supabase client not initialized. Check CDN script tag.");
                    return;
                }
                try {
                    const { data: pData, error: pError } = await supabase.from('participants').select('*');
                    const { data: jData, error: jError } = await supabase.from('job_requests').select('*');
                    
                    if (pData) this.participants = pData;
                    if (jData) this.jobRequests = jData;
                    
                    if (pError || jError) console.error('Error fetching data:', pError || jError);
                } catch (err) {
                    console.error('Network or client error during fetch:', err);
                }
            },

            // Submit new participant profile directly to the database
            async submitParticipant() {
                if (!supabase) {
                    alert('Supabase is not connected.');
                    return;
                }

                this.isSubmitting = true;
                this.successMessage = '';

                const { data, error } = await supabase
                    .from('participants')
                    .insert([
                        { 
                            name: this.newParticipant.name, 
                            skill_track: this.newParticipant.skillTrack,
                            status: 'Pending Review'
                        }
                    ]);

                this.isSubmitting = false;

                if (error) {
                    alert('Error registering profile. Please check your network or credentials.');
                    console.error(error);
                } else {
                    this.successMessage = 'Profile registered successfully for administrative review!';
                    this.newParticipant.name = '';
                    await this.fetchData(); // Refresh the list dynamically
                    setTimeout(() => { this.successMessage = ''; }, 4000);
                }
            },

            // Computed getter for the matching matrix
            get matchedResults() {
                return this.participants.map(participant => {
                    const compatibleJobs = this.jobRequests.filter(job => 
                        job.required_track.toLowerCase() === participant.skill_track.toLowerCase()
                    );
                    return {
                        ...participant,
                        matches: compatibleJobs,
                        matchScore: compatibleJobs.length > 0 ? 100 : 0
                    };
                });
            }
        }));
    });
}


// =========================================================================
// 3. AFTI TRACKER CORE UTILITIES (Readiness Matrix & HUD)
// =========================================================================
const AFTITracker = (() => {
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
        { minXp: 0,   maxXp: 499,  title: 'Tier 1: Initial Field Placement', color: '#38bdf8' },
        { minXp: 500, maxXp: 699,  title: 'Tier 2: Active Practicum',        color: '#f59e0b' },
        { minXp: 700, maxXp: 999,  title: 'Tier 3: Advanced Technical',       color: '#f43f5e' },
        { minXp: 1000, maxXp: Infinity, title: 'Tier 4: Enterprise Certified', color: '#22c55e' }
    ];

    function _initializeStorage() {
        if (!localStorage.getItem(CONFIG.keys.globalXp)) {
            localStorage.setItem(CONFIG.keys.globalXp, CONFIG.defaults.baseXp);
        }
        if (!localStorage.getItem(CONFIG.keys.trackName)) {
            localStorage.setItem(CONFIG.keys.trackName, CONFIG.defaults.track);
        }
    }

    function getXP() {
        _initializeStorage();
        return parseInt(localStorage.getItem(CONFIG.keys.globalXp), 10) || CONFIG.defaults.baseXp;
    }

    function addXP(points) {
        let current = getXP();
        let updated = current + parseInt(points, 10);
        localStorage.setItem(CONFIG.keys.globalXp, updated);
        syncHUD();
        return updated;
    }

    function getReadinessTier() {
        const xp = getXP();
        for (let i = 0; i < TIERS.length; i++) {
            if (xp >= TIERS[i].minXp && xp <= TIERS[i].maxXp) {
                return TIERS[i];
            }
        }
        return TIERS[0];
    }

    function syncHUD() {
        _initializeStorage();
        
        const xpElement = document.getElementById('global-points');
        const trackElement = document.getElementById('hud-track');
        const tierElement = document.getElementById('hud-tier');

        const activeXP = getXP();
        const activeTrack = localStorage.getItem(CONFIG.keys.trackName);
        const activeTier = getReadinessTier();

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

    async function dispatchCloudBackup(data = {}) {
        const targetEndpoint = localStorage.getItem(CONFIG.keys.cloudEndpoint);
        if (!targetEndpoint) {
            console.warn("AFTI Cloud Warning: No backup endpoint url configured inside storage registry.");
            return false;
        }

        const payload = {
            track: localStorage.getItem(CONFIG.keys.trackName),
            currentXP: getXP(),
            tier: getReadinessTier().title,
            timestamp: new Date().toISOString(),
            clientCache: data
        };

        try {
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

    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => {
            _initializeStorage();
            syncHUD();
        });
    }

    return {
        getXP: getXP,
        addXP: addXP,
        getReadinessTier: getReadinessTier,
        syncHUD: syncHUD,
        dispatchCloudBackup: dispatchCloudBackup
    };
})();
