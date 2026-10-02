/**
 * AFTI - Global Experience Point, Readiness Tier & Workforce Cell Matching Engine
 * Architecture: Vanilla, self-contained utility supporting local-to-cloud portability.
 * Version: 2.5.0 - Generation 16 Stable Anchor with Drone Cohort & Watershed Telemetry
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

        // Track B: Watershed Telemetry & Prescription Engine Component
        Alpine.data('watershedEngine', () => ({
            siteName: '',
            ndviInput: '',
            slopeInput: 20, // Added slope angle input support
            targetAcres: 10, // Added acreage input support
            result: null,
            activeStatus: 'Awaiting Data',

            generatePrescription() {
                if (!this.siteName || this.ndviInput === '') return;
                // Calls the enhanced calculation engine handling NDVI + Slope + Acres
                this.result = AFTIWaterTelemetry.evaluateSite(this.ndviInput, this.slopeInput, this.targetAcres);
                this.activeStatus = 'Prescription Generated';
            },

            async saveTelemetry() {
                if (!this.result) return;
                const res = await AFTIWaterTelemetry.logTelemetryData(
                    this.siteName, 
                    this.ndviInput, 
                    this.slopeInput,
                    this.targetAcres,
                    this.result
                );
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
    // --- Real-World Baseline Dictionary & Validation Rules ---
    const parameterThresholds = {
        soil_moisture: { min: 0, max: 100, unit: "%", description: "Volumetric water content." },
        soil_temperature: { min: 32, max: 105, unit: "°F", description: "Growing season soil temp." },
        ph_level: { min: 3.5, max: 9.0, unit: "pH", description: "Agricultural soil pH bounds." },
        drone_altitude: { min: 0, max: 400, unit: "ft", description: "FAA Part 107 max legal AGL ceiling." },
        water_temperature: { min: 32, max: 90, unit: "°F", description: "Stream/watershed temperature." },
        ndvi_score: { min: -1.0, max: 1.0, unit: "NDVI", description: "Normalized Difference Vegetation Index." }
    };
    const TIERS = [
        { minXp: 0,    maxXp: 499,   title: 'Tier 1: Initial Field Placement', color: '#38bdf8' },
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

/**
     * Evaluates a field log entry against standard ranges, flags anomalies,
     * and tracks user reliability / training status.
     * @param {string} recruitId - User / Recruit Identifier
     * @param {string} parameterKey - Key matching parameterThresholds
     * @param {number} value - Measured numeric value
     */
    async function submitFieldEntryWithValidation(recruitId, parameterKey, value) {
        const rule = parameterThresholds[parameterKey];
        if (!rule) return { success: false, message: "Unknown parameter key specified." };

        const parsedVal = parseFloat(value);
        let isFlagged = false;
        let flagReason = null;

        // Check against boundary conditions
        if (parsedVal < rule.min || parsedVal > rule.max) {
            isFlagged = true;
            flagReason = `Value (${parsedVal} ${rule.unit}) is outside operational bounds (${rule.min}-${rule.max}).`;
        }

        if (!supabase) {
            return { 
                success: true, 
                isFlagged: isFlagged, 
                message: isFlagged ? `Saved locally (Flagged: ${flagReason})` : "Saved locally (Verified normal)." 
            };
        }

        try {
            // 1. Insert into field logs table (always saves so data isn't lost)
            const { error: logError } = await supabase.from('afti_field_logs').insert([{
                recruit_id: recruitId,
                parameter_key: parameterKey,
                logged_value: parsedVal,
                unit: rule.unit,
                is_flagged: isFlagged,
                flag_reason: flagReason,
                logged_at: new Date().toISOString()
            }]);

            if (logError) throw logError;

            // 2. If flagged, handle user error count & training sidebar check
            if (isFlagged && recruitId) {
                // Fetch or update participant profile stats
                // (Assumes a 'participants' or 'profiles' table exists from your matchEngine)
                const { data: profile } = await supabase
                    .from('participants')
                    .select('flagged_entry_count, training_status')
                    .eq('id', recruitId)
                    .single();

                const currentFlags = (profile && profile.flagged_entry_count) ? profile.flagged_entry_count + 1 : 1;
                let updatePayload = { flagged_entry_count: currentFlags };

                // Threshold Check: 3 flags triggers training sidebar requirement
                if (currentFlags >= 3) {
                    updatePayload.training_status = 'SIDEBAR_TRAINING_REQUIRED';
                }

                await supabase.from('participants').update(updatePayload).eq('id', recruitId);

                return { 
                    success: true, 
                    isFlagged: true, 
                    message: `⚠️ Entry flagged for review (${flagReason}). Routed to staff queue.` 
                };
            } else {
                // Award XP for clean, verified data submissions
                addXP(25);
                return { success: true, isFlagged: false, message: "✅ Entry verified & synced! +25 XP awarded." };
            }

        } catch (err) {
            return { success: false, message: err.message };
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
// 4. TRACK B: WATERSHED TELEMETRY & EROSION RISK CALCULATION ENGINE
// =========================================================================
const AFTIWaterTelemetry = (() => {
    // Standard seed mix densities for Willamette Valley / Hillside burn scars (lbs/acre)
    const PRESCRIPTION_PRESETS = {
        severe_erosion: { 
            name: "Deep-Root Native Grass & Straw Mulch Mix", 
            rateLbsPerAcre: 65, 
            priority: "High",
            nitrogenFixer: "Crimson Clover / Vetch Inter-seed"
        },
        moderate_stress: { 
            name: "Cover Crop & Soil Stabilization Blend", 
            rateLbsPerAcre: 40, 
            priority: "Medium",
            nitrogenFixer: "Austrian Winter Pea"
        },
        stable_canopy: { 
            name: "Maintenance / Spot Seeding", 
            rateLbsPerAcre: 15, 
            priority: "Low",
            nitrogenFixer: "Native Lupine"
        }
    };

    /**
     * Evaluates site conditions based on NDVI index and terrain slope angle.
     * @param {number} ndviValue - NDVI value (-1.0 to 1.0)
     * @param {number} slopeDegrees - Terrain slope angle in degrees
     * @param {number} totalAcres - Size of target sector block in acres
     */
    function evaluateSite(ndviValue, slopeDegrees = 15, totalAcres = 10) {
        const parsedNdvi = parseFloat(ndviValue);
        const parsedSlope = parseFloat(slopeDegrees) || 0;
        const acres = parseFloat(totalAcres) || 1;

        let riskScore = 0;

        // Evaluate NDVI (lower vegetation = higher erosion risk)
        if (parsedNdvi <= 0.15) {
            riskScore += 5; // Bare soil / burn scar
        } else if (parsedNdvi <= 0.40) {
            riskScore += 3; // Sparse brush
        } else {
            riskScore += 1; // Healthy canopy
        }

        // Evaluate Slope (steeper terrain = higher erosion risk)
        if (parsedSlope >= 25) {
            riskScore += 5; // Steep hillside
        } else if (parsedSlope >= 12) {
            riskScore += 3; // Moderate slope
        } else {
            riskScore += 1; // Flat terrain
        }

        // Select Preset Category
        let selectedPreset = PRESCRIPTION_PRESETS.stable_canopy;
        let riskLevelName = "STABLE / LOW RISK";
        let colorClass = "text-emerald-400 bg-emerald-950/40 border-emerald-800";

        if (riskScore >= 8) {
            riskLevelName = "CRITICAL EROSION HAZARD";
            selectedPreset = PRESCRIPTION_PRESETS.severe_erosion;
            colorClass = "text-rose-400 bg-rose-950/40 border-rose-800";
        } else if (riskScore >= 5) {
            riskLevelName = "MODERATE STRESS ZONE";
            selectedPreset = PRESCRIPTION_PRESETS.moderate_stress;
            colorClass = "text-amber-400 bg-amber-950/40 border-amber-800";
        }

        const totalPoundsNeeded = Math.ceil(acres * selectedPreset.rateLbsPerAcre);
        const standardHopperCapacityLbs = 100; // Standard agricultural drone hopper capacity
        const estimatedFlights = Math.ceil(totalPoundsNeeded / standardHopperCapacityLbs);

        return {
            riskLevel: riskLevelName,
            riskScore: riskScore,
            colorClass: colorClass,
            ndviRecorded: parsedNdvi,
            slopeRecorded: parsedSlope,
            totalAcres: acres,
            prescription: {
                seedBlend: selectedPreset.name,
                coverCrop: selectedPreset.nitrogenFixer,
                applicationRate: `${selectedPreset.rateLbsPerAcre} lbs/acre`,
                totalPounds: totalPoundsNeeded,
                estimatedFlights: estimatedFlights
            }
        };
    }

    async function logTelemetryData(siteName, ndviScore, slopeDegrees, totalAcres, evaluationResult) {
        if (!supabase) return { success: true, message: "Stored locally (Offline mode)." };
        try {
            const { error } = await supabase.from('afti_watershed_telemetry').insert([{
                site_name: siteName,
                ndvi_score: parseFloat(ndviScore),
                slope_degrees: parseFloat(slopeDegrees),
                target_acres: parseFloat(totalAcres),
                risk_level: evaluationResult.riskLevel,
                prescription_summary: evaluationResult.prescription.seedBlend,
                total_seed_lbs: evaluationResult.prescription.totalPounds,
                flight_sorties: evaluationResult.prescription.estimatedFlights,
                logged_at: new Date().toISOString()
            }]);
            if (error) throw error;
            return { success: true, message: "Telemetry synced to Supabase cloud successfully!" };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    return { evaluateSite, logTelemetryData };
})();
