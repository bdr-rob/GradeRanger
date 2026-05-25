import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';

/**
 * Placeholder hub for upcoming “should I grade this?” dashboards.
 * Keeps navigation and copy aligned with the product direction.
 */
export default function GradingDecisionsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Grading decisions</h2>
        <p className="text-gray-600 mt-1">
          This area will grow into dashboards that combine your portfolio data,
          AI scan signals, and simple rules so you can decide if submitting for
          grading makes sense.
        </p>
      </div>

      <Card className="border-[#47682d]/30 bg-[#47682d]/5">
        <CardHeader>
          <CardTitle className="text-lg text-[#14314F]">Planned capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <ul className="space-y-2">
            <li className="flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#47682d] shrink-0" />
              Per-card grading readiness score from scanner + subgrades
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#47682d] shrink-0" />
              Break-even and fee estimates vs expected grade
            </li>
            <li className="flex gap-2">
              <Circle className="w-5 h-5 text-gray-400 shrink-0" />
              Queues: “candidates,” “submitted,” “hold” (coming soon)
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          className="bg-[#47682d] hover:bg-[#47682d]/90 text-white"
        >
          <Link to="/">Run AI scanner</Link>
        </Button>
        <Button asChild variant="outline" className="border-[#14314F] text-[#14314F]">
          <Link to="/portal/portfolio">Review portfolio</Link>
        </Button>
      </div>
    </div>
  );
}
