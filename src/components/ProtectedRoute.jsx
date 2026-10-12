import { Navigate, useLocation } from "react-router-dom";

// Les permissions déterminent les accès, indépendamment du rôle.
// Ce contrôle côté React doit être complété par les règles Firestore.
function ProtectedRoute({ children, permission }) {
  const location = useLocation();
  let session = null;

  try {
    const saved = localStorage.getItem("storeSession");
    session = saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Session invalide :", error);
    localStorage.removeItem("storeSession");
  }

  if (!session?.storeId || !(session.uid || session.userId)) {
    return <Navigate to="/" replace />;
  }

  const role = session.role;
  const isAdmin = role === "admin" && session.loginMode === "admin";
  const permissions = session.permissions || {};

  // L'administration nécessite une authentification administrateur réelle.
  // Une session employé ne devient jamais admin via un simple champ role.
  if (isAdmin) return children;

  const employeeLogin =
    session.loginMode === "employeeCode" ||
    session.loginMode === "employee";

  if (!employeeLogin || !["cashier", "manager"].includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Le tableau de bord est le point d'entrée des employés autorisés
  // à gérer au moins un module. Pas besoin d'une permission "dashboard"
  // absente de l'actuel formulaire Employees.jsx.
  if (!permission) {
    const dashboardPermissions = [
      "products", "stock", "stockAdjustment", "sales", "expenses",
      "reports", "settings", "calendar", "cash-history",
    ];
    if (dashboardPermissions.some((key) => permissions[key] === true)) {
      return children;
    }
  } else if (permissions[permission] === true) {
    return children;
  }

  return (
    <Navigate
      to="/"
      replace
      state={{ from: location.pathname, accessDenied: true }}
    />
  );
}

export default ProtectedRoute;
