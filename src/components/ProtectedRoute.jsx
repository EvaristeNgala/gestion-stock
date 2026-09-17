
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children, permission }) {
  const location = useLocation();

  // Récupérer la session
  const savedSession = localStorage.getItem("storeSession");

  let session = null;

  try {
    session = savedSession ? JSON.parse(savedSession) : null;
  } catch (error) {
    console.error("Session invalide :", error);
    localStorage.removeItem("storeSession");
  }

  // ==========================================
  // 1. Aucun utilisateur connecté
  // ==========================================
  if (!session?.storeId) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ==========================================
  // 2. Administrateur
  // ==========================================
  // L'administrateur a accès à toutes les pages
  if (session.role === "admin") {
    return children;
  }

  // ==========================================
  // 3. Vérifier la permission demandée
  // ==========================================
  const hasPermission =
    permission &&
    session.permissions &&
    session.permissions[permission] === true;

  // ==========================================
  // 4. Permission refusée
  // ==========================================
  if (!hasPermission) {
    return (
      <Navigate
        to="/pos"
        replace
        state={{
          accessDenied: true,
          message: "Vous n'avez pas la permission d'accéder à cette page."
        }}
      />
    );
  }

  // ==========================================
  // 5. Permission accordée
  // ==========================================
  return children;
}

export default ProtectedRoute;

