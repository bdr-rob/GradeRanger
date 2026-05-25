import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PortalLayout from './PortalLayout';

/**
 * Shows the portal shell when signed in; otherwise a clear sign-in prompt
 * (instead of only redirecting to /login, which can feel like "it doesn't work").
 */
export default function PortalAuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#47682d]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md border-[#14314F]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#14314F]">Member portal</CardTitle>
            <CardDescription>
              Sign in to build your portfolio and use grading tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link to="/">Back to home</Link>
            </Button>
            <Button className="bg-[#47682d] hover:bg-[#47682d]/90" asChild>
              <Link
                to="/login"
                state={{ from: { pathname: '/portal', search: '', hash: '', key: 'portal' } }}
              >
                Sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PortalLayout />;
}
