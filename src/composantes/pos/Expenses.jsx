import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./expenses.module.css";

function Expenses() {
  const navigate = useNavigate();

  // ==========================================
  // SESSION UTILISATEUR
  // ==========================================

  const [session, setSession] = useState(null);

  // ==========================================
  // CAISSE OUVERTE
  // ==========================================

  const [cashSession, setCashSession] = useState(null);
  const [cashLoading, setCashLoading] = useState(true);

  // ==========================================
  // FORMULAIRE
  // ==========================================

  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);

  // ==========================================
  // DÉPENSES
  // ==========================================

  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] =
    useState(true);

  // ==========================================
  // MESSAGE
  // ==========================================

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // ==========================================
  // RÉCUPÉRER LA SESSION LOCALE
  // ==========================================

  useEffect(() => {
    try {
      const savedSession =
        localStorage.getItem("storeSession");

      if (!savedSession) {
        setCashLoading(false);
        setLoadingExpenses(false);
        return;
      }

      const parsedSession = JSON.parse(savedSession);

      setSession(parsedSession);
    } catch (error) {
      console.error(
        "Erreur récupération session :",
        error
      );

      setCashLoading(false);
      setLoadingExpenses(false);
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
  // RÉCUPÉRER LA CAISSE OUVERTE
  // ==========================================

  useEffect(() => {
    if (!storeId || !userId) {
      if (session) {
        setCashLoading(false);
      }

      return;
    }

    setCashLoading(true);

    const cashSessionsRef = collection(
      db,
      "cashSessions"
    );

    const cashQuery = query(
      cashSessionsRef,
      where("storeId", "==", storeId),
      where("userId", "==", userId),
      where("status", "==", "open")
    );

    const unsubscribe = onSnapshot(
      cashQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const cashDocument = snapshot.docs[0];

          setCashSession({
            id: cashDocument.id,
            ...cashDocument.data(),
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
  // RÉCUPÉRER LES DÉPENSES
  // ==========================================

  useEffect(() => {
    if (!storeId || !cashSession?.id) {
      setExpenses([]);
      setLoadingExpenses(false);
      return;
    }

    setLoadingExpenses(true);

    const expensesRef = collection(
      db,
      "expenses"
    );

    /*
      On récupère uniquement les dépenses
      appartenant à cette caisse.

      Cela permet ensuite à la clôture de faire :

      ventes de la caisse
      - dépenses de la caisse
      = montant net
    */

    const expensesQuery = query(
      expensesRef,
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

        // Tri côté React pour éviter
        // d'avoir besoin immédiatement
        // d'un index Firestore composé.

        expensesData.sort((a, b) => {
          const dateA =
            getTimestampMilliseconds(
              a.createdAt
            );

          const dateB =
            getTimestampMilliseconds(
              b.createdAt
            );

          return dateB - dateA;
        });

        setExpenses(expensesData);
        setLoadingExpenses(false);
      },
      (error) => {
        console.error(
          "Erreur récupération dépenses :",
          error
        );

        setExpenses([]);
        setLoadingExpenses(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, cashSession?.id]);

  // ==========================================
  // CONVERTIR TIMESTAMP
  // ==========================================

  function getTimestampMilliseconds(timestamp) {
    if (!timestamp) {
      return 0;
    }

    if (
      typeof timestamp.toMillis === "function"
    ) {
      return timestamp.toMillis();
    }

    if (
      typeof timestamp.toDate === "function"
    ) {
      return timestamp.toDate().getTime();
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return 0;
    }

    return date.getTime();
  }

  // ==========================================
  // FORMAT DATE
  // ==========================================

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return "À l'instant";
    }

    let date;

    if (
      typeof timestamp.toDate === "function"
    ) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
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
  // FORMAT HEURE
  // ==========================================

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return "--:--";
    }

    let date;

    if (
      typeof timestamp.toDate === "function"
    ) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
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

  // ==========================================
  // FORMAT MONTANT
  // ==========================================

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString(
      "fr-FR"
    );
  };

  // ==========================================
  // TOTAL DÉPENSES
  // ==========================================

  const totalExpenses = useMemo(() => {
    return expenses.reduce(
      (total, expense) => {
        /*
          Plus tard, lorsqu'on ajoutera
          l'annulation d'une dépense,
          une dépense annulée ne sera
          plus comptabilisée.
        */

        if (
          expense.status === "cancelled"
        ) {
          return total;
        }

        return (
          total +
          Number(expense.amount || 0)
        );
      },
      0
    );
  }, [expenses]);

  // ==========================================
  // NOMBRE DE DÉPENSES
  // ==========================================

  const activeExpensesCount =
    useMemo(() => {
      return expenses.filter(
        (expense) =>
          expense.status !== "cancelled"
      ).length;
    }, [expenses]);

  // ==========================================
  // ENREGISTRER UNE DÉPENSE
  // ==========================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    // ------------------------------------------
    // Vérifier session
    // ------------------------------------------

    if (!storeId || !userId) {
      setErrorMessage(
        "Session utilisateur introuvable."
      );

      return;
    }

    // ------------------------------------------
    // Vérifier caisse
    // ------------------------------------------

    if (!cashSession?.id) {
      setErrorMessage(
        "Vous devez avoir une caisse ouverte pour enregistrer une dépense."
      );

      return;
    }

    // ------------------------------------------
    // Vérifier motif
    // ------------------------------------------

    const cleanReason = reason.trim();

    if (!cleanReason) {
      setErrorMessage(
        "Veuillez saisir le motif de la dépense."
      );

      return;
    }

    // ------------------------------------------
    // Vérifier montant
    // ------------------------------------------

    const expenseAmount = Number(amount);

    if (
      !Number.isFinite(expenseAmount) ||
      expenseAmount <= 0
    ) {
      setErrorMessage(
        "Veuillez saisir un montant valide."
      );

      return;
    }

    try {
      setSaving(true);

      // ========================================
      // CRÉER LA DÉPENSE
      // ========================================

      const expensesRef = collection(
        db,
        "expenses"
      );

      await addDoc(expensesRef, {
        // Magasin
        storeId,

        // Caisse
        cashSessionId:
          cashSession.id,

        // Utilisateur ayant effectué
        // la dépense
        userId,
        userName,
        userRole,

        // Informations dépense
        reason: cleanReason,
        amount: expenseAmount,
        note: note.trim(),

        // Statut
        status: "active",

        // Date
        createdAt:
          serverTimestamp(),

        // Champs prévus pour
        // l'annulation future
        cancelledAt: null,
        cancelledBy: null,
        cancelledByName: null,
        cancellationReason: null,
      });

      // ========================================
      // RÉINITIALISER FORMULAIRE
      // ========================================

      setReason("");
      setAmount("");
      setNote("");

      setMessage(
        "Dépense enregistrée avec succès."
      );
    } catch (error) {
      console.error(
        "Erreur enregistrement dépense :",
        error
      );

      setErrorMessage(
        "Impossible d'enregistrer la dépense. Vérifiez votre connexion."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // CHARGEMENT
  // ==========================================

  if (!session || cashLoading) {
    return (
      <div className={styles.page}>
        <div
          className={styles.loadingScreen}
        >
          <div
            className={styles.loadingIcon}
          >
            💸
          </div>

          <h2>Chargement</h2>

          <p>
            Vérification de votre
            caisse...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // PAS DE CAISSE OUVERTE
  // ==========================================

  if (!cashSession) {
    return (
      <div className={styles.page}>
        <div
          className={styles.emptyCashCard}
        >
          <div
            className={styles.emptyCashIcon}
          >
            🧾
          </div>

          <h2>Caisse fermée</h2>

          <p>
            Vous devez ouvrir votre
            caisse avant d'ajouter une
            dépense.
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

      {/* ======================================
          HEADER
      ====================================== */}

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
          <h1>Dépenses</h1>

          <p>
            Ajouter et consulter les
            dépenses de la caisse
          </p>
        </div>
      </header>

      {/* ======================================
          INFORMATIONS CAISSE
      ====================================== */}

      <section
        className={styles.cashInfo}
      >
        <div>
          <span>Caissier</span>

          <strong>
            {userName}
          </strong>
        </div>

        <div>
          <span>Rôle</span>

          <strong>
            {userRole}
          </strong>
        </div>

        <div>
          <span>Caisse</span>

          <strong
            className={
              styles.openStatus
            }
          >
            ● Ouverte
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
      </section>

      {/* ======================================
          CONTENU
      ====================================== */}

      <main className={styles.content}>

        {/* ====================================
            FORMULAIRE
        ==================================== */}

        <section
          className={styles.formCard}
        >
          <div
            className={styles.cardHeader}
          >
            <div>
              <h2>
                Nouvelle dépense
              </h2>

              <p>
                Enregistrer une sortie
                d'argent de la caisse
              </p>
            </div>

            <div
              className={styles.cardIcon}
            >
              💸
            </div>
          </div>

          {message && (
            <div
              className={
                styles.successMessage
              }
            >
              {message}
            </div>
          )}

          {errorMessage && (
            <div
              className={
                styles.errorMessage
              }
            >
              {errorMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className={styles.form}
          >
            {/* MOTIF */}

            <div
              className={styles.field}
            >
              <label htmlFor="reason">
                Motif de la dépense
              </label>

              <input
                id="reason"
                type="text"
                placeholder="Ex. Transport, repas, achat..."
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value
                  )
                }
                disabled={saving}
              />
            </div>

            {/* MONTANT */}

            <div
              className={styles.field}
            >
              <label htmlFor="amount">
                Montant
              </label>

              <div
                className={
                  styles.amountField
                }
              >
                <input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value
                    )
                  }
                  disabled={saving}
                />

                <span>FC</span>
              </div>
            </div>

            {/* NOTE */}

            <div
              className={`${styles.field} ${styles.fullWidth}`}
            >
              <label htmlFor="note">
                Note
                <small>
                  {" "}
                  (facultatif)
                </small>
              </label>

              <textarea
                id="note"
                placeholder="Ajouter une précision sur cette dépense..."
                value={note}
                onChange={(event) =>
                  setNote(
                    event.target.value
                  )
                }
                disabled={saving}
                rows={4}
              />
            </div>

            {/* BOUTON */}

            <div
              className={
                styles.formActions
              }
            >
              <button
                type="submit"
                className={
                  styles.saveButton
                }
                disabled={saving}
              >
                {saving
                  ? "Enregistrement..."
                  : "Enregistrer la dépense"}
              </button>
            </div>
          </form>
        </section>

        {/* ====================================
            RÉSUMÉ
        ==================================== */}

        <section
          className={styles.summaryCard}
        >
          <span>
            Total des dépenses
          </span>

          <strong>
            {formatMoney(
              totalExpenses
            )}{" "}
            FC
          </strong>

          <small>
            {activeExpensesCount} dépense
            {activeExpensesCount > 1
              ? "s"
              : ""}
          </small>
        </section>

        {/* ====================================
            HISTORIQUE DÉPENSES
        ==================================== */}

        <section
          className={styles.listCard}
        >
          <div
            className={styles.listHeader}
          >
            <div>
              <h2>
                Dépenses de la caisse
              </h2>

              <p>
                Dépenses enregistrées
                depuis l'ouverture
              </p>
            </div>

            <span>
              {activeExpensesCount}
            </span>
          </div>

          {/* CHARGEMENT */}

          {loadingExpenses && (
            <div
              className={
                styles.emptyMessage
              }
            >
              Chargement des dépenses...
            </div>
          )}

          {/* AUCUNE DÉPENSE */}

          {!loadingExpenses &&
            expenses.length === 0 && (
              <div
                className={
                  styles.emptyExpenses
                }
              >
                <div>💸</div>

                <strong>
                  Aucune dépense
                </strong>

                <p>
                  Les dépenses
                  enregistrées apparaîtront
                  ici.
                </p>
              </div>
            )}

          {/* LISTE */}

          {!loadingExpenses &&
            expenses.length > 0 && (
              <div
                className={
                  styles.expensesList
                }
              >
                {expenses.map(
                  (expense) => {
                    const cancelled =
                      expense.status ===
                      "cancelled";

                    return (
                      <div
                        key={expense.id}
                        className={`${styles.expenseItem} ${
                          cancelled
                            ? styles.cancelledExpense
                            : ""
                        }`}
                      >
                        <div
                          className={
                            styles.expenseMain
                          }
                        >
                          <div
                            className={
                              styles.expenseIcon
                            }
                          >
                            💸
                          </div>

                          <div
                            className={
                              styles.expenseInfo
                            }
                          >
                            <strong>
                              {expense.reason ||
                                "Dépense"}
                            </strong>

                            {expense.note && (
                              <p>
                                {
                                  expense.note
                                }
                              </p>
                            )}

                            <small>
                              {formatDate(
                                expense.createdAt
                              )}{" "}
                              à{" "}
                              {formatTime(
                                expense.createdAt
                              )}
                            </small>
                          </div>
                        </div>

                        <div
                          className={
                            styles.expenseRight
                          }
                        >
                          <strong>
                            {formatMoney(
                              expense.amount
                            )}{" "}
                            FC
                          </strong>

                          {cancelled ? (
                            <span
                              className={
                                styles.cancelledBadge
                              }
                            >
                              Annulée
                            </span>
                          ) : (
                            <span
                              className={
                                styles.activeBadge
                              }
                            >
                              Validée
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}

export default Expenses;