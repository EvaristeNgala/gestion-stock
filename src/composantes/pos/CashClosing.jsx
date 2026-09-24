import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./cashClosing.module.css";

function CashClosing() {
  const navigate = useNavigate();

  // ==========================================
  // SESSION UTILISATEUR
  // ==========================================

  const [session, setSession] = useState(null);

  // ==========================================
  // CAISSE
  // ==========================================

  const [cashSession, setCashSession] = useState(null);
  const [cashLoading, setCashLoading] = useState(true);
  const [closingCash, setClosingCash] = useState(false);

  // ==========================================
  // VENTES
  // ==========================================

  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);

  // ==========================================
  // DÉPENSES
  // ==========================================

  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] =
    useState(true);

  // ==========================================
  // MESSAGES
  // ==========================================

  const [errorMessage, setErrorMessage] = useState("");

  // ==========================================
  // RÉCUPÉRER SESSION LOCALE
  // ==========================================

  useEffect(() => {
    try {
      const savedSession =
        localStorage.getItem("storeSession");

      if (!savedSession) {
        setCashLoading(false);
        setSalesLoading(false);
        setExpensesLoading(false);
        return;
      }

      setSession(JSON.parse(savedSession));
    } catch (error) {
      console.error(
        "Erreur récupération session :",
        error
      );

      setCashLoading(false);
      setSalesLoading(false);
      setExpensesLoading(false);
    }
  }, []);

  // ==========================================
  // INFORMATIONS SESSION
  // ==========================================

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

  // ==========================================
  // RÉCUPÉRER CAISSE OUVERTE
  // ==========================================

  useEffect(() => {
    if (!storeId || !userId) {
      if (session) {
        setCashLoading(false);
      }

      return;
    }

    setCashLoading(true);

    const cashQuery = query(
      collection(db, "cashSessions"),
      where("storeId", "==", storeId),
      where("userId", "==", userId),
      where("status", "==", "open")
    );

    const unsubscribe = onSnapshot(
      cashQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const cashDoc = snapshot.docs[0];

          setCashSession({
            id: cashDoc.id,
            ...cashDoc.data(),
          });
        } else {
          setCashSession(null);
        }

        setCashLoading(false);
      },
      (error) => {
        console.error(
          "Erreur récupération caisse :",
          error
        );

        setCashSession(null);
        setCashLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, userId, session]);

  // ==========================================
  // RÉCUPÉRER LES VENTES DE LA CAISSE
  // ==========================================

  useEffect(() => {
    if (!storeId || !cashSession?.id) {
      setSales([]);
      setSalesLoading(false);
      return;
    }

    setSalesLoading(true);

    const salesQuery = query(
      collection(db, "sales"),
      where("storeId", "==", storeId),
      where(
        "cashSessionId",
        "==",
        cashSession.id
      )
    );

    const unsubscribe = onSnapshot(
      salesQuery,
      (snapshot) => {
        const salesData =
          snapshot.docs.map((saleDoc) => ({
            id: saleDoc.id,
            ...saleDoc.data(),
          }));

        setSales(salesData);
        setSalesLoading(false);
      },
      (error) => {
        console.error(
          "Erreur récupération ventes :",
          error
        );

        setSales([]);
        setSalesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, cashSession?.id]);

  // ==========================================
  // RÉCUPÉRER LES DÉPENSES
  // ==========================================

  useEffect(() => {
    if (!storeId || !cashSession?.id) {
      setExpenses([]);
      setExpensesLoading(false);
      return;
    }

    setExpensesLoading(true);

    const expensesQuery = query(
      collection(db, "expenses"),
      where("storeId", "==", storeId),
      where(
        "cashSessionId",
        "==",
        cashSession.id
      )
    );

    const unsubscribe = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const expensesData =
          snapshot.docs.map((expenseDoc) => ({
            id: expenseDoc.id,
            ...expenseDoc.data(),
          }));

        setExpenses(expensesData);
        setExpensesLoading(false);
      },
      (error) => {
        console.error(
          "Erreur récupération dépenses :",
          error
        );

        setExpenses([]);
        setExpensesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, cashSession?.id]);

  // ==========================================
  // VENTES VALIDES
  // ==========================================

  const validSales = useMemo(() => {
    return sales.filter((sale) => {
      return (
        sale.status !== "cancelled" &&
        sale.status !== "canceled" &&
        sale.status !== "annulled"
      );
    });
  }, [sales]);

  // ==========================================
  // VENTES ANNULÉES
  // ==========================================

  const cancelledSales = useMemo(() => {
    return sales.filter((sale) => {
      return (
        sale.status === "cancelled" ||
        sale.status === "canceled" ||
        sale.status === "annulled"
      );
    });
  }, [sales]);

  // ==========================================
  // DÉPENSES VALIDES
  // ==========================================

  const validExpenses = useMemo(() => {
    return expenses.filter(
      (expense) =>
        expense.status !== "cancelled"
    );
  }, [expenses]);

  // ==========================================
  // TOTAL VENTES
  // ==========================================

  const totalSales = useMemo(() => {
    return validSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0
    );
  }, [validSales]);

  // ==========================================
  // TOTAL VENTES ANNULÉES
  // ==========================================

  const totalCancelledSales =
    useMemo(() => {
      return cancelledSales.reduce(
        (sum, sale) =>
          sum + Number(sale.total || 0),
        0
      );
    }, [cancelledSales]);

  // ==========================================
  // TOTAL DÉPENSES
  // ==========================================

  const totalExpenses = useMemo(() => {
    return validExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(expense.amount || 0),
      0
    );
  }, [validExpenses]);

  // ==========================================
  // MONTANT NET
  // ==========================================

  /*
    Les ventes annulées sont déjà exclues
    de totalSales.

    On ne fait donc PAS :

    totalSales - ventesAnnulees - dépenses

    Sinon on soustrairait les ventes annulées
    deux fois.

    Le calcul correct est :
  */

  const netAmount =
    totalSales - totalExpenses;

  // ==========================================
  // FORMAT MONTANT
  // ==========================================

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString(
      "fr-FR"
    );
  };

  // ==========================================
  // FORMAT DATE
  // ==========================================

  const getDate = (timestamp) => {
    if (!timestamp) {
      return null;
    }

    if (
      typeof timestamp.toDate === "function"
    ) {
      return timestamp.toDate();
    }

    if (timestamp instanceof Date) {
      return timestamp;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  };

  const formatTime = (timestamp) => {
    const date = getDate(timestamp);

    if (!date) {
      return "--:--";
    }

    return date.toLocaleTimeString(
      "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const formatDate = (timestamp) => {
    const date = getDate(timestamp);

    if (!date) {
      return "--";
    }

    return date.toLocaleDateString(
      "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  };

  // ==========================================
  // FERMER LA CAISSE
  // ==========================================

  const closeCashRegister = async () => {
    if (!cashSession?.id) {
      return;
    }

    setErrorMessage("");

    const confirmation = window.confirm(
      `Voulez-vous vraiment fermer cette caisse ?

Ventes : ${formatMoney(totalSales)} FC
Dépenses : ${formatMoney(totalExpenses)} FC
Montant net : ${formatMoney(netAmount)} FC`
    );

    if (!confirmation) {
      return;
    }

    try {
      setClosingCash(true);

      const cashSessionRef = doc(
        db,
        "cashSessions",
        cashSession.id
      );

      // ======================================
      // ENREGISTRER LE RÉSUMÉ DE LA CAISSE
      // ======================================

      await updateDoc(cashSessionRef, {
        status: "closed",

        closedAt: serverTimestamp(),

        // Ventes
        totalSales,
        numberOfSales: validSales.length,

        // Annulations
        cancelledSales:
          cancelledSales.length,

        totalCancelledSales,

        // Dépenses
        totalExpenses,
        numberOfExpenses:
          validExpenses.length,

        // Net
        netAmount,

        // Informations de fermeture
        closedBy: userId,
        closedByName: userName,
        closedByRole: userRole,
      });

      /*
        Le onSnapshot de cashSessions
        va détecter automatiquement
        que la caisse n'est plus "open".

        Ensuite on retourne vers le POS.
      */

      navigate("/pos");
    } catch (error) {
      console.error(
        "Erreur fermeture caisse :",
        error
      );

      setErrorMessage(
        "Impossible de fermer la caisse. Vérifiez votre connexion et réessayez."
      );
    } finally {
      setClosingCash(false);
    }
  };

  // ==========================================
  // CHARGEMENT
  // ==========================================

  if (
    !session ||
    cashLoading ||
    salesLoading ||
    expensesLoading
  ) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingIcon}>
            🧾
          </div>

          <h2>
            Préparation de la clôture
          </h2>

          <p>
            Calcul des ventes et des
            dépenses de votre caisse...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUCUNE CAISSE
  // ==========================================

  if (!cashSession) {
    return (
      <div className={styles.page}>
        <div className={styles.noCashCard}>
          <div className={styles.noCashIcon}>
            🔒
          </div>

          <h2>
            Aucune caisse ouverte
          </h2>

          <p>
            Vous n'avez actuellement
            aucune caisse à clôturer.
          </p>

          <button
            type="button"
            className={styles.backPosButton}
            onClick={() =>
              navigate("/pos")
            }
          >
            Retour au POS
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className={styles.page}>

      {/* ====================================
          HEADER
      ==================================== */}

      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() =>
            navigate("/pos")
          }
        >
          ←
        </button>

        <div>
          <h1>
            Clôture de caisse
          </h1>

          <p>
            Vérifiez le résumé avant de
            fermer votre caisse
          </p>
        </div>
      </header>

      <main className={styles.content}>

        {/* ==================================
            CAISSE
        ================================== */}

        <section className={styles.cashCard}>
          <div className={styles.cashCardHeader}>
            <div>
              <span
                className={styles.openBadge}
              >
                ● CAISSE OUVERTE
              </span>

              <h2>{userName}</h2>

              <p>
                {userRole}
              </p>
            </div>

            <div className={styles.cashIcon}>
              🧾
            </div>
          </div>

          <div className={styles.cashDetails}>
            <div>
              <span>Date</span>

              <strong>
                {formatDate(
                  cashSession.openedAt
                )}
              </strong>
            </div>

            <div>
              <span>
                Heure d'ouverture
              </span>

              <strong>
                {formatTime(
                  cashSession.openedAt
                )}
              </strong>
            </div>
          </div>
        </section>

        {/* ==================================
            RÉSUMÉ
        ================================== */}

        <section className={styles.summarySection}>

          <div className={styles.summaryTitle}>
            <h2>
              Résumé de la caisse
            </h2>

            <p>
              Toutes les opérations depuis
              l'ouverture de cette caisse
            </p>
          </div>

          <div className={styles.summaryGrid}>

            {/* VENTES */}

            <div className={styles.summaryCard}>

              <div>
                <span>
                  Ventes réalisées
                </span>

                <strong>
                  {formatMoney(totalSales)} FC
                </strong>

                <small>
                  {validSales.length} vente
                  {validSales.length > 1
                    ? "s"
                    : ""}
                </small>
              </div>
            </div>

            {/* DÉPENSES */}

            <div className={styles.summaryCard}>

              <div>
                <span>
                  Dépenses
                </span>

                <strong
                  className={styles.expenseAmount}
                >
                  {formatMoney(
                    totalExpenses
                  )}{" "}
                  FC
                </strong>

                <small>
                  {validExpenses.length} dépense
                  {validExpenses.length > 1
                    ? "s"
                    : ""}
                </small>
              </div>
            </div>

            {/* ANNULATIONS */}

            <div className={styles.summaryCard}>

              <div>
                <span>
                  Ventes annulées
                </span>

                <strong
                  className={
                    styles.cancelledAmount
                  }
                >
                  {formatMoney(
                    totalCancelledSales
                  )}{" "}
                  FC
                </strong>

                <small>
                  {cancelledSales.length} annulation
                  {cancelledSales.length > 1
                    ? "s"
                    : ""}
                </small>
              </div>
            </div>

          </div>
        </section>

        {/* ==================================
            MONTANT NET
        ================================== */}

        <section className={styles.netCard}>
          <div>
            <span>
              Montant net de la caisse
            </span>

            <small>
              Ventes valides - dépenses
            </small>
          </div>

          <strong>
            {formatMoney(netAmount)} FC
          </strong>
        </section>

        {/* ==================================
            CALCUL
        ================================== */}

        <section className={styles.calculationCard}>
          <h3>
            Détail du calcul
          </h3>

          <div className={styles.calculationRow}>
            <span>
              Total ventes valides
            </span>

            <strong>
              {formatMoney(totalSales)} FC
            </strong>
          </div>

          <div className={styles.calculationRow}>
            <span>
              Dépenses
            </span>

            <strong
              className={styles.negativeAmount}
            >
              - {formatMoney(totalExpenses)} FC
            </strong>
          </div>

          <div
            className={`${styles.calculationRow} ${styles.calculationTotal}`}
          >
            <span>
              Montant net
            </span>

            <strong>
              {formatMoney(netAmount)} FC
            </strong>
          </div>
        </section>

        {/* ==================================
            INFORMATION ANNULATIONS
        ================================== */}

        {cancelledSales.length > 0 && (
          <section
            className={styles.cancelInfo}
          >
            <strong>
              ↩️ {cancelledSales.length} vente
              {cancelledSales.length > 1
                ? "s"
                : ""}{" "}
              annulée
              {cancelledSales.length > 1
                ? "s"
                : ""}
            </strong>

            <p>
              Montant total des ventes
              annulées :{" "}
              <strong>
                {formatMoney(
                  totalCancelledSales
                )}{" "}
                FC
              </strong>
              . Elles ne sont pas comprises
              dans le total des ventes
              valides.
            </p>
          </section>
        )}

        {/* ==================================
            ERREUR
        ================================== */}

        {errorMessage && (
          <div className={styles.errorMessage}>
            {errorMessage}
          </div>
        )}

        {/* ==================================
            ACTIONS
        ================================== */}

        <section className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() =>
              navigate("/pos")
            }
            disabled={closingCash}
          >
            Retour au POS
          </button>

          <button
            type="button"
            className={styles.closeCashButton}
            onClick={closeCashRegister}
            disabled={closingCash}
          >
            {closingCash
              ? "Fermeture en cours..."
              : "Fermer la caisse"}
          </button>
        </section>

      </main>
    </div>
  );
}

export default CashClosing;