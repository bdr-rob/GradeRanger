import { Navigate } from 'react-router-dom';

/** Legacy route: portfolio now lives under the member portal. */
export default function UserDashboard() {
  return <Navigate to="/portal/portfolio" replace />;
}
