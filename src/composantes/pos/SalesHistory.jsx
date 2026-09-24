import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./salesHistory.module.css";

function SalesHistory() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);

  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminCodeError, setAdminCodeError] = useState("");
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [cancellingSaleId, setCancellingSaleId] = useState(null);

  // ==============================
  // DATE FIRESTORE
  // ==============================

  const getDate = (timestamp) => {
    if (!timestamp) return null;

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate();
    }

    const date =
      timestamp instanceof Date
        ? timestamp
        : new Date(timestamp);

    return Number.isNaN(date.getTime()) ? null : date;
  };

  // ==============================
  // SESSION UTILISATEUR
  // ==============================

  useEffect(() => {
    try {
      const saved = localStorage.getItem("storeSession");

      if (saved) {
        setSession(JSON.parse(saved));
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Erreur session :", error);
      setLoading(false);
    }
  }, []);

  const storeId = session?.storeId || null;

  const userId =
    session?.uid ||
    session?.userId ||
    null;

  const userName =
    session?.userName ||
    session?.name ||
    session?.displayName ||
    "Utilisateur";

  const userRole =
    session?.role || "cashier";

  // ==============================
  // RÉCUPÉRER LES VENTES
  // ==============================
  // ADMIN : toutes les ventes du magasin.
  // AUTRES : uniquement leurs propres ventes.
  // ==============================

  useEffect(() => {
    if (!storeId || !userId) {
      return;
    }

    setLoading(true);

    let salesQuery;

    if (userRole === "admin") {
      salesQuery = query(
        collection(db, "sales"),
        where("storeId", "==", storeId)
      );
    } else {
      salesQuery = query(
        collection(db, "sales"),
        where("storeId", "==", storeId),
        where("userId", "==", userId)
      );
    }

    const unsubscribe = onSnapshot(
      salesQuery,
      (snapshot) => {
        const list = snapshot.docs.map((saleDoc) => ({
          id: saleDoc.id,
          ...saleDoc.data(),
        }));

        list.sort((a, b) => {
          const aTime =
            getDate(a.createdAt || a.paidAt)?.getTime() || 0;

          const bTime =
            getDate(b.createdAt || b.paidAt)?.getTime() || 0;

          return bTime - aTime;
        });

        setSales(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur ventes :", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, userId, userRole]);

  // ==============================
  // FORMATAGE
  // ==============================

  const formatMoney = (value) =>
    `${Number(value || 0).toLocaleString("fr-FR")} FC`;

  const formatDate = (timestamp) => {
    const date = getDate(timestamp);

    return date
      ? date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "--";
  };

  const formatTime = (timestamp) => {
    const date = getDate(timestamp);

    return date
      ? date.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";
  };

  // ==============================
  // VENTES DU JOUR
  // ==============================

  const isToday = (timestamp) => {
    const date = getDate(timestamp);

    if (!date) return false;

    const today = new Date();

    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const todaySales = useMemo(
    () =>
      sales.filter((sale) =>
        isToday(sale.createdAt || sale.paidAt)
      ),
    [sales]
  );

  const activeSales = todaySales.filter(
    (sale) => sale.status !== "cancelled"
  );

  const cancelledSales = todaySales.filter(
    (sale) => sale.status === "cancelled"
  );

  const totalToday = activeSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  // ==============================
  // FERMER LA MODAL DU CODE
  // ==============================

  const closeAdminCodeModal = () => {
    if (cancellingSaleId) return;

    setShowAdminCodeModal(false);
    setSaleToCancel(null);
    setAdminCode("");
    setAdminCodeError("");
  };

  // ==============================
  // DEMANDER ANNULATION
  // ==============================

  const requestCancellation = (sale) => {
    if (!sale || sale.status === "cancelled") {
      return;
    }

    if (userRole === "admin") {
      const confirmation = window.confirm(
        `Annuler cette vente de ${formatMoney(sale.total)} ?`
      );

      if (confirmation) {
        cancelSale(sale, {
          authorizedBy: userId,
          authorizedByName: userName,
          authorizationType: "admin-session",
        });
      }

      return;
    }

    setSaleToCancel(sale);
    setAdminCode("");
    setAdminCodeError("");
    setShowAdminCodeModal(true);
  };

  // ==============================
  // VÉRIFIER LE CODE ADMIN
  // ==============================
  // Le code utilisé est adminPosCode dans
  // settings/{storeId}.
  // ==============================

  const confirmCancellationWithAdminCode = async (event) => {
    event.preventDefault();

    if (!saleToCancel || !storeId) {
      return;
    }

    const enteredCode = adminCode.trim();

    if (!enteredCode) {
      setAdminCodeError(
        "Veuillez entrer le code administrateur."
      );
      return;
    }

    try {
      setAdminCodeError("");

      const settingsRef = doc(db, "settings", storeId);
      const settingsSnapshot = await getDoc(settingsRef);

      if (!settingsSnapshot.exists()) {
        setAdminCodeError(
          "Les paramètres du magasin sont introuvables."
        );
        return;
      }

      const storeSettings = settingsSnapshot.data();

      const savedAdminCode = String(
        storeSettings.adminPosCode || ""
      ).trim();

      if (!savedAdminCode) {
        setAdminCodeError(
          "Aucun code administrateur n'est configuré dans les paramètres."
        );
        return;
      }

      if (enteredCode !== savedAdminCode) {
        setAdminCodeError("Code administrateur incorrect.");
        return;
      }

      await cancelSale(saleToCancel, {
        authorizedBy: storeSettings.adminUid || null,
        authorizedByName:
          storeSettings.adminName || "Administrateur",
        authorizationType: "admin-code",
      });

      setShowAdminCodeModal(false);
      setSaleToCancel(null);
      setAdminCode("");
      setAdminCodeError("");
    } catch (error) {
      console.error(
        "Erreur vérification code administrateur :",
        error
      );

      setAdminCodeError(
        "Impossible de vérifier le code administrateur."
      );
    }
  };

  // ==============================
  // ANNULER LA VENTE
  // ==============================
  // IMPORTANT FIRESTORE :
  // toutes les lectures transaction.get() sont
  // exécutées AVANT toutes les écritures.
  // ==============================

  const cancelSale = async (sale, authorization) => {
    if (!sale || sale.status === "cancelled") {
      return;
    }

    try {
      setCancellingSaleId(sale.id);

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, "sales", sale.id);

        // ==========================================
        // PHASE 1 : TOUTES LES LECTURES
        // ==========================================

        const saleSnapshot = await transaction.get(saleRef);

        if (!saleSnapshot.exists()) {
          throw new Error("SALE_NOT_FOUND");
        }

        const currentSale = saleSnapshot.data();

        if (currentSale.storeId !== storeId) {
          throw new Error("INVALID_STORE");
        }

        if (currentSale.status === "cancelled") {
          throw new Error("ALREADY_CANCELLED");
        }

        const stockToRestore = {};

        if (Array.isArray(currentSale.items)) {
          currentSale.items.forEach((item) => {
            const productId = item.productId;

            if (!productId) return;

            const baseQuantity = Number(
              item.baseQuantity ??
                Number(item.quantity || 0) *
                  Number(item.variantQuantity || 1)
            );

            if (baseQuantity <= 0) return;

            stockToRestore[productId] =
              Number(stockToRestore[productId] || 0) +
              baseQuantity;
          });
        }

        const productEntries = Object.entries(stockToRestore);

        const productReads = [];

        for (const [productId, quantity] of productEntries) {
          const productRef = doc(db, "products", productId);
          const productSnapshot =
            await transaction.get(productRef);

          productReads.push({
            productRef,
            productSnapshot,
            quantity,
          });
        }

        let cashSessionRef = null;
        let cashSnapshot = null;

        if (currentSale.cashSessionId) {
          cashSessionRef = doc(
            db,
            "cashSessions",
            currentSale.cashSessionId
          );

          cashSnapshot =
            await transaction.get(cashSessionRef);
        }

        // ==========================================
        // PHASE 2 : TOUTES LES ÉCRITURES
        // ==========================================

        for (const {
          productRef,
          productSnapshot,
          quantity,
        } of productReads) {
          if (!productSnapshot.exists()) {
            continue;
          }

          const productData = productSnapshot.data();

          if (
            productData.storeId &&
            productData.storeId !== storeId
          ) {
            continue;
          }

          transaction.update(productRef, {
            stock:
              Number(productData.stock || 0) +
              Number(quantity || 0),
            updatedAt: serverTimestamp(),
          });
        }

        if (
          cashSessionRef &&
          cashSnapshot &&
          cashSnapshot.exists()
        ) {
          const cashData = cashSnapshot.data();

          const currentTotalSales = Number(
            cashData.totalSales || 0
          );

          const currentNumberOfSales = Number(
            cashData.numberOfSales || 0
          );

          transaction.update(cashSessionRef, {
            totalSales: Math.max(
              0,
              currentTotalSales -
                Number(currentSale.total || 0)
            ),
            numberOfSales: Math.max(
              0,
              currentNumberOfSales - 1
            ),
            cancelledSalesAmount:
              Number(
                cashData.cancelledSalesAmount || 0
              ) + Number(currentSale.total || 0),
            cancelledSalesCount:
              Number(
                cashData.cancelledSalesCount || 0
              ) + 1,
            updatedAt: serverTimestamp(),
          });
        }

        transaction.update(saleRef, {
          status: "cancelled",
          cancelledAt: serverTimestamp(),

          cancelledBy: userId,
          cancelledByName: userName,
          cancelledByRole: userRole,

          cancellationAuthorizedBy:
            authorization?.authorizedBy || null,
          cancellationAuthorizedByName:
            authorization?.authorizedByName ||
            "Administrateur",
          cancellationAuthorizationType:
            authorization?.authorizationType ||
            "admin-session",

          stockRestored: true,
          updatedAt: serverTimestamp(),
        });
      });

      setSelectedSale((current) =>
        current?.id === sale.id
          ? {
              ...current,
              status: "cancelled",
              cancelledBy: userId,
              cancelledByName: userName,
              cancellationAuthorizedByName:
                authorization?.authorizedByName ||
                "Administrateur",
              stockRestored: true,
            }
          : current
      );
    } catch (error) {
      console.error("Erreur annulation :", error);

      if (error?.message === "ALREADY_CANCELLED") {
        alert("Cette vente a déjà été annulée.");
      } else if (error?.message === "SALE_NOT_FOUND") {
        alert("Cette vente n'existe plus.");
      } else if (error?.message === "INVALID_STORE") {
        alert("Cette vente n'appartient pas à ce magasin.");
      } else {
        alert(
          "Impossible d'annuler la vente. Vérifiez votre connexion et réessayez."
        );
      }

      throw error;
    } finally {
      setCancellingSaleId(null);
    }
  };

  // ==============================
  // SESSION INTROUVABLE
  // ==============================

  if (!session) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <h2>Session introuvable</h2>

          <p>
            Reconnectez-vous au magasin pour consulter
            les ventes.
          </p>

          <button
            type="button"
            onClick={() => navigate("/pos")}
          >
            Retour au POS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate("/pos")}
        >
          ←
        </button>

        <div>
          <h1>Historique des ventes</h1>

          <p>
            {userRole === "admin"
              ? "Ventes du magasin aujourd'hui"
              : "Mes ventes effectuées aujourd'hui"}
          </p>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span>Ventes</span>
            <strong>{activeSales.length}</strong>
          </div>

          <div className={styles.summaryCard}>
            <span>Total vendu</span>
            <strong>{formatMoney(totalToday)}</strong>
          </div>

          <div className={styles.summaryCard}>
            <span>Annulées</span>
            <strong>{cancelledSales.length}</strong>
          </div>
        </section>

        <section className={styles.salesSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>
                {userRole === "admin"
                  ? "Ventes du jour"
                  : "Mes ventes du jour"}
              </h2>

              <p>
                Cliquez sur une vente pour voir son détail.
              </p>
            </div>

            <span>{todaySales.length} vente(s)</span>
          </div>

          {loading ? (
            <div className={styles.message}>
              Chargement des ventes...
            </div>
          ) : todaySales.length === 0 ? (
            <div className={styles.message}>
              Aucune vente aujourd'hui.
            </div>
          ) : (
            <div className={styles.salesList}>
              {todaySales.map((sale) => {
                const articleCount = Array.isArray(sale.items)
                  ? sale.items.reduce(
                      (sum, item) =>
                        sum + Number(item.quantity || 0),
                      0
                    )
                  : 0;

                return (
                  <button
                    type="button"
                    key={sale.id}
                    className={`${styles.saleCard} ${
                      sale.status === "cancelled"
                        ? styles.cancelledSale
                        : ""
                    }`}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <div className={styles.saleTop}>
                      <div>
                        <strong>
                          Vente #
                          {sale.saleNumber ||
                            sale.id.slice(0, 6)}
                        </strong>

                        <span>
                          {formatDate(
                            sale.createdAt || sale.paidAt
                          )}{" "}
                          •{" "}
                          {formatTime(
                            sale.createdAt || sale.paidAt
                          )}
                        </span>

                        {userRole === "admin" && (
                          <span>
                            Vendeur :{" "}
                            {sale.userName || "Utilisateur"}
                          </span>
                        )}
                      </div>

                      <strong className={styles.saleAmount}>
                        {formatMoney(sale.total)}
                      </strong>
                    </div>

                    <div className={styles.saleBottom}>
                      <span>
                        {articleCount} article
                        {articleCount > 1 ? "s" : ""}
                      </span>

                      <span
                        className={
                          sale.status === "cancelled"
                            ? styles.cancelledStatus
                            : styles.paidStatus
                        }
                      >
                        {sale.status === "cancelled"
                          ? "ANNULÉE"
                          : "PAYÉE"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {selectedSale && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedSale(null)}
        >
          <div
            className={styles.saleModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2>Détail de la vente</h2>

                <p>
                  {formatDate(
                    selectedSale.createdAt ||
                      selectedSale.paidAt
                  )}{" "}
                  à{" "}
                  {formatTime(
                    selectedSale.createdAt ||
                      selectedSale.paidAt
                  )}
                </p>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setSelectedSale(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.saleInfo}>
                <div>
                  <span>Vendeur</span>
                  <strong>
                    {selectedSale.userName ||
                      "Utilisateur"}
                  </strong>
                </div>

                <div>
                  <span>Paiement</span>
                  <strong>
                    {selectedSale.paymentMethod === "cash"
                      ? "Espèces"
                      : selectedSale.paymentMethod ||
                        "Espèces"}
                  </strong>
                </div>
              </div>

              <div className={styles.itemsList}>
                {Array.isArray(selectedSale.items) &&
                selectedSale.items.length > 0 ? (
                  selectedSale.items.map(
                    (item, index) => (
                      <div
                        className={styles.itemRow}
                        key={`${
                          item.productId || index
                        }-${index}`}
                      >
                        <div>
                          <strong>
                            {item.name || "Produit"}
                          </strong>

                          <span>
                            {item.variantType || "Unité"} ×{" "}
                            {Number(item.quantity || 0)}
                          </span>
                        </div>

                        <strong>
                          {formatMoney(
                            Number(item.price || 0) *
                              Number(
                                item.quantity || 0
                              )
                          )}
                        </strong>
                      </div>
                    )
                  )
                ) : (
                  <div className={styles.noItems}>
                    Détail des articles indisponible.
                  </div>
                )}
              </div>

              <div className={styles.amounts}>
                <div>
                  <span>Total</span>
                  <strong>
                    {formatMoney(selectedSale.total)}
                  </strong>
                </div>

                <div>
                  <span>Montant reçu</span>
                  <strong>
                    {formatMoney(
                      selectedSale.amountReceived ??
                        selectedSale.cashReceived ??
                        selectedSale.total
                    )}
                  </strong>
                </div>

                <div>
                  <span>Monnaie rendue</span>
                  <strong>
                    {formatMoney(
                      selectedSale.change ??
                        selectedSale.changeAmount ??
                        0
                    )}
                  </strong>
                </div>
              </div>

              {selectedSale.status === "cancelled" && (
                <div className={styles.cancelledNotice}>
                  <strong>Cette vente a été annulée.</strong>

                  {selectedSale.cancelledByName && (
                    <span>
                      Annulée par :{" "}
                      {selectedSale.cancelledByName}
                    </span>
                  )}

                  {selectedSale
                    .cancellationAuthorizedByName && (
                    <span>
                      Autorisée par :{" "}
                      {
                        selectedSale
                          .cancellationAuthorizedByName
                      }
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {selectedSale.status !== "cancelled" && (
                <button
                  type="button"
                  className={styles.cancelSaleButton}
                  onClick={() =>
                    requestCancellation(selectedSale)
                  }
                  disabled={
                    cancellingSaleId === selectedSale.id
                  }
                >
                  {cancellingSaleId === selectedSale.id
                    ? "Annulation..."
                    : "Annuler la vente"}
                </button>
              )}

              <button
                type="button"
                className={styles.closeModalButton}
                onClick={() => setSelectedSale(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminCodeModal && saleToCancel && (
        <div
          className={styles.adminCodeOverlay}
          onClick={closeAdminCodeModal}
        >
          <form
            className={styles.adminCodeModal}
            onSubmit={confirmCancellationWithAdminCode}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.adminCodeIcon}>🔐</div>

            <h2>Autorisation administrateur</h2>

            <p>
              L'annulation de cette vente nécessite
              l'autorisation d'un administrateur.
            </p>

            <div className={styles.saleToCancelInfo}>
              <span>Vente à annuler</span>
              <strong>
                {formatMoney(saleToCancel.total)}
              </strong>
            </div>

            <label className={styles.adminCodeField}>
              <span>Code administrateur</span>

              <input
                type="password"
                inputMode="numeric"
                autoFocus
                autoComplete="off"
                value={adminCode}
                onChange={(event) => {
                  setAdminCode(event.target.value);
                  setAdminCodeError("");
                }}
                placeholder="Entrez le code"
                disabled={Boolean(cancellingSaleId)}
              />
            </label>

            {adminCodeError && (
              <div className={styles.adminCodeError}>
                {adminCodeError}
              </div>
            )}

            <div className={styles.adminCodeActions}>
              <button
                type="button"
                className={styles.adminCodeCancel}
                onClick={closeAdminCodeModal}
                disabled={Boolean(cancellingSaleId)}
              >
                Retour
              </button>

              <button
                type="submit"
                className={styles.adminCodeConfirm}
                disabled={Boolean(cancellingSaleId)}
              >
                {cancellingSaleId
                  ? "Annulation..."
                  : "Autoriser l'annulation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default SalesHistory;
