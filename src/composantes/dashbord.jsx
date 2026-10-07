import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./dashbord.module.css";

function Dashboard() {
  const navigate = useNavigate();

  // ==============================
  // MENU LATERAL
  // ==============================

  const [menuOpen, setMenuOpen] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showStoreInfo, setShowStoreInfo] = useState(false);

  // ==============================
  // RÉCUPÉRER LA SESSION
  // ==============================

  let session = null;

  try {
    const savedSession = localStorage.getItem("storeSession");

    session = savedSession
      ? JSON.parse(savedSession)
      : null;
  } catch (error) {
    console.error("Erreur lecture session :", error);
  }

  // ==============================
  // INFORMATIONS UTILISATEUR
  // ==============================

  const userName =
    session?.userName ||
    session?.name ||
    session?.displayName ||
    "Utilisateur";

  const storeName =
    session?.storeName ||
    "Mon magasin";

  const storeId =
    session?.storeId ||
    "";

  const role =
    session?.role ||
    "Utilisateur";

  const email =
    session?.email ||
    "";

  const phone =
    session?.phone ||
    "";

  const roleLabel =
    role === "admin"
      ? "Administrateur"
      : role === "manager"
        ? "Gérant"
        : role === "cashier"
          ? "Caissier"
          : "Utilisateur";

  // ==============================
  // CARTES DU DASHBOARD
  // ==============================

  const cards = [
    {
      title: "Produits",
      description: "Gestion des produits",
      path: "/products",
      icon: "📦",
    },

    {
      title: "Stock",
      description: "Gestion des stocks",
      path: "/stock",
      icon: "🏪",
    },

    {
      title: "POS",
      description: "Point de vente",
      path: "/pos",
      icon: "💳",
    },

    {
      title: "Rapports",
      description: "Statistiques et rapports",
      path: "/reports",
      icon: "📊",
    },

    {
      title: "Paramètres",
      description: "Configuration du magasin",
      path: "/settings",
      icon: "⚙️",
    },
  ];

  // ==============================
  // OUVRIR / FERMER MENU
  // ==============================

  const openMenu = () => {
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setShowAccountInfo(false);
    setShowStoreInfo(false);
  };

  // ==============================
  // MON COMPTE
  // ==============================

  const handleAccount = () => {
    setShowAccountInfo((prev) => !prev);
    setShowStoreInfo(false);
  };

  // ==============================
  // MON MAGASIN
  // ==============================

  const handleStore = () => {
    setShowStoreInfo((prev) => !prev);
    setShowAccountInfo(false);
  };

  // ==============================
  // PARAMÈTRES
  // ==============================

  const handleSettings = () => {
    closeMenu();
    navigate("/settings");
  };

  // ==============================
  // DÉCONNEXION
  // ==============================

  const handleLogout = () => {
    const confirmation = window.confirm(
      "Voulez-vous vraiment vous déconnecter ?"
    );

    if (!confirmation) {
      return;
    }

    localStorage.removeItem("storeSession");

    setMenuOpen(false);

    navigate("/");
  };

  // ==============================
  // AFFICHAGE
  // ==============================

  return (
    <div className={styles.dashboard}>

      {/* ============================== */}
      {/* EN-TÊTE */}
      {/* ============================== */}

      <header className={styles.header}>

        <button
          type="button"
          className={styles.menuButton}
          onClick={openMenu}
          aria-label="Ouvrir le menu"
        >
          ☰
        </button>

        <h1>
          Stock Manager
        </h1>

        <button
          type="button"
          className={styles.calendarButton}
          onClick={() => navigate("/calendar")}
          aria-label="Ouvrir le calendrier"
        >
          📅
        </button>

      </header>

      {/* ============================== */}
      {/* INFORMATIONS UTILISATEUR */}
      {/* ============================== */}

      <section className={styles.userCard}>

        <div>

          <h2>
            Bienvenue {userName}
          </h2>

          <p>
            {storeName}
          </p>

          <span>
            {roleLabel}
          </span>

        </div>

      </section>

      {/* ============================== */}
      {/* MODULES */}
      {/* ============================== */}

      <section className={styles.grid}>

        {cards.map((item) => (

          <button
            key={item.title}
            type="button"
            className={styles.card}
            onClick={() => navigate(item.path)}
          >

            <h2
              style={{
                color: "#1e3a8a",
              }}
            >
              {item.title}
            </h2>

            <p
              style={{
                marginTop: "-10px",
              }}
            >
              {item.description}
            </p>

          </button>

        ))}

      </section>

      {/* ============================== */}
      {/* FOND SOMBRE DU MENU */}
      {/* ============================== */}

      {menuOpen && (
        <div
          className={styles.menuOverlay}
          onClick={closeMenu}
        />
      )}

      {/* ============================== */}
      {/* MENU LATÉRAL */}
      {/* ============================== */}

      <aside
        className={`${styles.sideMenu} ${
          menuOpen ? styles.sideMenuOpen : ""
        }`}
      >

        {/* EN-TÊTE DU MENU */}

        <div className={styles.sideMenuHeader}>

          <div>

            <span className={styles.sideMenuLabel}>
              STOCK MANAGER
            </span>

            <h2>
              {storeName}
            </h2>

          </div>

          <button
            type="button"
            className={styles.closeMenuButton}
            onClick={closeMenu}
            aria-label="Fermer le menu"
          >
            ✕
          </button>

        </div>

        {/* UTILISATEUR */}

        <div className={styles.menuUser}>

          <div className={styles.menuAvatar}>
            👤
          </div>

          <div>

            <strong>
              {userName}
            </strong>

            <span>
              {roleLabel}
            </span>

          </div>

        </div>

        {/* OPTIONS */}

        <nav className={styles.menuNavigation}>

          {/* MON COMPTE */}

          <button
            type="button"
            className={styles.menuItem}
            onClick={handleAccount}
          >

            

            <span className={styles.menuItemText}>
              <strong>Mon compte</strong>
              <small>
                Informations personnelles
              </small>
            </span>

            <span className={styles.menuArrow}>
              {showAccountInfo ? "⌃" : "›"}
            </span>

          </button>

          {showAccountInfo && (

            <div className={styles.menuDetails}>

              <div>
                <span>Nom</span>
                <strong>{userName}</strong>
              </div>

              <div>
                <span>Rôle</span>
                <strong>{roleLabel}</strong>
              </div>

              {email && (
                <div>
                  <span>Email</span>
                  <strong>{email}</strong>
                </div>
              )}

              {phone && (
                <div>
                  <span>Téléphone</span>
                  <strong>{phone}</strong>
                </div>
              )}

            </div>

          )}

          {/* MON MAGASIN */}

          <button
            type="button"
            className={styles.menuItem}
            onClick={handleStore}
          >

            

            <span className={styles.menuItemText}>
              <strong>Mon magasin</strong>
              <small>
                Informations du magasin
              </small>
            </span>

            <span className={styles.menuArrow}>
              {showStoreInfo ? "⌃" : "›"}
            </span>

          </button>

          {showStoreInfo && (

            <div className={styles.menuDetails}>

              <div>
                <span>Magasin</span>
                <strong>{storeName}</strong>
              </div>

              {storeId && (
                <div>
                  <span>Identifiant</span>
                  <strong className={styles.storeId}>
                    {storeId}
                  </strong>
                </div>
              )}

            </div>

          )}

          {/* PARAMÈTRES */}

          <button
            type="button"
            className={styles.menuItem}
            onClick={handleSettings}
          >

           

            <span className={styles.menuItemText}>
              <strong>Paramètres</strong>
              <small>
                Configuration du magasin
              </small>
            </span>

            <span className={styles.menuArrow}>
              ›
            </span>

          </button>

        </nav>

        {/* DÉCONNEXION */}

        <div className={styles.logoutSection}>

          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
          >

            

            <span>
              Se déconnecter
            </span>

          </button>

        </div>

      </aside>

    </div>
  );
}

export default Dashboard;