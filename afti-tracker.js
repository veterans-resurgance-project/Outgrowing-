// ==========================================
// VRP / AFTI FORM SUBMISSION & SUPABASE BRIDGE
// ==========================================

const SUPABASE_URL = "https://vqkwxwfrchmrgmzchpqh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_O62Ej6PJ8wAlGdoBT4-rFQ_pANhhjX8"; // Public anon key
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/resend-email`;

/**
 * Universal submission handler for VRP forms
 * @param {string} tableName - Supabase table name ('landowner_inquiries' or 'forestry_metrics_registry')
 * @param {Object} formData - Key-value object containing the form inputs
 */
async function submitVrpForm(tableName, formData) {
  try {
    console.log(`[VRP] Staging form submission for ${tableName}...`);

    // 1. LocalStorage Backup (Ensures zero data loss if offline)
    const localKey = `vrp_backup_${tableName}_${Date.now()}`;
    localStorage.setItem(localKey, JSON.stringify(formData));

    // 2. Insert into Supabase Table (Respects RLS Insert-Only Policy)
    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(formData)
    });

    if (!dbResponse.ok) {
      const errText = await dbResponse.text();
      throw new Error(`Database error (${dbResponse.status}): ${errText}`);
    }

    const savedRecord = await dbResponse.json();
    console.log('[VRP] Successfully written to Supabase:', savedRecord);

    // 3. Trigger Email Alert via Supabase Edge Function (Resend Bridge)
    const emailPayload = {
      subject: `New VRP Form Entry: ${tableName.replace('_', ' ').toUpperCase()}`,
      html: `
        <h2>New Submission Received</h2>
        <p><strong>Table Target:</strong> ${tableName}</p>
        <hr />
        <ul>
          ${Object.entries(formData).map(([key, val]) => `<li><strong>${key}:</strong>${JSON.stringify(val)}</li>`).join('')}
        </ul>
        <p><em>Logged at: ${new Date().toUTCString()}</em></p>
      `
    };

    const emailResponse = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (!emailResponse.ok) {
      console.warn('[VRP Warning] Data saved to database, but email dispatch encountered an issue.');
    } else {
      console.log('[VRP] Email notification successfully routed to Gmail.');
    }

    // Clear local backup on total success
    localStorage.removeItem(localKey);
    return { success: true, data: savedRecord };

  } catch (error) {
    console.error('[VRP Critical Error] Form submission failed:', error);
    alert('Submission error. Your data has been saved locally. Please try again or contact support.');
    return { success: false, error: error.message };
  }
}

// ==========================================
// DOM EVENT BINDINGS (Example for Landowner Form)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const landownerForm = document.getElementById('landowner-inquiry-form');
  
  if (landownerForm) {
    landownerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Gather form inputs
      const payload = {
        full_name: document.getElementById('full_name').value.trim(),
        phone_number: document.getElementById('phone_number').value.trim(),
        email_address: document.getElementById('email_address').value.trim(),
        property_location: document.getElementById('property_location').value.trim()
      };

      // Button loading state toggle
      const submitBtn = landownerForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerText;
      submitBtn.innerText = 'Submitting...';
      submitBtn.disabled = true;

      // Execute submission loop
      const result = await submitVrpForm('landowner_inquiries', payload);

      if (result.success) {
        alert('Thank you! Your landowner inquiry has been successfully submitted.');
        landownerForm.reset();
      }

      submitBtn.innerText = originalBtnText;
      submitBtn.disabled = false;
    });
  }
});
