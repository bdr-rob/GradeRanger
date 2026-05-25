import PortfolioTracker from '@/components/PortfolioTracker';

export default function PortalPortfolio() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">Build your portfolio</h2>
        <p className="text-gray-600 mt-1">
          Add cards manually or import in bulk. Scanner saves from the main app can
          also land here when you choose “My portfolio.”
        </p>
      </div>
      <PortfolioTracker />
    </div>
  );
}
