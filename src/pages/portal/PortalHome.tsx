import CollectionDashboard from '@/components/CollectionDashboard';

export default function PortalHome() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#14314F]">My collection</h2>
        <p className="text-gray-500 mt-1 max-w-2xl">
          Your full card collection — scan, grade, list, and track every card from intake through sale.
        </p>
      </div>
      <CollectionDashboard />
    </div>
  );
}
