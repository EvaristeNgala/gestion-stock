import { useEffect, useState } from "react";

import {
  collection,
  doc,
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
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

  // NOTIFICATIONS CENTRALISÉES
  const [stockAlertProducts, setStockAlertProducts] = useState([]);
  const [unpaidSales, setUnpaidSales] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);
  const [stockAlertsLoading, setStockAlertsLoading] = useState(false);
  const [unpaidSalesLoading, setUnpaidSalesLoading] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("");
  const [savingDebtPayment, setSavingDebtPayment] = useState(false);

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

  const userId = session?.uid || session?.userId || null;

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

  // ==============================
  // SURVEILLER LES VENTES IMPAYÉES
  // ADMIN UNIQUEMENT
  // ==============================
  useEffect(() => {
    if (!isAdmin || !storeId) {
      setUnpaidSales([]);
      setUnpaidSalesLoading(false);
      return;
    }

    setUnpaidSalesLoading(true);

    const salesQuery = query(
      collection(db, "sales"),
      where("storeId", "==", storeId)
    );

    const unsubscribe = onSnapshot(
      salesQuery,
      (snapshot) => {
        const pendingSales = snapshot.docs
          .map((saleDoc) => ({
            id: saleDoc.id,
            ...saleDoc.data(),
          }))
          .filter((sale) => {
            const remaining = Number(
              sale.remainingAmount ??
              Math.max(0, Number(sale.total || 0) - Number(sale.amountReceived || 0))
            );

            return (
              ["unpaid", "partial"].includes(sale.paymentStatus) &&
              remaining > 0 &&
              sale.status !== "pending_sync"
            );
          })
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : new Date(a.offlineCreatedAt || a.createdAt || 0).getTime();
            const dateB = b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : new Date(b.offlineCreatedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
          });

        setUnpaidSales(pendingSales);
        setUnpaidSalesLoading(false);
      },
      (error) => {
        console.error("Erreur chargement des ventes impayées :", error);
        setUnpaidSalesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, storeId]);

  // Une notification correspond à une catégorie, pas à chaque produit ou vente.
  const notificationCategories = [
    ...(isAdmin && stockAlertProducts.length > 0
      ? [{ id: "stock", title: "Stock faible", description: `${stockAlertProducts.length} produit(s) nécessitent votre attention.`, icon: "📦", count: stockAlertProducts.length }]
      : []),
    ...(isAdmin && unpaidSales.length > 0
      ? [{ id: "unpaid", title: "Ventes impayées", description: `${unpaidSales.length} vente(s) attendent un paiement.`, icon: "💰", count: unpaidSales.length }]
      : []),
  ];

  const formatSaleDate = (value) => {
    if (!value) return "Date indisponible";
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "Date indisponible";
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMoney = (value) =>
    `${Number(value || 0).toLocaleString("fr-FR")} FC`;

  const closeNotifications = () => {
    setShowNotifications(false);
    setActiveNotification(null);
  };

  // Encaisser un paiement total ou partiel sur une vente à crédit.
  // Le paiement est ajouté à la caisse ouverte de l'utilisateur connecté.
  const recordDebtPayment = async () => {
    if (!selectedDebt || savingDebtPayment) return;

    if (!navigator.onLine) {
      alert("Une connexion Internet est nécessaire pour enregistrer ce paiement.");
      return;
    }

    const amount = Number(debtPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Saisissez un montant valide.");
      return;
    }
    if (!storeId || !userId) {
      alert("La session utilisateur est incomplète. Reconnectez-vous.");
      return;
    }

    setSavingDebtPayment(true);
    try {
      const openCashSnapshot = await getDocsFromServer(query(
        collection(db, "cashSessions"),
        where("storeId", "==", storeId),
        where("userId", "==", userId),
        where("status", "==", "open")
      ));

      if (openCashSnapshot.empty) {
        throw new Error("NO_OPEN_CASH");
      }

      const activeCashSessionId = openCashSnapshot.docs[0].id;
      const saleRef = doc(db, "sales", selectedDebt.id);
      const cashRef = doc(db, "cashSessions", activeCashSessionId);

      await runTransaction(db, async (transaction) => {
        const saleSnapshot = await transaction.get(saleRef);
        if (!saleSnapshot.exists()) throw new Error("SALE_NOT_FOUND");

        const currentSale = saleSnapshot.data();
        if (currentSale.storeId !== storeId) throw new Error("INVALID_STORE");
        if (currentSale.status === "cancelled") throw new Error("SALE_CANCELLED");

        const total = Number(currentSale.total || 0);
        const alreadyReceived = Number(currentSale.amountReceived ?? currentSale.cashReceived ?? 0);
        const remaining = Math.max(0, total - alreadyReceived);
        if (remaining <= 0) throw new Error("ALREADY_PAID");
        if (amount > remaining) throw new Error("PAYMENT_TOO_HIGH");

        const cashSnapshot = await transaction.get(cashRef);
        if (!cashSnapshot.exists() || cashSnapshot.data().status !== "open") {
          throw new Error("NO_OPEN_CASH");
        }

        const nextReceived = alreadyReceived + amount;
        const nextRemaining = Math.max(0, total - nextReceived);
        const nextStatus = nextRemaining === 0 ? "paid" : "partial";
        const previousHistory = Array.isArray(currentSale.paymentHistory)
          ? currentSale.paymentHistory
          : [];

        transaction.update(saleRef, {
          amountReceived: nextReceived,
          remainingAmount: nextRemaining,
          paymentStatus: nextStatus,
          paymentMethod: currentSale.paymentMethod === "credit"
            ? "cash"
            : (currentSale.paymentMethod || "cash"),
          paymentHistory: [...previousHistory, {
            amount,
            method: "cash",
            paidAt: new Date().toISOString(),
            userId,
            userName,
            cashSessionId: activeCashSessionId,
          }],
          lastPaymentAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const cashData = cashSnapshot.data();
        transaction.update(cashRef, {
          totalSales: Number(cashData.totalSales || 0) + amount,
          updatedAt: serverTimestamp(),
        });
      });

      setSelectedDebt(null);
      setDebtPaymentAmount("");
      alert("Paiement enregistré. Le solde de la dette a été mis à jour.");
    } catch (error) {
      console.error("Erreur encaissement dette :", error);
      const messages = {
        NO_OPEN_CASH: "Vous devez ouvrir votre caisse avant d'encaisser une dette.",
        SALE_NOT_FOUND: "Cette vente est introuvable.",
        INVALID_STORE: "Cette vente n'appartient pas à ce magasin.",
        SALE_CANCELLED: "Impossible d'encaisser une vente annulée.",
        PAYMENT_TOO_HIGH: "Le montant dépasse le reste à payer.",
        ALREADY_PAID: "Cette dette est déjà entièrement réglée.",
      };
      alert(messages[error.message] || "Impossible d'enregistrer le paiement.");
    } finally {
      setSavingDebtPayment(false);
    }
  };

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

        {isAdmin && notificationCategories.length > 0 && (
          <button
            type="button"
            onClick={() => setShowNotifications(true)}
            aria-label={`Afficher ${notificationCategories.length} notification(s)`}
            title="Notifications"
            className={styles.notificationButton}
          >
            <svg
              className={styles.notificationIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.notificationBadge}>
              {notificationCategories.length > 99 ? "99+" : notificationCategories.length}
            </span>
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

      {/* CENTRE DE NOTIFICATIONS — UNE SEULE CLOCHE */}
      {isAdmin && showNotifications && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifications du magasin"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeNotifications();
          }}
          className={styles.notificationsOverlay}
        >
          <section className={styles.notificationsModal}>
            <div className={styles.notificationsHeader}>
              <div>
                <h2>{activeNotification ? "Détails de la notification" : "Notifications"}</h2>
                <p>
                  {activeNotification
                    ? "Consultez les éléments qui nécessitent votre attention."
                    : `${notificationCategories.length} catégorie(s) de notification.`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeNotifications}
                aria-label="Fermer les notifications"
                className={styles.notificationsClose}
              >✕</button>
            </div>

            {!activeNotification ? (
              <div className={styles.notificationCategories}>
                {notificationCategories.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={styles.notificationCategory}
                    onClick={() => setActiveNotification(notification.id)}
                  >
                    <span className={styles.notificationCategoryIcon}>
                      {notification.icon}
                    </span>
                    <span className={styles.notificationCategoryText}>
                      <strong>{notification.title}</strong>
                      <small>{notification.description}</small>
                    </span>
                    <span className={styles.notificationCategoryArrow}>›</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.notificationsBack}
                  onClick={() => setActiveNotification(null)}
                >
                  ← Retour aux notifications
                </button>

                {activeNotification === "stock" && (
                  <>
                    <h3 className={styles.notificationDetailsTitle}>
                      Produits en stock faible ({stockAlertProducts.length})
                    </h3>
                    {stockAlertsLoading ? (
                      <p className={styles.notificationsLoading}>Chargement des produits...</p>
                    ) : stockAlertProducts.length === 0 ? (
                      <p className={styles.notificationsEmpty}>Aucun produit en alerte.</p>
                    ) : (
                      <div className={styles.notificationDetailsList}>
                        {stockAlertProducts.map((product) => (
                          <article key={product.id} className={styles.notificationDetailCard}>
                            <strong>{product.productName || product.name || "Produit sans nom"}</strong>
                            <div className={styles.notificationDetailMeta}>
                              <span>Stock actuel : <b className={styles.lowStockValue}>{Number(product.stock || 0)} {product.stockUnit || ""}</b></span>
                              <span>Seuil : <b>{Number(product.alertStock || 0)} {product.stockUnit || ""}</b></span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeNotification === "unpaid" && (
                  <>
                    <h3 className={styles.notificationDetailsTitle}>
                      Ventes à encaisser ({unpaidSales.length})
                    </h3>
                    {unpaidSalesLoading ? (
                      <p className={styles.notificationsLoading}>Chargement des ventes...</p>
                    ) : unpaidSales.length === 0 ? (
                      <p className={styles.notificationsEmpty}>Aucune vente impayée.</p>
                    ) : (
                      <div className={styles.notificationDetailsList}>
                        {unpaidSales.map((sale) => {
                          const remaining = Number(
                            sale.remainingAmount ??
                            Math.max(0, Number(sale.total || 0) - Number(sale.amountReceived || 0))
                          );
                          return (
                            <article key={sale.id} className={styles.notificationDetailCard}>
                              <strong>{sale.customerName || "Client non renseigné"}</strong>
                              {sale.customerPhone && (
                                <span className={styles.notificationCustomerPhone}>{sale.customerPhone}</span>
                              )}
                              <div className={styles.notificationDebtAmounts}>
                                <span>Montant total <b>{formatMoney(sale.total)}</b></span>
                                <span>Déjà payé <b>{formatMoney(sale.amountReceived)}</b></span>
                                <span>Reste à payer <b className={styles.unpaidValue}>{formatMoney(remaining)}</b></span>
                              </div>
                              <small className={styles.notificationSaleDate}>
                                Vente du {formatSaleDate(sale.offlineCreatedAt || sale.createdAt)}
                              </small>
                              <button
                                type="button"
                                className={styles.debtPaymentButton}
                                onClick={() => {
                                  setSelectedDebt(sale);
                                  setDebtPaymentAmount(String(remaining));
                                }}
                              >
                                Encaisser un paiement
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <button
              type="button"
              onClick={closeNotifications}
              className={styles.notificationsDone}
            >Fermer</button>
          </section>
        </div>
      )}

      {selectedDebt && (
        <div
          className={styles.debtPaymentOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Enregistrer un paiement de dette"
          onClick={(event) => {
            if (event.target === event.currentTarget && !savingDebtPayment) {
              setSelectedDebt(null);
              setDebtPaymentAmount("");
            }
          }}
        >
          <form
            className={styles.debtPaymentModal}
            onSubmit={(event) => { event.preventDefault(); recordDebtPayment(); }}
          >
            <h2>Encaisser une dette</h2>
            <p>Client : <strong>{selectedDebt.customerName || "Client non renseigné"}</strong></p>
            <p>Reste à payer : <strong className={styles.unpaidValue}>{formatMoney(selectedDebt.remainingAmount ?? (Number(selectedDebt.total || 0) - Number(selectedDebt.amountReceived || 0)))}</strong></p>
            <label htmlFor="debt-payment-amount">Montant reçu (FC)</label>
            <input
              id="debt-payment-amount"
              type="number"
              min="1"
              step="1"
              max={Number(selectedDebt.remainingAmount ?? (Number(selectedDebt.total || 0) - Number(selectedDebt.amountReceived || 0)))}
              value={debtPaymentAmount}
              onChange={(event) => setDebtPaymentAmount(event.target.value)}
              placeholder="Saisissez le montant reçu"
              required
            />
            <p className={styles.debtPaymentHint}>Vous pouvez encaisser une partie ou la totalité du solde.</p>
            <div className={styles.debtPaymentActions}>
              <button
                type="button"
                className={styles.debtPaymentCancel}
                disabled={savingDebtPayment}
                onClick={() => { setSelectedDebt(null); setDebtPaymentAmount(""); }}
              >Annuler</button>
              <button type="submit" className={styles.debtPaymentConfirm} disabled={savingDebtPayment}>
                {savingDebtPayment ? "Enregistrement..." : "Valider le paiement"}
              </button>
            </div>
          </form>
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