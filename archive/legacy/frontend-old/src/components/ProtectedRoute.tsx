import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated, isTokenExpired } from "@/services/authService";
import { Suspense } from "react";
import { PageFallback } from "@/components/layout/PageFallback";

export function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated() || isTokenExpired()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  );
}
