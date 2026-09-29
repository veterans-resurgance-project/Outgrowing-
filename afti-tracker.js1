/**
 * AFTI - Global Experience Point, Readiness Tier & Workforce Cell Matching Engine
 * Architecture: Vanilla, self-contained utility supporting local-to-cloud portability.
 * Version: 2.3.0 - Generation 16 Stable Anchor with Drone Cohort & Realtime Supabase Integration
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
// 2. ALPINE.JS MATCHING ENGINE & DRONE TRAINING PORTAL COMPONENTS
// =========================================================================
if (typeof document !== 'undefined') {
    document.addEventListener('alpine:init', () => {
        
        // Workforce Matching Engine Component
        Alpine.data('matchEngine', () => ({
            participants: [],
            jobRequests: [],
            newParticipant: { name: '', skillTrack: 'Restoration' },
            isSubmitting: false,
            successMessage: '',

            async init() {
                await this.fetchData();
                this.setupRealtimeListeners();
            },

            // Fetch live records from Supabase tables
            async fetchData() {
                if (!supabase) return;
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

            // Supabase Realtime Listener for Live Updates
            setupRealtimeListeners() {
                if (!supabase) return;
                supabase
                    .channel('afti_live_sync')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, payload => {
                        this.fetchData();
                    })
                    .subscribe();
            },

            // Submit new participant profile directly to the database
            async submitParticipant() {
                if (!supabase) {
                    alert('Supabase is not connected.');
                    return;
                }

                this.isSubmitting = true;
                this.successMessage = '';

                const { error } = await supabase
                    .from('participants')
                    .insert([{ 
                        name: this.newParticipant.name, 
                        skill_track: this.newParticipant.skillTrack,
                        status: 'Pending Review'
                    }]);

                this.isSubmitting = false;

                if (error) {
                    alert('Error registering profile. Please check your credentials.');
                    console.error(error);
                } else {
                    this.successMessage = 'Profile registered successfully for administrative review!';
                    this.newParticipant.name = '';
                    await this.fetchData();
                    setTimeout(() => { this.successMessage = ''; }, 4000);
                }
            },

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

        // NEW: Drone Training Pretest Portal Component
        Alpine.data('droneTrainingPortal', () => ({
            recruitId: '',
            selectedModule: 'Day 1',
            score: '',
            statusMessage: '',
            statusColor: 'text-slate-400',
            recentSubmissions: [],

            async init() {
                await this.fetchPretestLogs();
            },

            async fetchPretestLogs() {
                if (!supabase) return;
                const { data } = await supabase
                    .from('afti_drone_training')
                    .select('*')
                    .order('completed_at', { ascending: false })
                    .limit(5);
                if (data) this.recentSubmissions = data;
            },

            async submitTest() {
                if (!this.recruitId || this.score === '') {
                    this.statusMessage = 'Please fill out all required fields.';
                    this.statusColor = 'text-rose-400';
                    return;
                }

                this.statusMessage = 'Syncing with Supabase...';
                this.statusColor = 'text-amber-400';

                const result = await AFTITracker.logDronePretest(this.recruitId, this.selectedModule, this.score);

                this.statusMessage = result.message;
                this.statusColor = result.success ? 'text-emerald-400' : 'text-rose-400';

                if (result.success) {
                    this.score = '';
                    await this.fetchPretestLogs();
                    setTimeout(() => { this.statusMessage = ''; }, 4000);
                }
            }
        }));
    });
}


// =========================================================================
// 3. AFTI TRACKER CORE UTILITIES (Readiness Matrix, XP & HUD)
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
        { minXp: 0,   maxXp: 499,   title: 'Tier 1: Initial Field Placement', color: '#38bdf8' },
        { minXp: 500, maxXp: 699,   title: 'Tier 2: Active Practicum',        color: '#f59e0b' },
        { minXp: 700, maxXp: 999,   title: 'Tier 3: Advanced Technical',       color: '#f43f5e' },
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
        
        const xpElements = document.querySelectorAll('#global-points, #hud-xp, #completion-xp-display');
        const trackElement = document.getElementById('hud-track');
        const tierElement = document.getElementById('hud-tier');

        const activeXP = getXP();
        const activeTrack = localStorage.getItem(CONFIG.keys.trackName);
        const activeTier = getReadinessTier();

        xpElements.forEach(el => { if (el) el.innerText = activeXP; });
        if (trackElement) trackElement.innerText = activeTrack;
        if (tierElement) {
            tierElement.innerText = activeTier.title;
            tierElement.style.color = activeTier.color;
        }
    }

    // NEW: Centralized Drone Pretest Logger with Supabase & XP Reward
    async function logDronePretest(recruitId, moduleName, scoreValue) {
        if (!supabase) {
            console.warn("Supabase client not initialized.");
            return { success: false, message: "Supabase offline." };
        }

        try {
            const { error } = await supabase
                .from('afti_drone_training')
                .insert([
                    { 
                        recruit_id: recruitId, 
                        module: moduleName, 
                        score: parseInt(scoreValue, 10), 
                        completed_at: new Date().toISOString() 
                    }
                ]);

            if (error) throw error;

            // Automatically reward global XP for completing a training check!
            addXP(50);

            return { success: true, message: "Score synced & +50 XP awarded!" };
        } catch (err) {
            console.error('Supabase Error:', err.message);
            return { success: false, message: err.message };
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
        logDronePretest: logDronePretest
    };
})();
