import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Analytics() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/dashboard?tab=analytics", { replace: true });
  }, [navigate]);

  return null;
}
