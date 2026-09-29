/**
 * AFTI - Global Experience Point, Readiness Tier & Workforce Cell Matching Engine
 * Architecture: Vanilla, self-contained utility supporting local-to-cloud portability.
 * Version: 2.4.0 - Generation 16 Stable Anchor with Drone Cohort & Watershed Telemetry
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
// 2. ALPINE.JS COMPONENTS (Matching Engine, Drone Portal & Watershed Engine)
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

            async fetchData() {
                if (!supabase) return;
                try {
                    const { data: pData } = await supabase.from('participants').select('*');
                    const { data: jData } = await supabase.from('job_requests').select('*');
                    if (pData) this.participants = pData;
                    if (jData) this.jobRequests = jData;
                } catch (err) {
                    console.error('Fetch error:', err);
                }
            },

            setupRealtimeListeners() {
                if (!supabase) return;
                supabase
                    .channel('afti_live_sync')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
                        this.fetchData();
                    })
                    .subscribe();
            },

            async submitParticipant() {
                if (!supabase) return alert('Supabase not connected.');
                this.isSubmitting = true;
                const { error } = await supabase.from('participants').insert([{ 
                    name: this.newParticipant.name, 
                    skill_track: this.newParticipant.skillTrack,
                    status: 'Pending Review'
                }]);
                this.isSubmitting = false;
                if (!error) {
                    this.successMessage = 'Profile registered successfully!';
                    this.newParticipant.name = '';
                    await this.fetchData();
                    setTimeout(() => { this.successMessage = ''; }, 4000);
                }
            }
        }));

        // Track A: Drone Training Pretest Portal Component
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

        // Track B: Watershed Telemetry Engine Component
        Alpine.data('watershedEngine', () => ({
            siteName: '',
            ndviInput: '',
            soilType: 'Willamette Silty Clay Loam',
            result: null,
            activeStatus: 'Awaiting Data',

            generatePrescription() {
                if (!this.siteName || this.ndviInput === '') return;
                this.result = AFTIWaterTelemetry.evaluateSite(this.ndviInput, this.soilType);
                this.activeStatus = 'Prescription Generated';
            },

            async saveTelemetry() {
                if (!this.result) return;
                const res = await AFTIWaterTelemetry.logTelemetryData(this.siteName, this.ndviInput, this.result.prescription.seedBlend);
                alert(res.message);
            }
        }));
    });
}


// =========================================================================
// 3. AFTI TRACKER CORE UTILITIES (Readiness Matrix, XP & HUD)
// =========================================================================
const AFTITracker = (() => {
    const CONFIG = {
        keys: { globalXp: 'afti_global_xp', trackName: 'afti_track_name' },
        defaults: { baseXp: 400, track: 'Foster-Alum Track' }
    };

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
            if (xp >= TIERS[i].minXp && xp <= TIERS[i].maxXp) return TIERS[i];
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

    async function logDronePretest(recruitId, moduleName, scoreValue) {
        if (!supabase) return { success: false, message: "Supabase offline." };
        try {
            const { error } = await supabase.from('afti_drone_training').insert([{ 
                recruit_id: recruitId, 
                module: moduleName, 
                score: parseInt(scoreValue, 10), 
                completed_at: new Date().toISOString() 
            }]);
            if (error) throw error;
            addXP(50);
            return { success: true, message: "Score synced & +50 XP awarded!" };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => { _initializeStorage(); syncHUD(); });
    }

    return { getXP, addXP, getReadinessTier, syncHUD, logDronePretest };
})();


// =========================================================================
// 4. TRACK B: WATERSHED TELEMETRY & CROP-MATCHING UTILITY
// =========================================================================
const AFTIWaterTelemetry = (() => {
    const RESTORATION_PROFILES = [
        {
            id: 'slopes_high_erosion',
            name: 'Hillside Post-Fire / High Erosion Slope',
            targetNdiMin: 0.10, targetNdiMax: 0.35,
            recommendedBlend: 'Native Deep-Root Grass Mix (Blue Wildrye, Roemer’s Fescue)',
            nitrogenFixer: 'Crimson Clover / Vetch Inter-seed',
            applicationRate: '45 lbs/acre (Hydro-seeding or Drone Broadcast)'
        },
        {
            id: 'riparian_buffer',
            name: 'Riparian / Stream Corridor Restoration',
            targetNdiMin: 0.36, targetNdiMax: 0.65,
            recommendedBlend: 'Streamside Stabilization Mix (Slough Sedge, Red Alder Stakes)',
            nitrogenFixer: 'Native Lupine',
            applicationRate: '30 lbs/acre + Live Stakes'
        },
        {
            id: 'agricultural_rehab',
            name: 'Depleted Agricultural / Pasture Recovery',
            targetNdiMin: 0.00, targetNdiMax: 0.09,
            recommendedBlend: 'Cover Crop Heavy Biomass (Daikon Radish, Winter Rye)',
            nitrogenFixer: 'Austrian Winter Pea',
            applicationRate: '100 lbs/acre Drill Seeded'
        }
    ];

    function evaluateSite(ndviValue) {
        const parsedNdvi = parseFloat(ndviValue);
        const match = RESTORATION_PROFILES.find(p => parsedNdvi >= p.targetNdiMin && parsedNdvi <= p.targetNdiMax) || RESTORATION_PROFILES[0];
        return {
            siteCondition: match.name,
            ndviRecorded: parsedNdvi,
            prescription: { seedBlend: match.recommendedBlend, coverCrop: match.nitrogenFixer, rate: match.applicationRate }
        };
    }

    async function logTelemetryData(siteName, ndviScore, selectedPrescription) {
        if (!supabase) return { success: true, message: "Stored locally (Offline mode)." };
        try {
            const { error } = await supabase.from('afti_watershed_telemetry').insert([{
                site_name: siteName,
                ndvi_score: parseFloat(ndviScore),
                prescription_summary: selectedPrescription,
                logged_at: new Date().toISOString()
            }]);
            if (error) throw error;
            return { success: true, message: "Telemetry synced to Supabase!" };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    return { evaluateSite, logTelemetryData };
})();
