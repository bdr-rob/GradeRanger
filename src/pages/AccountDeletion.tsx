import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, ShieldCheck } from 'lucide-react';

export default function AccountDeletion() {
  const { user } = useAuth();
  const [step, setStep] = useState<'confirm' | 'deleting' | 'done' | 'error'>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setStep('deleting');

    try {
      // Delete all user data from Supabase tables
      const uid = user?.id;
      if (!uid) throw new Error('Not signed in');

      // Delete in dependency order
      await supabase.from('transactions').delete().eq('user_id', uid);
      await supabase.from('listings').delete().eq('user_id', uid);
      await supabase.from('grading_bundle_items').delete().eq('user_id', uid);
      await supabase.from('grading_bundles').delete().eq('user_id', uid);
      await supabase.from('ai_reports').delete().eq('user_id', uid);
      await supabase.from('price_alerts').delete().eq('user_id', uid);
      await supabase.from('market_valuations').delete().eq('user_id', uid);
      await supabase.from('cards').delete().eq('user_id', uid);
      await supabase.from('portfolio_items').delete().eq('user_id', uid);
      await supabase.from('watchlist').delete().eq('user_id', uid);

      // Delete the auth account last
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { user_id: uid },
      });
      if (error) throw error;

      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Deletion failed');
      setStep('error');
    }
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <ShieldCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#14314F] mb-2">Account Deleted</h1>
          <p className="text-gray-600">
            All your data has been permanently removed from Grade Ranger. 
            We're sorry to see you go.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-8 h-8 text-red-500" />
          <h1 className="text-2xl font-bold text-[#14314F]">Delete Account</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-red-800 mb-2">
            This action is permanent and cannot be undone.
          </p>
          <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
            <li>All cards and portfolio data deleted</li>
            <li>All AI grading reports deleted</li>
            <li>All grading submissions deleted</li>
            <li>All saved searches and watchlists deleted</li>
            <li>Your account cannot be recovered</li>
          </ul>
        </div>

        {!user ? (
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              You must be signed in to delete your account.
            </p>
            <Button
              onClick={() => window.location.href = '/login'}
              className="bg-[#14314F] text-white"
            >
              Sign In
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="DELETE"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {step === 'error' && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <Button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || step === 'deleting'}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {step === 'deleting' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting all data…</>
              ) : (
                'Permanently Delete My Account'
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Need help instead?{' '}
              <a href="mailto:support@graderanger.com" className="text-[#47682d] underline">
                Contact support
              </a>
            </p>
          </div>
        )}

        {/* Required disclosure for eBay / app store compliance */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Grade Ranger complies with eBay's Marketplace Account Deletion policy. 
            When an eBay account linked to Grade Ranger is closed, all associated 
            data is automatically removed within 30 days per eBay developer requirements.
          </p>
        </div>
      </div>
    </div>
  );
}