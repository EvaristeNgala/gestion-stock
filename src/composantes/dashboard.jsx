import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase";

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

  // ALERTES DE STOCK (ADMIN UNIQUEMENT)
  const [stockAlertProducts, setStockAlertProducts] = useState([]);
  const [showStockAlerts, setShowStockAlerts] = useState(false);
  const [stockAlertsLoading, setStockAlertsLoading] = useState(false);

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

  const isAdmin = role === "admin" && session?.loginMode === "admin";
  const access = (key) => isAdmin || session?.permissions?.[key] === true;

  // ==============================
  // SURVEILLER LES PRODUITS EN ALERTE
  // ADMIN UNIQUEMENT
  // ==============================
  useEffect(() => {
    if (!isAdmin || !storeId) {
      setStockAlertProducts([]);
      setStockAlertsLoading(false);
      return;
    }

    setStockAlertsLoading(true);

    const productsQuery = query(
      collection(db, "products"),
      where("storeId", "==", storeId)
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const alertProducts = snapshot.docs
          .map((productDoc) => ({
            id: productDoc.id,
            ...productDoc.data(),
          }))
          .filter((product) => {
            if (product.isActive === false) return false;
            const currentStock = Number(product.stock || 0);
            const minimumStock = Number(product.alertStock || 0);
            return minimumStock > 0 && currentStock <= minimumStock;
          })
          .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));

        setStockAlertProducts(alertProducts);
        setStockAlertsLoading(false);
      },
      (error) => {
        console.error("Erreur chargement des alertes de stock :", error);
        setStockAlertsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, storeId]);
  const cards = [

    {

      permission: "products",
      title: "Produits",

      description: "Gestion des produits",

      path: "/products",

      icon: "📦",

    },

    {

      permission: "stock",
      title: "Stock",

      description: "Gestion des stocks",

      path: "/stock",

      icon: "🏪",

    },

    {

      permission: "reports",
      title: "Rapports",

      description: "Statistiques et rapports",

      path: "/reports",

      icon: "📊",

    },

    {

      permission: "settings",
      title: "Paramètres",

      description: "Configuration du magasin",

      path: "/settings",

      icon: "⚙️",

    },

    ...(access("cash-history") ? [{

      title: "Historique des caisses",

      description: "Ouvertures, clôtures et écarts",

      path: "/cash-history",

      icon: "🧾",

    }] : []),

  ].filter(item => !item.permission || access(item.permission));

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

    if (access("settings")) navigate("/settings");

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

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowStockAlerts(true)}
            aria-label={`Voir les produits en alerte : ${stockAlertProducts.length}`}
            title="Produits en alerte"
            className={`${styles.stockAlertButton} ${
              stockAlertProducts.length > 0 ? styles.stockAlertButtonActive : ""
            }`}
          >
            🔔
            {stockAlertProducts.length > 0 && (
              <span className={styles.stockAlertBadge}>
                {stockAlertProducts.length > 99 ? "99+" : stockAlertProducts.length}
              </span>
            )}
          </button>
        )}

        <button

          type="button"

          className={styles.calendarButton}

          onClick={() => access("calendar") && navigate("/calendar")}
          disabled={!access("calendar")}

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

      {/* FENÊTRE DES ALERTES DE STOCK — ADMIN UNIQUEMENT */}
      {isAdmin && showStockAlerts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Produits en alerte de stock"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowStockAlerts(false);
          }}
          className={styles.stockAlertsOverlay}
        >
          <section className={styles.stockAlertsModal}>
            <div className={styles.stockAlertsHeader}>
              <div>
                <h2>🔔 Alertes de stock</h2>
                <p>
                  {stockAlertProducts.length} produit(s) nécessitent votre attention.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStockAlerts(false)}
                aria-label="Fermer"
                className={styles.stockAlertsClose}
              >✕</button>
            </div>

            {stockAlertsLoading ? (
              <p className={styles.stockAlertsLoading}>Chargement des produits...</p>
            ) : stockAlertProducts.length === 0 ? (
              <div className={styles.stockAlertsEmpty}>
                <div className={styles.stockAlertsCheck}>✓</div>
                <strong>Aucun produit en alerte</strong>
                <p>
                  Tous les stocks sont au-dessus de leur seuil d'alerte.
                </p>
              </div>
            ) : (
              <div className={styles.stockAlertsList}>
                {stockAlertProducts.map((product) => (
                  <article
                    key={product.id}
                    className={styles.stockAlertProduct}
                  >
                    <strong className={styles.stockAlertProductName}>
                      {product.productName || product.name || "Produit sans nom"}
                    </strong>
                    <div className={styles.stockAlertProductDetails}>
                      <span>Stock actuel : <strong className={styles.stockAlertCurrentStock}>
                        {Number(product.stock || 0)} {product.stockUnit || ""}
                      </strong></span>
                      <span>Seuil d'alerte : <strong>
                        {Number(product.alertStock || 0)} {product.stockUnit || ""}
                      </strong></span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowStockAlerts(false)}
              className={styles.stockAlertsDone}
            >Fermer</button>
          </section>
        </div>
      )}

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