import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import ReceiptPrinter from "../../plugins/receiptPrinter";

import {

  collection,

  doc,

  getDoc,

  getDocsFromServer,

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
  const [offlineSales, setOfflineSales] = useState([]);
  const [localHistory, setLocalHistory] = useState([]);
  const OFFLINE_SALES_KEY = "stockManagerOfflineSales";
  const LOCAL_HISTORY_KEY = "stockManagerLocalSalesHistory";

  const [loading, setLoading] = useState(true);

  const [selectedSale, setSelectedSale] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);



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



    // Tous les employés autorisés consultent les ventes du magasin.
    const salesQuery = query(
      collection(db, "sales"),
      where("storeId", "==", storeId)
    );

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

  }, [storeId, userId]);



  // ==============================
  // VENTES LOCALES EN ATTENTE
  // ==============================
  useEffect(() => {
    const loadOfflineSales = () => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(OFFLINE_SALES_KEY) || "[]"
        );
        setOfflineSales(Array.isArray(saved) ? saved : []);
        const history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || "[]");
        setLocalHistory(Array.isArray(history) ? history : []);
      } catch (error) {
        console.error("Erreur lecture ventes locales :", error);
        setOfflineSales([]);
        setLocalHistory([]);
      }
    };

    loadOfflineSales();
    window.addEventListener("storage", loadOfflineSales);
    window.addEventListener("online", loadOfflineSales);
    window.addEventListener("focus", loadOfflineSales);
    window.addEventListener("stockManagerSalesChanged", loadOfflineSales);
    return () => {
      window.removeEventListener("storage", loadOfflineSales);
      window.removeEventListener("online", loadOfflineSales);
      window.removeEventListener("focus", loadOfflineSales);
      window.removeEventListener("stockManagerSalesChanged", loadOfflineSales);
    };
  }, []);

  // Firebase + historique permanent local + ventes encore en attente.
  // Une même vente conserve son offlineSaleId après synchronisation.
  const allSales = useMemo(() => {
    const combined = new Map();
    const pendingIds = new Set(offlineSales.map((sale) => sale.offlineSaleId));
    for (const sale of [...localHistory, ...offlineSales]) {
      if (sale.storeId !== storeId) continue;
      // Les ventes locales restent limitées au magasin courant.
      const key = sale.offlineSaleId || sale.id;
      if (!key) continue;
      combined.set(key, {
        ...sale,
        id: key,
        isPendingLocal: pendingIds.has(key),
        status: pendingIds.has(key) ? "pending_sync" : sale.status,
      });
    }
    // Les documents serveur prévalent, notamment pour les annulations.
    for (const sale of sales) {
      const key = sale.offlineSaleId || sale.id;
      if (key) combined.set(key, { ...sale, isPendingLocal: false });
    }
    return Array.from(combined.values()).sort((a, b) => {
      const dateA = getDate(a.offlineCreatedAt || a.createdAt || a.paidAt);
      const dateB = getDate(b.offlineCreatedAt || b.createdAt || b.paidAt);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }, [sales, offlineSales, localHistory, storeId]);

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

      allSales.filter((sale) =>

        isToday(sale.offlineCreatedAt || sale.createdAt || sale.paidAt)

      ),

    [allSales]

  );



  const activeSales = todaySales.filter(

    (sale) => sale.status !== "cancelled"

  );



  const cancelledSales = todaySales.filter(

    (sale) => sale.status === "cancelled"

  );



  const totalToday = activeSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0), 0
  );
  const collectedToday = allSales.reduce((sum, sale) => {
    if (sale.status === "cancelled") return sum;
    if (Array.isArray(sale.paymentHistory)) {
      return sum + sale.paymentHistory.reduce((paymentSum, payment) => {
        return paymentSum + (isToday(payment.paidAt) ? Number(payment.amount || 0) : 0);
      }, 0);
    }
    return sum + (isToday(sale.offlineCreatedAt || sale.createdAt || sale.paidAt)
      ? Number(sale.amountReceived ?? sale.cashReceived ?? sale.total ?? 0)
      : 0);
  }, 0);

  // Dettes encore ouvertes, y compris les ventes des jours précédents.
  // Cela permet d'enregistrer un paiement lorsque le client revient plus tard.
  const outstandingSales = useMemo(() => {
    return allSales.filter((sale) => {
      if (sale.status === "cancelled" || sale.isPendingLocal) return false;
      const remaining = Number(
        sale.remainingAmount ??
        Math.max(0, Number(sale.total || 0) - Number(
          sale.amountReceived ?? sale.cashReceived ?? (sale.paymentStatus ? 0 : sale.total)
        ))
      );
      return remaining > 0 && ["unpaid", "partial"].includes(sale.paymentStatus);
    });
  }, [allSales]);

  // Enregistrer un paiement total ou partiel sur une vente à crédit.
  const recordCustomerPayment = async () => {
    if (!selectedSale || savingPayment) return;
    if (!navigator.onLine) {
      alert("Une connexion Internet est nécessaire pour enregistrer un paiement client.");
      return;
    }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Saisissez un montant valide.");
      return;
    }
    setSavingPayment(true);
    try {
      const openCashSnapshot = await getDocsFromServer(query(
        collection(db, "cashSessions"),
        where("storeId", "==", storeId),
        where("userId", "==", userId),
        where("status", "==", "open")
      ));
      if (openCashSnapshot.empty) throw new Error("NO_OPEN_CASH");
      const activeCashSessionId = openCashSnapshot.docs[0].id;
      const saleRef = doc(db, "sales", selectedSale.id);
      await runTransaction(db, async (transaction) => {
        const saleSnapshot = await transaction.get(saleRef);
        if (!saleSnapshot.exists()) throw new Error("SALE_NOT_FOUND");
        const current = saleSnapshot.data();
        if (current.storeId !== storeId) throw new Error("INVALID_STORE");
        if (current.status === "cancelled") throw new Error("SALE_CANCELLED");
        const total = Number(current.total || 0);
        const alreadyReceived = Number(current.amountReceived ?? current.cashReceived ?? 0);
        const remaining = Math.max(0, total - alreadyReceived);
        if (amount > remaining) throw new Error("PAYMENT_TOO_HIGH");
        const nextReceived = alreadyReceived + amount;
        const nextRemaining = Math.max(0, total - nextReceived);
        const nextStatus = nextRemaining === 0 ? "paid" : "partial";
        const cashRef = doc(db, "cashSessions", activeCashSessionId);
        const cashSnapshot = await transaction.get(cashRef);
        if (!cashSnapshot.exists()) throw new Error("NO_OPEN_CASH");
        transaction.update(saleRef, {
          amountReceived: nextReceived,
          remainingAmount: nextRemaining,
          paymentStatus: nextStatus,
          paymentMethod: current.paymentMethod === "credit" ? "cash" : (current.paymentMethod || "cash"),
          paymentHistory: [...(Array.isArray(current.paymentHistory) ? current.paymentHistory : []), {
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
      setSelectedSale((current) => current ? {
        ...current,
        amountReceived: Number(current.amountReceived || 0) + amount,
        remainingAmount: Math.max(0, Number(current.total || 0) - Number(current.amountReceived || 0) - amount),
        paymentStatus: Number(current.total || 0) - Number(current.amountReceived || 0) - amount <= 0 ? "paid" : "partial",
      } : current);
      setPaymentAmount("");
      alert("Paiement client enregistré avec succès.");
    } catch (error) {
      console.error("Erreur enregistrement paiement client :", error);
      const messages = {
        SALE_NOT_FOUND: "Cette vente est introuvable.",
        INVALID_STORE: "Cette vente n'appartient pas à ce magasin.",
        SALE_CANCELLED: "Impossible d'encaisser une vente annulée.",
        PAYMENT_TOO_HIGH: "Le montant dépasse le reste à payer.",
        NO_OPEN_CASH: "Ouvrez votre caisse avant d'enregistrer un paiement client.",
      };
      alert(messages[error.message] || "Impossible d'enregistrer le paiement.");
    } finally {
      setSavingPayment(false);
    }
  };

  // Réimpression à partir de la vente sélectionnée, jamais du ticket courant.
  const reprintSale = async (sale) => {
    if (!sale || printing) return;
    setPrinting(true);
    const clean = (value) => String(value ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?");
    const money = (value) => `${Math.round(Number(value || 0)).toLocaleString("en-US").replace(/,/g, " ")} FC`;
    const date = getDate(sale.offlineCreatedAt || sale.createdAt || sale.paidAt);
    const lines = [
      "STOCK MANAGER", "COPIE DU TICKET", "--------------------------------",
      `Vente: ${clean(sale.saleNumber || sale.id || "-")}`,
      `Date: ${date ? clean(date.toLocaleString("fr-FR")) : "-"}`,
      `Caissier: ${clean(sale.userName || "Utilisateur")}`,
      "--------------------------------",
    ];
    for (const item of sale.items || []) {
      lines.push(clean(`${item.name || "Produit"}${item.variantType ? ` (${item.variantType})` : ""}`));
      lines.push(clean(`${Number(item.quantity || 0)} x ${money(item.price)} = ${money(Number(item.quantity || 0) * Number(item.price || 0))}`));
    }
    lines.push("--------------------------------", `TOTAL: ${money(sale.total)}`);
    if (sale.customerName) lines.push(`Client: ${clean(sale.customerName)}`);
    const received = sale.amountReceived ?? sale.cashReceived ?? sale.received;
    const remaining = sale.remainingAmount ?? Math.max(0, Number(sale.total || 0) - Number(received || 0));
    const change = sale.change ?? sale.changeAmount;
    if (received != null) lines.push(`Encaisse: ${money(received)}`);
    if (remaining > 0) lines.push(`Reste a payer: ${money(remaining)}`);
    if (change != null) lines.push(`Monnaie: ${money(change)}`);
    if (["cancelled", "canceled", "annulled"].includes(sale.status)) lines.push("*** VENTE ANNULEE ***");
    if (sale.isPendingLocal) lines.push("*** EN ATTENTE DE SYNCHRO ***");
    lines.push("--------------------------------", "Merci pour votre achat !", "", "", "");
    try {
      if (Capacitor.isNativePlatform()) {
        const address = localStorage.getItem(`stockManagerBluetoothPrinter:${storeId}`);
        if (!address) throw new Error("Aucune imprimante Bluetooth configurée. Configurez-la depuis le menu POS.");
        await ReceiptPrinter.printBluetoothReceipt({ address, text: lines.join("\n") });
      } else {
        const popup = window.open("", "_blank", "width=420,height=650");
        if (!popup) throw new Error("Autorisez les fenêtres contextuelles pour imprimer le ticket.");
        const escaped = lines.join("\n").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        popup.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Ticket ${String(sale.saleNumber || sale.id || "")}</title><style>@page{size:58mm auto;margin:2mm}body{font:11px monospace;white-space:pre-wrap;width:54mm;margin:0}</style></head><body>${escaped}</body></html>`);
        popup.document.close();
        popup.focus();
        popup.print();
      }
    } catch (error) {
      console.error("Réimpression impossible :", error);
      alert(error?.message || "Impossible de réimprimer le ticket.");
    } finally {
      setPrinting(false);
    }
  };

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



        // Répartir les montants encaissés entre les caisses qui les ont reçus.
        // Les paiements partiels peuvent avoir été réalisés pendant des sessions différentes.
        const paymentTotalsBySession = {};
        if (Array.isArray(currentSale.paymentHistory) && currentSale.paymentHistory.length > 0) {
          currentSale.paymentHistory.forEach((payment) => {
            const sessionId = payment.cashSessionId || currentSale.cashSessionId;
            if (!sessionId) return;
            paymentTotalsBySession[sessionId] = Number(paymentTotalsBySession[sessionId] || 0) + Number(payment.amount || 0);
          });
        } else if (currentSale.cashSessionId) {
          const received = Number((currentSale.amountReceived ?? currentSale.cashReceived ?? (currentSale.paymentStatus ? 0 : currentSale.total)) || 0);
          paymentTotalsBySession[currentSale.cashSessionId] = received;
        }

        const cashSessionReads = [];
        for (const [sessionId, collectedAmount] of Object.entries(paymentTotalsBySession)) {
          const cashRef = doc(db, "cashSessions", sessionId);
          const cashSnapshot = await transaction.get(cashRef);
          cashSessionReads.push({ sessionId, cashRef, cashSnapshot, collectedAmount });
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



        for (const { sessionId, cashRef, cashSnapshot, collectedAmount } of cashSessionReads) {
          if (!cashSnapshot.exists()) continue;
          const cashData = cashSnapshot.data();
          const isOriginalSaleSession = sessionId === currentSale.cashSessionId;
          transaction.update(cashRef, {
            totalSales: Math.max(0, Number(cashData.totalSales || 0) - Number(collectedAmount || 0)),
            ...(isOriginalSaleSession ? {
              numberOfSales: Math.max(0, Number(cashData.numberOfSales || 0) - 1),
              cancelledSalesCount: Number(cashData.cancelledSalesCount || 0) + 1,
            } : {}),
            cancelledSalesAmount: Number(cashData.cancelledSalesAmount || 0) + Number(collectedAmount || 0),
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

            Toutes les ventes du magasin aujourd'hui

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
            <span>Montant encaissé</span>
            <strong>{formatMoney(collectedToday)}</strong>
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

                Ventes du jour

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

                            sale.offlineCreatedAt || sale.createdAt || sale.paidAt

                          )}{" "}

                          •{" "}

                          {formatTime(

                            sale.offlineCreatedAt || sale.createdAt || sale.paidAt

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

                            : sale.isPendingLocal
                            ? styles.paidStatus
                            : styles.paidStatus

                        }

                      >

                        {sale.status === "cancelled"

                          ? "ANNULÉE"

                          : sale.isPendingLocal
                          ? "EN ATTENTE DE SYNCHRO"
                          : sale.paymentStatus === "unpaid"
                          ? "NON ENCAISSÉE"
                          : sale.paymentStatus === "partial"
                          ? "PARTIELLEMENT PAYÉE"
                          : "PAYÉE"}

                      </span>

                    </div>

                  </button>

                );

              })}

            </div>

          )}

        </section>

        <section className={styles.salesSection} style={{ marginTop: 20 }}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Clients à crédit</h2>
              <p>Ventes non réglées ou partiellement réglées, même si elles datent d'un autre jour.</p>
            </div>
            <span>{outstandingSales.length} dette(s)</span>
          </div>

          {outstandingSales.length === 0 ? (
            <div className={styles.message}>Aucun montant restant à encaisser.</div>
          ) : (
            <div className={styles.salesList}>
              {outstandingSales.map((sale) => {
                const remaining = Number(
                  sale.remainingAmount ??
                  Math.max(0, Number(sale.total || 0) - Number(sale.amountReceived || 0))
                );
                return (
                  <button
                    type="button"
                    key={sale.id}
                    className={styles.saleCard}
                    onClick={() => { setSelectedSale(sale); setPaymentAmount(""); }}
                  >
                    <div className={styles.saleTop}>
                      <div>
                        <strong>{sale.customerName || "Client sans nom"}</strong>
                        <span>Vente #{sale.saleNumber || sale.id.slice(0, 6)} • {formatDate(sale.offlineCreatedAt || sale.createdAt || sale.paidAt)}</span>
                        {sale.customerPhone && <span>{sale.customerPhone}</span>}
                      </div>
                      <strong className={styles.saleAmount}>{formatMoney(remaining)}</strong>
                    </div>
                    <div className={styles.saleBottom}>
                      <span>Reste à payer</span>
                      <span className={styles.paidStatus}>{sale.paymentStatus === "partial" ? "PARTIELLEMENT PAYÉE" : "NON ENCAISSÉE"}</span>
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

                    selectedSale.offlineCreatedAt || selectedSale.createdAt ||

                      selectedSale.paidAt

                  )}{" "}

                  à{" "}

                  {formatTime(

                    selectedSale.offlineCreatedAt || selectedSale.createdAt ||

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



            {selectedSale.isPendingLocal && (
                <p style={{padding:"10px 14px", background:"#fff7ed", color:"#9a3412", borderRadius:10, margin:"12px 16px"}}>
                  Vente enregistrée sur ce terminal, en attente de synchronisation avec Firebase.
                </p>
              )}
              <div className={styles.modalContent}>

              <div className={styles.saleInfo}>

                <div>

                  <span>Vendeur</span>

                  <strong>

                    {selectedSale.userName ||

                      "Utilisateur"}

                  </strong>

                </div>



                {selectedSale.customerName && (
                  <div>
                    <span>Client</span>
                    <strong>{selectedSale.customerName}</strong>
                    {selectedSale.customerPhone && <small>{selectedSale.customerPhone}</small>}
                  </div>
                )}
                <div>

                  <span>Paiement</span>

                  <strong>

                    {selectedSale.paymentStatus === "unpaid"
                      ? "Vente à crédit"
                      : selectedSale.paymentMethod === "cash"
                      ? "Espèces"
                      : selectedSale.paymentMethod || "Espèces"}

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

                        (selectedSale.paymentStatus ? 0 : selectedSale.total)

                    )}

                  </strong>

                </div>



                <div>
                  <span>Reste à payer</span>
                  <strong>{formatMoney(selectedSale.remainingAmount ?? Math.max(0, Number(selectedSale.total || 0) - Number(selectedSale.amountReceived ?? selectedSale.cashReceived ?? (selectedSale.paymentStatus ? 0 : selectedSale.total))))}</strong>
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



              {Array.isArray(selectedSale.paymentHistory) && selectedSale.paymentHistory.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", borderRadius: 10 }}>
                  <strong>Historique des paiements</strong>
                  {selectedSale.paymentHistory.map((payment, index) => (
                    <div key={`${payment.paidAt || index}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 8, fontSize: 13 }}>
                      <span>{formatDate(payment.paidAt)} {payment.userName ? `• ${payment.userName}` : ""}</span>
                      <strong>{formatMoney(payment.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}

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



            {selectedSale.status !== "cancelled" && !selectedSale.isPendingLocal && Number(selectedSale.remainingAmount ?? Math.max(0, Number(selectedSale.total || 0) - Number(selectedSale.amountReceived ?? selectedSale.cashReceived ?? (selectedSale.paymentStatus ? 0 : selectedSale.total)))) > 0 && (
              <div style={{ margin: "0 16px 16px", padding: 14, border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 12 }}>
                <strong>Enregistrer un paiement client</strong>
                <p style={{ margin: "6px 0 10px", fontSize: 13 }}>Le client peut régler sa dette en plusieurs fois.</p>
                <input
                  type="number"
                  min="1"
                  max={Number(selectedSale.remainingAmount ?? Math.max(0, Number(selectedSale.total || 0) - Number(selectedSale.amountReceived || 0)))}
                  inputMode="numeric"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Montant reçu en FC"
                  style={{ width: "100%", padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" }}
                />
                <button type="button" className={styles.closeModalButton} onClick={recordCustomerPayment} disabled={savingPayment || !paymentAmount || Number(paymentAmount) <= 0} style={{ marginTop: 10, width: "100%" }}>
                  {savingPayment ? "Enregistrement..." : "Enregistrer le paiement"}
                </button>
              </div>
            )}

            <div className={styles.modalFooter}>

              <button
                type="button"
                className={styles.closeModalButton}
                onClick={() => reprintSale(selectedSale)}
                disabled={printing}
              >
                {printing ? "Impression..." : "🖨 Réimprimer le ticket"}
              </button>

              {selectedSale.status !== "cancelled" && !selectedSale.isPendingLocal && sales.some(s => s.id === selectedSale.id) && (

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
