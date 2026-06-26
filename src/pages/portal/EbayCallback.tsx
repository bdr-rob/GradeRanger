import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EbayCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'exchanging' | 'success' | 'error'>('exchanging');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setErrorMessage('No authorization code returned by eBay.');
      return;
    }

    supabase.functions.invoke('ebay-oauth', { body: { action: 'exchange_code', code } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setStatus('error');
          setErrorMessage(data?.error ?? error?.message ?? 'Unknown error');
        } else {
          setStatus('success');
        }
      });
  }, [searchParams]);

  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4">
      {status === 'exchanging' && (
        <>
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500">Connecting your eBay account…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="h-10 w-10 mx-auto text-[#47682d]" />
          <p className="font-medium text-[#14314F]">eBay connected</p>
          <Button asChild className="bg-[#14314F] text-white"><Link to="/portal/listings">Go to listings</Link></Button>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="h-10 w-10 mx-auto text-red-400" />
          <p className="font-medium text-gray-700">Could not connect eBay</p>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <Button asChild variant="outline"><Link to="/settings">Back to settings</Link></Button>
        </>
      )}
    </div>
  );
}
