// AFTI Global Progress & XP Aggregation Engine
const AFTITracker = {
    getXP: function() {
        return parseInt(localStorage.getItem('afti_global_xp') || '400', 10);
    },
    
    addXP: function(points) {
        let current = this.getXP();
        let updated = current + points;
        localStorage.setItem('afti_global_xp', updated);
        return updated;
    },

    getReadinessTier: function() {
        let xp = this.getXP();
        if (xp >= 600) return { title: "Tier 3: Vocational Placement Ready", color: "#4ade80" };
        if (xp >= 500) return { title: "Tier 2: Transitional Queue Active", color: "#38bdf8" };
        return { title: "Tier 1: Emergency Stabilization", color: "var(--warn)" };
    },

    exportPortfolio: function() {
        return {
            totalXP: this.getXP(),
            tier: this.getReadinessTier().title,
            advisoryNote: localStorage.getItem('afti_last_advisory_note') || "No notes logged.",
            timestamp: new Date().toISOString()
        };
    }
};
