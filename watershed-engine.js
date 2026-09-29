/**
 * AFTI Portal - Watershed Telemetry & Prescription Engine
 * Calculates erosion risk tiers and variable-rate seed/mulch prescriptions from NDVI & slope data.
 */

class WatershedTelemetryEngine {
    constructor() {
        // Standard seed mix densities for Willamette Valley / Hillside burn scars (lbs/acre)
        this.prescriptionPresets = {
            severe_erosion: { name: "Deep-Root Native Grass & Straw Mulch Mix", rateLbsPerAcre: 65, priority: "High" },
            moderate_stress: { name: "Cover Crop & Soil Stabilization Blend", rateLbsPerAcre: 40, priority: "Medium" },
            stable_canopy: { name: "Maintenance / Spot Seeding", rateLbsPerAcre: 15, priority: "Low" }
        };
    }

    /**
     * Calculates erosion risk tier based on NDVI value and slope gradient.
     * @param {number} ndvi - Normalized Difference Vegetation Index (-1.0 to 1.0)
     * @param {number} slopeDegrees - Terrain slope angle in degrees
     * @returns {object} Risk assessment details and recommended prescription
     */
    analyzeZone(ndvi, slopeDegrees) {
        let riskScore = 0;

        // Evaluate NDVI (lower vegetation = higher erosion risk)
        if (ndvi <= 0.15) {
            riskScore += 5; // Bare soil / burn scar
        } else if (ndvi <= 0.40) {
            riskScore += 3; // Sparse brush
        } else {
            riskScore += 1; // Healthy canopy
        }

        // Evaluate Slope (steeper terrain = higher erosion risk)
        if (slopeDegrees >= 25) {
            riskScore += 5; // Steep hillside
        } else if (slopeDegrees >= 12) {
            riskScore += 3; // Moderate slope
        } else {
            riskScore += 1; // Flat terrain
        }

        // Determine category and assign prescription
        if (riskScore >= 8) {
            return {
                riskLevel: "CRITICAL EROSION HAZARD",
                score: riskScore,
                colorClass: "text-rose-400 bg-rose-950/40 border-rose-800",
                prescription: this.prescriptionPresets.severe_erosion
            };
        } else if (riskScore >= 5) {
            return {
                riskLevel: "MODERATE STRESS ZONE",
                score: riskScore,
                colorClass: "text-amber-400 bg-amber-950/40 border-amber-800",
                prescription: this.prescriptionPresets.moderate_stress
            };
        } else {
            return {
                riskLevel: "STABLE / LOW RISK",
                score: riskScore,
                colorClass: "text-emerald-400 bg-emerald-950/40 border-emerald-800",
                prescription: this.prescriptionPresets.stable_canopy
            };
        }
    }

    /**
     * Calculates total material requirements for a targeted sector block.
     * @param {number} totalAcres - Size of the target zone in acres
     * @param {string} riskCategory - 'severe_erosion', 'moderate_stress', or 'stable_canopy'
     * @returns {object} Total seed required in pounds and flight batch estimates
     */
    calculateBatchLoad(totalAcres, riskCategory) {
        const preset = this.prescriptionPresets[riskCategory] || this.prescriptionPresets.moderate_stress;
        const totalPoundsNeeded = totalAcres * preset.rateLbsPerAcre;
        
        // Assuming standard agricultural drone hopper capacity of 100 lbs per flight run
        const standardHopperCapacityLbs = 100;
        const totalFlightsRequired = Math.ceil(totalPoundsNeeded / standardHopperCapacityLbs);

        return {
            materialName: preset.name,
            totalAcres: totalAcres,
            applicationRate: preset.rateLbsPerAcre,
            totalPounds: totalPoundsNeeded,
            estimatedFlights: totalFlightsRequired
        };
    }
}

// Global engine instance
const watershedEngine = new WatershedTelemetryEngine();
