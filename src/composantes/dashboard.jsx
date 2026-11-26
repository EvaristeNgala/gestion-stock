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
  const [unpaidSearch, setUnpaidSearch] = useState("");

  // Gestion simple des pertes de produits (administrateur uniquement)
  const [lossProducts, setLossProducts] = useState([]);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossSearch, setLossSearch] = useState("");
  const [lossItems, setLossItems] = useState([]);
  const [lossReason, setLossReason] = useState("Abîmé");
  const [lossNote, setLossNote] = useState("");
  const [lossSaving, setLossSaving] = useState(false);
  const [lossNotice, setLossNotice] = useState("");

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

  // Charger les produits pour le formulaire d'enregistrement des pertes.
  useEffect(() => {
    if (!isAdmin || !storeId) {
      setLossProducts([]);
      return;
    }

    const productsQuery = query(
      collection(db, "products"),
      where("storeId", "==", storeId)
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        setLossProducts(
          snapshot.docs
            .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
            .filter((product) => product.isActive !== false && product.status !== "inactive")
            .sort((a, b) =>
              String(a.productName || "").localeCompare(String(b.productName || ""), "fr")
            )
        );
      },
      (error) => {
        console.error("Erreur chargement des produits pour les pertes :", error);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, storeId]);

  const openLossModal = () => {
    if (!isAdmin) return;
    setLossSearch("");
    setLossItems([]);
    setLossReason("Abîmé");
    setLossNote("");
    setLossNotice("");
    setShowLossModal(true);
  };

  const addLossProduct = (product) => {
    setLossItems((current) => {
      if (current.some((item) => item.productId === product.id)) {
        setLossNotice("Ce produit est déjà dans la liste.");
        return current;
      }
      setLossNotice("");
      return [...current, { productId: product.id, quantity: "1" }];
    });
    setLossSearch("");
  };

  const updateLossQuantity = (productId, value) => {
    setLossItems((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: value } : item
      )
    );
  };

  const removeLossProduct = (productId) => {
    setLossItems((current) => current.filter((item) => item.productId !== productId));
  };

  const filteredLossProducts = lossProducts.filter((product) => {
    const search = lossSearch.trim().toLocaleLowerCase("fr-FR");
    if (!search) return false;
    const name = String(product.productName || product.name || "").toLocaleLowerCase("fr-FR");
    return name.includes(search);
  }).filter((product) => !lossItems.some((item) => item.productId === product.id));

  const registerProductLoss = async () => {
    if (!isAdmin) {
      setLossNotice("Seul l'administrateur peut enregistrer une perte.");
      return;
    }

    if (lossItems.length === 0) {
      setLossNotice("Ajoutez au moins un produit à la liste.");
      return;
    }

    const preparedItems = lossItems.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    }));

    if (preparedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      setLossNotice("Chaque quantité doit être un nombre entier supérieur à zéro.");
      return;
    }

    if (!storeId || !userId) {
      setLossNotice("Session du magasin introuvable. Reconnectez-vous.");
      return;
    }

    setLossSaving(true);
    setLossNotice("");

    try {
      const productRefs = preparedItems.map((item) => doc(db, "products", item.productId));
      const lossRefs = preparedItems.map(() => doc(collection(db, "stockLosses")));

      await runTransaction(db, async (transaction) => {
        const productSnapshots = await Promise.all(
          productRefs.map((productRef) => transaction.get(productRef))
        );

        const updates = productSnapshots.map((snapshot, index) => {
          const item = preparedItems[index];
          if (!snapshot.exists()) throw new Error("Un des produits sélectionnés n'existe plus.");

          const currentProduct = snapshot.data();
          const currentStock = Number(currentProduct.stock || 0);

          if (currentProduct.storeId !== storeId) {
            throw new Error("Un produit sélectionné n'appartient pas à votre magasin.");
          }
          if (currentStock < item.quantity) {
            throw new Error(
              `Stock insuffisant pour ${currentProduct.productName || "un produit"}. Disponible : ${currentStock}.`
            );
          }

          return { item, currentProduct, nextStock: currentStock - item.quantity };
        });

        updates.forEach(({ item, currentProduct, nextStock }, index) => {
          transaction.update(productRefs[index], { stock: nextStock });
          transaction.set(lossRefs[index], {
            storeId,
            productId: item.productId,
            productName: currentProduct.productName || currentProduct.name || "Produit",
            quantity: item.quantity,
            stockUnit: currentProduct.stockUnit || "unité",
            reason: lossReason,
            note: lossNote.trim(),
            status: "validated",
            createdAt: serverTimestamp(),
            createdBy: userId,
            createdByName: userName,
            createdByRole: role,
          });
        });
      });

      setShowLossModal(false);
      setLossItems([]);
      setLossNotice("");
      alert(`${preparedItems.length} produit(s) enregistré(s) comme perte. Les stocks ont été mis à jour. Ces pertes ne sont pas comptées comme ventes ou dépenses.`);
    } catch (error) {
      console.error("Erreur enregistrement pertes :", error);
      setLossNotice(error.message || "Impossible d'enregistrer ces pertes.");
    } finally {
      setLossSaving(false);
    }
  };

  // Une notification correspond à une catégorie, pas à chaque produit ou vente.
  const notificationCategories = [
    ...(isAdmin && stockAlertProducts.length > 0
      ? [{ id: "stock", title: "Stock faible", description: `${stockAlertProducts.length} produit(s) nécessitent votre attention.`, icon: "📦", count: stockAlertProducts.length }]
      : []),
    ...(isAdmin && unpaidSales.length > 0
      ? [{ id: "unpaid", title: "Ventes impayées", description: `${unpaidSales.length} vente(s) attendent un paiement.`, icon: "💰", count: unpaidSales.length }]
      : []),
  ];

  const filteredUnpaidSales = unpaidSales.filter((sale) => {
    const search = unpaidSearch.trim().toLocaleLowerCase("fr-FR");
    if (!search) return true;
    const customer = String(sale.customerName || "").toLocaleLowerCase("fr-FR");
    const phoneNumber = String(sale.customerPhone || "").toLocaleLowerCase("fr-FR");
    const saleNumber = String(sale.saleNumber || sale.id || "").toLocaleLowerCase("fr-FR");
    return customer.includes(search) || phoneNumber.includes(search) || saleNumber.includes(search);
  });

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

      <section
        className={styles.userCard}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <h2>Bienvenue {userName}</h2>
          <p>{storeName}</p>
          <span>{roleLabel}</span>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openLossModal}
            style={{
              flex: "0 0 auto",
              border: 0,
              borderRadius: 10,
              padding: "12px 16px",
              background: "#dc2626",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 3px 8px rgba(220, 38, 38, .2)",
            }}
          >
            + Enregistrer une perte
          </button>
        )}
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

            onClick={() => item.onClick ? item.onClick() : navigate(item.path)}

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
                      <>
                        <div className={styles.unpaidSearchWrap}>
                          <input
                            type="search"
                            className={styles.unpaidSearchInput}
                            value={unpaidSearch}
                            onChange={(event) => setUnpaidSearch(event.target.value)}
                            placeholder="Rechercher un client, téléphone ou n° de vente..."
                            aria-label="Rechercher une vente impayée"
                          />
                          <span className={styles.unpaidSearchCount}>
                            {filteredUnpaidSales.length} résultat(s) sur {unpaidSales.length}
                          </span>
                        </div>
                        {filteredUnpaidSales.length === 0 ? (
                          <p className={styles.notificationsEmpty}>Aucune vente ne correspond à cette recherche.</p>
                        ) : (
                      <div className={styles.notificationDetailsList}>
                        {filteredUnpaidSales.map((sale) => {
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

      {showLossModal && isAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enregistrer une perte de stock"
          onClick={(event) => {
            if (event.target === event.currentTarget && !lossSaving) {
              setShowLossModal(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10050,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(100%, 480px)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              color: "#172033",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Enregistrer une perte</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
                  Le stock sera diminué. Cette opération ne sera pas ajoutée aux ventes ni aux dépenses.
                </p>
              </div>
              <button
                type="button"
                disabled={lossSaving}
                onClick={() => setShowLossModal(false)}
                style={{ border: 0, background: "#eef2f7", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
              >✕</button>
            </div>

            <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
              <div style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                Rechercher un produit
                <input
                  type="search"
                  value={lossSearch}
                  onChange={(event) => setLossSearch(event.target.value)}
                  placeholder="Tapez le nom du produit..."
                  autoComplete="off"
                  style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 9, fontSize: 14 }}
                />
                {lossSearch.trim() && (
                  <div style={{ display: "grid", gap: 6, maxHeight: 170, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 9, padding: 6 }}>
                    {filteredLossProducts.length === 0 ? (
                      <p style={{ margin: 8, color: "#64748b", fontWeight: 400 }}>
                        Aucun produit disponible correspondant à cette recherche.
                      </p>
                    ) : filteredLossProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addLossProduct(product)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left", padding: 10, border: 0, borderRadius: 7, background: "#f8fafc", cursor: "pointer", color: "#172033" }}
                      >
                        <span>
                          <strong>{product.productName || product.name || "Produit"}</strong>
                          <small style={{ display: "block", color: "#64748b", marginTop: 3 }}>
                            Stock : {Number(product.stock || 0)} {product.stockUnit || "unités"}
                          </small>
                        </span>
                        <strong style={{ color: "#2563eb" }}>＋ Ajouter</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>Produits à enregistrer</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{lossItems.length} produit(s)</span>
              </div>

              {lossItems.length === 0 ? (
                <p style={{ margin: 0, padding: 14, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 9, fontSize: 13 }}>
                  Recherchez un produit puis cliquez sur « Ajouter ».
                </p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {lossItems.map((item) => {
                    const product = lossProducts.find((entry) => entry.id === item.productId);
                    if (!product) return null;
                    return (
                      <div key={item.productId} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px 34px", alignItems: "center", gap: 8, padding: 10, border: "1px solid #e2e8f0", borderRadius: 9 }}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: "block", fontSize: 13, overflowWrap: "anywhere" }}>
                            {product.productName || product.name || "Produit"}
                          </strong>
                          <small style={{ color: "#64748b" }}>
                            Stock : {Number(product.stock || 0)} {product.stockUnit || "unités"}
                          </small>
                        </div>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => updateLossQuantity(item.productId, event.target.value)}
                          aria-label={`Quantité perdue pour ${product.productName || product.name}`}
                          style={{ width: "100%", boxSizing: "border-box", padding: 9, border: "1px solid #cbd5e1", borderRadius: 7 }}
                        />
                        <button
                          type="button"
                          onClick={() => removeLossProduct(item.productId)}
                          disabled={lossSaving}
                          aria-label={`Retirer ${product.productName || product.name}`}
                          style={{ border: 0, borderRadius: 7, width: 32, height: 32, background: "#fee2e2", color: "#b91c1c", fontWeight: 800, cursor: "pointer" }}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                Motif de la perte
                <select
                  value={lossReason}
                  onChange={(event) => setLossReason(event.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff" }}
                >
                  <option>Abîmé</option>
                  <option>Cassé</option>
                  <option>Périmé</option>
                  <option>Détérioré</option>
                  <option>Autre</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                Observation (facultative)
                <textarea
                  value={lossNote}
                  onChange={(event) => setLossNote(event.target.value)}
                  rows={2}
                  placeholder="Précision sur les produits perdus..."
                  style={{ width: "100%", boxSizing: "border-box", padding: 11, border: "1px solid #cbd5e1", borderRadius: 9, resize: "vertical" }}
                />
              </label>
            </div>

            {lossNotice && (
              <p role="alert" style={{ background: "#fff7ed", color: "#9a3412", borderRadius: 8, padding: 10, fontSize: 13 }}>
                {lossNotice}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                disabled={lossSaving}
                onClick={() => setShowLossModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 9, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
              >Annuler</button>
              <button
                type="button"
                disabled={lossSaving || lossItems.length === 0}
                onClick={registerProductLoss}
                style={{ flex: 1, padding: 12, borderRadius: 9, border: 0, background: "#b91c1c", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: lossSaving || lossItems.length === 0 ? .55 : 1 }}
              >
                {lossSaving ? "Enregistrement..." : "Confirmer la perte"}
              </button>
            </div>
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