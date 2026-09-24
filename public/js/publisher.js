document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://rfxsiiuvqweicpytqsuk.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_StgQ6pQAs0maOgMRpKJF-Q_NfMbjWZq';
  
  if (window.supabase) {
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const verifyBtn = document.getElementById('btn-verify-upi');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        const upiId = document.getElementById('upi-id-input').value.trim();
        const txnId = document.getElementById('txn-id-input').value.trim();

        if (!upiId || !txnId) {
          alert('Kripya apna UPI ID aur Transaction ID dono bharein!');
          return;
        }

        try {
          const { error } = await supabaseClient
            .from('payments')
            .insert([
              { upi_id: upiId, txn_id: txnId, status: 'pending_verification', created_at: new Date() }
            ]);

          if (error) throw error;

          alert('UPI Payment details safalta purvak submit ho gayi hain! Verification ke baad account unlock ho jayega.');
          document.getElementById('upi-id-input').value = '';
          document.getElementById('txn-id-input').value = '';
        } catch (err) {
          console.error('Supabase error:', err.message);
          alert('Error: ' + err.message);
        }
      });
    }
  }
});
