import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";



import {

  collection,

  doc,

  onSnapshot,

  getDocs,

  getDoc,

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

  const [cashCounted, setCashCounted] = useState("");

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {

    const update = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", update);

    window.addEventListener("offline", update);

    return () => {

      window.removeEventListener("online", update);

      window.removeEventListener("offline", update);

    };

  }, []);

  const getPendingSales = () => {

    try {

      const saved = JSON.parse(localStorage.getItem("stockManagerOfflineSales") || "[]");

      return Array.isArray(saved) ? saved : [];

    } catch {

      return null; // Ne pas clôturer si la file locale est illisible.

    }

  };



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



  // Une dépense n'est déduite de l'espèce que si elle a été payée en liquide.

  // Pour les anciens enregistrements sans mode de paiement, vérifier la configuration.

  const cashExpenses = validExpenses.filter((expense) =>

    ["cash", "cashier", "espèces", "especes", "liquide"].includes(

      String(expense.paymentMethod || expense.paymentType || "").toLowerCase()

    )

  );

  const hasUnclassifiedExpenses = validExpenses.some(

    (expense) => !expense.paymentMethod && !expense.paymentType

  );

  const cashExpenseTotal = cashExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const openingFloat = Number(cashSession?.openingAmount ?? cashSession?.openingCash ?? cashSession?.openingBalance ?? 0);

  const hasOpeningFloat = ["openingAmount", "openingCash", "openingBalance"].some(

    (key) => cashSession && cashSession[key] !== undefined && cashSession[key] !== null

  );

  // Toutes les ventes POS actuelles sont en espèces; revoir si d'autres modes sont ajoutés.

  const theoreticalCash = openingFloat + totalSales - cashExpenseTotal;

  const countedNumber = cashCounted.trim() === "" ? null : Number(cashCounted);

  const discrepancy = countedNumber === null ? null : countedNumber - theoreticalCash;

  const pendingSales = getPendingSales();

  const pendingCount = pendingSales?.length ?? null;



  const closeCashRegister = async () => {

    if (!cashSession?.id || closingCash) return;

    setErrorMessage("");

    if (!navigator.onLine) {

      setErrorMessage("Connexion Internet obligatoire pour clôturer la caisse. Revenez en ligne et synchronisez les ventes.");

      return;

    }

    if (pendingCount === null || pendingCount > 0) {

      setErrorMessage(pendingCount === null

        ? "Impossible de lire les ventes locales. Ne fermez pas la caisse."

        : `${pendingCount} vente(s) locale(s) attendent une synchronisation. Retournez au POS pour terminer la synchronisation.`);

      return;

    }

    if (hasUnclassifiedExpenses) {

      setErrorMessage("Certaines dépenses n'ont pas de mode de paiement. Indiquez si elles ont été payées depuis la caisse avant de clôturer.");

      return;

    }

    if (!hasOpeningFloat) {

      setErrorMessage("Le fonds de caisse initial n'est pas renseigné dans cette session. Renseignez-le avant de clôturer.");

      return;

    }

    if (countedNumber === null || !Number.isFinite(countedNumber) || countedNumber < 0) {

      setErrorMessage("Saisissez le montant réel des espèces comptées dans la caisse.");

      return;

    }

    if (!window.confirm(`Confirmer la clôture ?\nEspèces attendues : ${formatMoney(theoreticalCash)} FC\nEspèces comptées : ${formatMoney(countedNumber)} FC\nÉcart : ${formatMoney(discrepancy)} FC`)) return;

    try {

      setClosingCash(true);

      // Relire le serveur juste avant de clôturer : ne pas se fier au seul état affiché.

      const cashRef = doc(db, "cashSessions", cashSession.id);

      const freshCash = await getDoc(cashRef);

      if (!freshCash.exists() || freshCash.data().status !== "open" ||

          freshCash.data().storeId !== storeId || freshCash.data().userId !== userId) {

        throw new Error("La session de caisse n'est plus ouverte ou ne correspond pas à l'utilisateur.");

      }

      const [freshSalesSnap, freshExpensesSnap] = await Promise.all([

        getDocs(query(collection(db, "sales"), where("storeId", "==", storeId), where("cashSessionId", "==", cashSession.id))),

        getDocs(query(collection(db, "expenses"), where("storeId", "==", storeId), where("cashSessionId", "==", cashSession.id))),

      ]);

      const serverSales = freshSalesSnap.docs.map((d) => d.data());

      const serverExpenses = freshExpensesSnap.docs.map((d) => d.data());

      const valid = serverSales.filter((sale) => !["cancelled", "canceled", "annulled"].includes(sale.status));

      const cancelled = serverSales.filter((sale) => ["cancelled", "canceled", "annulled"].includes(sale.status));

      const validCosts = serverExpenses.filter((expense) => expense.status !== "cancelled");

      const unknownCosts = validCosts.filter((expense) => !expense.paymentMethod && !expense.paymentType);

      if (unknownCosts.length) throw new Error("Des dépenses n'ont pas de mode de paiement : vérifiez-les avant clôture.");

      const cashCosts = validCosts.filter((expense) => ["cash", "cashier", "espèces", "especes", "liquide"].includes(String(expense.paymentMethod || expense.paymentType || "").toLowerCase()));

      const finalSales = valid.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

      const finalExpenses = validCosts.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

      const finalCashExpenses = cashCosts.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

      const freshOpening = Number(freshCash.data().openingAmount ?? freshCash.data().openingCash ?? freshCash.data().openingBalance ?? NaN);

      if (!Number.isFinite(freshOpening)) throw new Error("Fonds de caisse initial manquant.");

      const finalExpected = freshOpening + finalSales - finalCashExpenses;

      if (getPendingSales()?.length !== 0) throw new Error("De nouvelles ventes sont en attente de synchronisation.");

      await updateDoc(cashRef, {

        status: "closed", closedAt: serverTimestamp(),

        totalSales: finalSales, numberOfSales: valid.length,

        cancelledSales: cancelled.length,

        totalCancelledSales: cancelled.reduce((sum, sale) => sum + Number(sale.total || 0), 0),

        totalExpenses: finalExpenses, numberOfExpenses: validCosts.length,

        cashExpenses: finalCashExpenses,

        netAmount: finalSales - finalExpenses,

        openingFloat: freshOpening,

        expectedCash: finalExpected,

        countedCash: countedNumber,

        cashDifference: countedNumber - finalExpected,

        closedBy: userId, closedByName: userName, closedByRole: userRole,

      });

      localStorage.removeItem("stockManagerActiveCashier");
        localStorage.removeItem("posRequireSelection");
        localStorage.removeItem("posActiveUser");
        localStorage.removeItem("storeSession");
        navigate("/pin", { replace: true });

    } catch (error) {

      console.error("Erreur fermeture caisse :", error);

      setErrorMessage(error.message || "Impossible de fermer la caisse. Vérifiez la connexion.");

    } finally {

      setClosingCash(false);

    }

  };

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



        <section className={styles.calculationCard}>

          <h3>Contrôle des espèces</h3>

          <div className={styles.calculationRow}><span>Fonds de caisse initial</span><strong>{hasOpeningFloat ? `${formatMoney(openingFloat)} FC` : "Non renseigné"}</strong></div>

          <div className={styles.calculationRow}><span>Ventes encaissées</span><strong>{formatMoney(totalSales)} FC</strong></div>

          <div className={styles.calculationRow}><span>Dépenses payées en espèces</span><strong>- {formatMoney(cashExpenseTotal)} FC</strong></div>

          <div className={styles.calculationRow}><span>Espèces théoriques attendues</span><strong>{formatMoney(theoreticalCash)} FC</strong></div>

          <label style={{display:"block", marginTop:16, fontWeight:700}} htmlFor="cash-counted">Espèces réellement comptées (FC)</label>

          <input id="cash-counted" type="number" min="0" step="0.01" inputMode="decimal" value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} placeholder="Montant compté" style={{width:"100%",padding:12,marginTop:8,border:"1px solid #cbd5e1",borderRadius:9,fontSize:16}} />

          {discrepancy !== null && <div className={styles.calculationRow} style={{marginTop:12}}><span>Écart de caisse</span><strong style={{color: discrepancy === 0 ? "#15803d" : "#b45309"}}>{formatMoney(discrepancy)} FC</strong></div>}

          <p style={{fontSize:12,color:"#64748b",marginTop:12}}>Heure de clôture : {new Date().toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"})}</p>

          {hasUnclassifiedExpenses && <p style={{color:"#b45309"}}>Certaines dépenses n'ont pas de mode de paiement. Leur provenance doit être précisée.</p>}

        </section>

        {!isOnline && <p style={{color:"#b45309"}}>Hors connexion : clôture impossible.</p>}

        {pendingCount !== 0 && <p style={{color:"#b45309"}}>{pendingCount === null ? "File des ventes illisible" : `${pendingCount} vente(s) en attente de synchronisation`}. Retournez au POS.</p>}



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

            disabled={closingCash || !isOnline || pendingCount !== 0 || !hasOpeningFloat || hasUnclassifiedExpenses}

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