import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Scale, ScanSearch, Bookmark } from 'lucide-react';

export default function PortalHome() {
  const { user } = useAuth();
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('portfolio_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!cancelled && !error) setPortfolioCount(count ?? 0);
      if (!cancelled && error) setPortfolioCount(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Overview</h2>
        <p className="text-gray-600 mt-1 max-w-2xl">
          Build and track your collection here. Soon you will see dashboards that
          help decide whether a card is worth sending for professional grading.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-[#14314F]/15 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-[#14314F]">
              <FolderOpen className="w-5 h-5 text-[#47682d]" />
              Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Add cards, costs, grades, and notes. This is your main collection
              record.
            </p>
            {portfolioCount !== null && (
              <p className="text-sm font-medium text-[#47682d]">
                {portfolioCount} {portfolioCount === 1 ? 'item' : 'items'} in
                your portfolio
              </p>
            )}
            <Button
              asChild
              className="w-full bg-[#47682d] hover:bg-[#47682d]/90 text-white"
            >
              <Link to="/portal/portfolio">Open portfolio builder</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#14314F]/15 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-[#14314F]">
              <Scale className="w-5 h-5 text-[#47682d]" />
              Grading decisions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              A dedicated space (coming next) for scoring, thresholds, and
              “submit vs hold” guidance per card.
            </p>
            <Button asChild variant="outline" className="w-full border-[#47682d] text-[#47682d]">
              <Link to="/portal/grading">View grading workspace</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#14314F]/15 shadow-sm sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-[#14314F]">
              <ScanSearch className="w-5 h-5 text-[#47682d]" />
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="secondary" className="w-full justify-start">
              <Link to="/">Open AI scanner (main app)</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-start">
              <Link to="/watchlist" className="flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                Watchlist
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
