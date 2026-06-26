import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Check, Loader2, Shield, Key, AlertCircle, User, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentApiKey, setCurrentApiKey] = useState<any>(null);

  // eBay selling connection — separate from the App ID above. Publishing
  // listings via eBay's Sell APIs needs a user-consent OAuth token
  // (marketplace_connections), not just the public-data App ID.
  const [ebayConnection, setEbayConnection] = useState<any>(null);
  const [connectingEbay, setConnectingEbay] = useState(false);

  useEffect(() => {
    loadCurrentApiKey();
    loadEbayConnection();
  }, [user]);

  const loadEbayConnection = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'ebay')
      .eq('is_active', true)
      .maybeSingle();
    setEbayConnection(data);
  };

  const connectEbay = async () => {
    setConnectingEbay(true);
    try {
      const { data, error } = await supabase.functions.invoke('ebay-oauth', { body: { action: 'authorize_url' } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      window.location.href = data.url;
    } catch (err) {
      toast({ title: 'Could not start eBay connection', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
      setConnectingEbay(false);
    }
  };

  const disconnectEbay = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('marketplace_connections')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('platform', 'ebay');
    if (error) toast({ title: 'Error disconnecting eBay', variant: 'destructive' });
    else { toast({ title: 'eBay disconnected' }); setEbayConnection(null); }
  };

  const loadCurrentApiKey = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('service_name', 'ebay')
        .single();

      if (data && !error) {
        setCurrentApiKey(data);
        setApiKey(data.api_key);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateApiKey = async () => {
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive'
      });
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-ebay-credentials', {
        body: { apiKey }
      });

      if (error) throw error;

      if (data.valid) {
        toast({
          title: 'Success',
          description: 'API key validated successfully',
        });
        return true;
      } else {
        toast({
          title: 'Validation Failed',
          description: data.error || 'Invalid API key',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to validate API key',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const saveApiKey = async () => {
    if (!user) return;

    const isValid = await validateApiKey();
    if (!isValid) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .upsert({
          user_id: user.id,
          service_name: 'ebay',
          api_key: apiKey,
          is_valid: true,
          last_validated: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'API key saved successfully',
      });
      
      await loadCurrentApiKey();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save API key',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeApiKey = async () => {
    if (!user || !currentApiKey) return;

    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user.id)
        .eq('service_name', 'ebay');

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'API key removed successfully',
      });
      
      setApiKey('');
      setCurrentApiKey(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove API key',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* eBay API Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              eBay API Configuration
            </CardTitle>
            <CardDescription>
              Connect your eBay developer API key to enable live market data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentApiKey && currentApiKey.is_valid ? (
              <Alert className="border-green-200 bg-green-50">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your eBay API key is active and validated
                  {currentApiKey.last_validated && (
                    <span className="block text-sm mt-1">
                      Last validated: {new Date(currentApiKey.last_validated).toLocaleString()}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You're currently using demo data. Add your eBay API key to access live market prices.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="apiKey">eBay API Key (App ID)</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your eBay App ID"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Get your API key from the{' '}
                  <a 
                    href="https://developer.ebay.com/my/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    eBay Developer Portal
                  </a>
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={saveApiKey}
                  disabled={isValidating || isSaving || !apiKey}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save API Key'
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={validateApiKey}
                  disabled={isValidating || !apiKey}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>

                {currentApiKey && (
                  <Button 
                    variant="destructive"
                    onClick={removeApiKey}
                  >
                    Remove Key
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Information
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Your API key is encrypted and stored securely</li>
                <li>• We never share your credentials with third parties</li>
                <li>• You can remove your API key at any time</li>
                <li>• API keys are validated before being saved</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* eBay Selling Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Sell on eBay
            </CardTitle>
            <CardDescription>
              Connect your eBay seller account to publish listings directly from Grade Ranger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ebayConnection ? (
              <>
                <Alert className="border-green-200 bg-green-50">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    eBay seller account connected
                    {ebayConnection.store_name && <span className="block text-sm mt-1">{ebayConnection.store_name}</span>}
                  </AlertDescription>
                </Alert>
                <Button variant="destructive" onClick={disconnectEbay}>Disconnect</Button>
              </>
            ) : (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Not connected — listings can be prepared but not published to eBay until you connect.
                  </AlertDescription>
                </Alert>
                <Button onClick={connectEbay} disabled={connectingEbay} className="bg-[#14314F] hover:bg-[#14314F]/90 text-white">
                  {connectingEbay ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Connect eBay account
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Account Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
            </div>
            <div>
              <Label>User ID</Label>
              <p className="text-sm text-muted-foreground mt-1 font-mono">{user?.id}</p>
            </div>
            <div>
              <Label>Account Created</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}