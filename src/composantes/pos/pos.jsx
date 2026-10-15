import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

const ReceiptPrinter = registerPlugin("ReceiptPrinter");

import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  runTransaction,
  getDocsFromServer,
  getDocs,
} from "firebase/firestore";

import { db } from "../../firebase";
import styles from "./pos.module.css";

function POS() {
  // ==============================
  // PRODUITS / TICKET
  // ==============================
  const navigate = useNavigate();
  const [showPosMenu, setShowPosMenu] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printerDevices, setPrinterDevices] = useState([]);
  const [printerAddress, setPrinterAddress] = useState("");
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerNotice, setPrinterNotice] = useState("");
  const [autoPrint, setAutoPrint] = useState(false);
  const [leavingStore, setLeavingStore] = useState(false);
  const [logoutPin, setLogoutPin] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  // ==============================
// VERROUILLAGE DU POS
// ==============================

const [posLocked, setPosLocked] = useState(false);
const [unlockCode, setUnlockCode] = useState("");
const [unlockError, setUnlockError] = useState("");
const [unlocking, setUnlocking] = useState(false);

// 5 minutes sans activité
const POS_INACTIVITY_TIME = 5 * 60 * 1000;
  const [products, setProducts] = useState([]);
  const [ticket, setTicket] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(
    "Tous les articles"
  );
  const [loading, setLoading] = useState(true);

  // Produit actuellement sélectionné
  // pour la modal des variantes
  const [selectedProduct, setSelectedProduct] =
    useState(null);

  // Variante actuellement sélectionnée
  // pour choisir sa quantité
  const [selectedVariant, setSelectedVariant] =
    useState(null);

  // Quantité de la variante à ajouter
  const [variantQuantity, setVariantQuantity] =
    useState(1);

  // Affichage de la modal du ticket
  const [showTicket, setShowTicket] = useState(false);

  // ==============================
  // SESSION UTILISATEUR
  // ==============================

  const [session, setSession] = useState(null);
  // L'identité de caisse est toujours celle du compte connecté.
  const posChoosingUser = false;
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [selectedCashierId, setSelectedCashierId] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [openingPin, setOpeningPin] = useState("");
  const [pinChecking, setPinChecking] = useState(false);
  const [pinError, setPinError] = useState("");

  // ==============================
  // CAISSE
  // ==============================

  const [cashSession, setCashSession] = useState(null);

  const [cashLoading, setCashLoading] =
    useState(true);

  const [openingCash, setOpeningCash] =
    useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingAmountError, setOpeningAmountError] = useState("");

  const [closingCash, setClosingCash] =
    useState(false);

  // Paiement en cours
  const [paying, setPaying] = useState(false);

  // Étapes du ticket : ticket -> paiement -> reçu
  const [ticketStep, setTicketStep] = useState("ticket");
  const [cashReceived, setCashReceived] = useState("");
  const [lastSale, setLastSale] = useState(null);
  const [savingTicket, setSavingTicket] = useState(false);

  // ==============================
// ÉTAT DE LA CONNEXION
// ==============================

const [isOnline, setIsOnline] = useState(
  navigator.onLine
);

// ==============================
// VENTES EN ATTENTE DE SYNCHRO
// ==============================

const [pendingSalesCount, setPendingSalesCount] =
  useState(0);

const [syncingSales, setSyncingSales] = useState(false);
const syncBusyRef = useRef(false);
const [showSyncCenter, setShowSyncCenter] = useState(false);
const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
const [syncErrors, setSyncErrors] = useState({});
const [syncNotice, setSyncNotice] = useState("");
const getSyncErrorLabel = (error) => {
  const message = String(error?.message || "");
  if (message.includes("SYNC_STOCK_INSUFFICIENT")) return "Conflit de stock : intervention de l'administrateur requise";
  if (message.includes("SYNC_PRODUCT_NOT_FOUND")) return "Produit introuvable : intervention de l'administrateur requise";
  if (message.includes("SYNC_CASH_SESSION_NOT_FOUND")) return "Session de caisse introuvable";
  if (error?.code === "permission-denied") return "Accès Firebase refusé : vérifier les autorisations";
  if (error?.code === "unavailable" || error?.code === "deadline-exceeded") return "Connexion à Firebase indisponible";
  return "Échec de synchronisation : consulter les journaux ou réessayer";
};

useEffect(() => {
  const handleOnline = () => {
    console.log("🟢 Connexion Internet rétablie");
    // Afficher le suivi seulement au retour de connexion,
    // et uniquement si des ventes hors ligne attendent un envoi.
    try {
      const sales = JSON.parse(localStorage.getItem("stockManagerOfflineSales") || "[]");
      if (Array.isArray(sales) && sales.length > 0) {
        setShowSyncCenter(true);
      }
    } catch (error) {
      console.error("Lecture des ventes en attente impossible", error);
    }
    setIsOnline(true);
  };

  const handleOffline = () => {
    console.log("🟠 Connexion Internet perdue");
    setIsOnline(false);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);


// ==============================
// VENTES HORS CONNEXION
// ==============================

const OFFLINE_SALES_KEY = "stockManagerOfflineSales";
// Historique durable sur cet appareil, distinct de la file de synchronisation.
const LOCAL_HISTORY_KEY = "stockManagerLocalSalesHistory";
const persistLocalSale = (sale) => {
  const existing = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || "[]");
  const list = Array.isArray(existing) ? existing : [];
  const key = sale.offlineSaleId;
  const index = list.findIndex((item) => item.offlineSaleId === key);
  if (index >= 0) list[index] = { ...list[index], ...sale };
  else list.push(sale);
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("stockManagerSalesChanged"));
};


const getOfflineSales = () => {
  try {
    const saved =
      localStorage.getItem(OFFLINE_SALES_KEY);

    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error(
      "Erreur lecture ventes hors ligne :",
      error
    );

    return [];
  }
};

const saveOfflineSales = (sales) => {
  localStorage.setItem(
    OFFLINE_SALES_KEY,
    JSON.stringify(sales)
  );

  setPendingSalesCount(sales.length);
  window.dispatchEvent(new Event("stockManagerSalesChanged"));
};


// ==============================
// CHARGER LES VENTES EN ATTENTE
// ==============================

useEffect(() => {
  const offlineSales = getOfflineSales();

  setPendingSalesCount(offlineSales.length);
}, []);


  // ==============================
  // RÉCUPÉRER LA SESSION
  // ==============================

  useEffect(() => {
    try {
      const savedSession =
        localStorage.getItem("storeSession");

      if (savedSession) {
        const parsedSession =
          JSON.parse(savedSession);

        setSession(parsedSession);
      } else {
        console.warn(
          "Aucune session utilisateur trouvée."
        );

        setCashLoading(false);
      }
    } catch (error) {
      console.error(
        "Erreur récupération session :",
        error
      );

      setCashLoading(false);
    }
  }, []);

  // ==============================
  // INFORMATIONS SESSION
  // ==============================

  const storeId = session?.storeId || null;

  const connectedUserId = session?.uid || session?.userId || null;
  const connectedUserName = session?.userName || session?.name || session?.displayName || "Utilisateur";
  const connectedRole = session?.role || "cashier";
  const CASHIER_KEY = "stockManagerActiveCashier";
  const isAdminSession = connectedRole === "admin" && session?.loginMode === "admin";
  const printerKey = `stockManagerBluetoothPrinter:${storeId}`;
  const autoPrintKey = `stockManagerAutoPrint:${storeId}`;
  useEffect(() => {
    if (!storeId) return;
    setPrinterAddress(localStorage.getItem(printerKey) || "");
    setAutoPrint(localStorage.getItem(autoPrintKey) === "true");
  }, [storeId]);

  const openPrinterSettings = () => {
    setShowPosMenu(false);
    setPrinterNotice("");
    setShowPrinterSettings(true);
  };
  const searchPrinters = async () => {
    setPrinterBusy(true);
    setPrinterNotice("");
    try {
      if (!Capacitor.isNativePlatform()) throw new Error("Disponible dans l'APK Android uniquement.");
      const result = await ReceiptPrinter.getBluetoothPrinters();
      const devices = Array.isArray(result?.devices) ? result.devices : [];
      setPrinterDevices(devices);
      setPrinterNotice(devices.length ? `${devices.length} imprimante(s)/appareil(s) associé(s).` : "Aucun appareil Bluetooth associé trouvé.");
    } catch (error) {
      setPrinterNotice(error?.message || "Recherche Bluetooth impossible.");
    } finally { setPrinterBusy(false); }
  };
  const testPrinter = async () => {
    if (!printerAddress) return;
    setPrinterBusy(true);
    setPrinterNotice("");
    try {
      const result = await ReceiptPrinter.testBluetoothPrinter({ address: printerAddress });
      setPrinterNotice(result?.message || "Test envoyé. Vérifiez la sortie papier.");
    } catch (error) {
      setPrinterNotice(error?.message || "Échec de l'impression du ticket de test.");
    } finally { setPrinterBusy(false); }
  };

  // Déconnexion complète du magasin, réservée à l'administrateur.
  // Ne jamais effacer les données locales de ventes, même après synchronisation.
  const disconnectStore = async (event) => {
    event.preventDefault();
    if (!isAdminSession || logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError("");
    try {
      if (!navigator.onLine) throw new Error("Connexion Internet nécessaire pour quitter le magasin.");
      if (syncBusyRef.current || getOfflineSales().length > 0) {
        throw new Error("Synchronisez d'abord toutes les ventes hors connexion.");
      }
      if (ticket.length > 0 || showTicket) throw new Error("Terminez ou videz le ticket en cours.");
      // Contrôle serveur de toutes les caisses du magasin, pas uniquement de celle affichée.
      const openSessions = await getDocsFromServer(query(
        collection(db, "cashSessions"), where("storeId", "==", storeId), where("status", "==", "open")
      ));
      if (!openSessions.empty) throw new Error("Une caisse est encore ouverte dans ce magasin. Clôturez-la avant de vous déconnecter.");
      const settingsSnap = await getDoc(doc(db, "settings", storeId));
      const expectedPin = String(settingsSnap.data()?.adminPosCode ?? "").trim();
      if (!/^\d{4}$/.test(logoutPin) || !expectedPin || logoutPin !== expectedPin) {
        throw new Error("Code PIN administrateur incorrect.");
      }
      if (!window.confirm("Quitter complètement ce magasin sur ce terminal ? Une nouvelle connexion email et mot de passe sera nécessaire.")) return;
      await signOut(auth);
      localStorage.removeItem("stockManagerDeviceStore");
      localStorage.removeItem("storeSession");
      localStorage.removeItem("stockManagerActiveCashier");
      setLeavingStore(false);
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error?.message || "Déconnexion impossible.");
    } finally { setLogoutBusy(false); }
  };


  // Identité POS : toujours celle de la session connectée.
  // Ne jamais réutiliser l'ancien caissier sauvegardé sur cet appareil.
  useEffect(() => {
    if (!storeId || !connectedUserId) {
      setAuthorizedUsers([]);
      setSelectedCashierId("");
      setUsersLoading(false);
      return;
    }
    setUsersLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, "users", connectedUserId),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        const isAdmin = connectedRole === "admin" && session?.loginMode === "admin";
        const allowed = isAdmin || (
          data?.storeId === storeId &&
          data?.status !== "inactive" &&
          data?.canAccessPOS !== false &&
          data?.permissions?.pos === true
        );
        setAuthorizedUsers(allowed ? [{
          id: connectedUserId,
          name: data?.name || connectedUserName,
          role: data?.role || connectedRole
        }] : []);
        setSelectedCashierId(allowed ? connectedUserId : "");
        setUsersError(allowed ? "" : "Ce compte n'est pas autorisé à utiliser la caisse.");
        setUsersLoading(false);
      },
      (error) => {
        console.error("Vérification de l'utilisateur POS :", error);
        setAuthorizedUsers([]);
        setSelectedCashierId("");
        setUsersError("Impossible de vérifier les droits de ce compte.");
        setUsersLoading(false);
      }
    );
    return () => unsubscribe();
  }, [storeId, connectedUserId, connectedRole, connectedUserName, session?.loginMode]);

  const selectedCashier = authorizedUsers.find((u) => u.id === connectedUserId);
  const userId = selectedCashier?.id || null;
  const userName = selectedCashier?.name || connectedUserName;
  const userRole = selectedCashier?.role || connectedRole;

  // Garder le caissier actif pour les pages de clôture et d'historique.
  useEffect(() => {
    if (!cashSession?.id || !storeId || !userId) return;
    localStorage.setItem(CASHIER_KEY, JSON.stringify({
      storeId, userId, userName, role: userRole, cashSessionId: cashSession.id,
    }));
  }, [cashSession?.id, storeId, userId, userName, userRole]);

  // ==============================
// VERROUILLER LE POS
// ==============================

// Déconnexion contrôlée : vérifier la caisse dans Firestore, et non
// seulement dans l'état React (qui peut être périmé).
// La déconnexion générale se fait uniquement depuis le Dashboard.
// La caisse se clôture dans CashClosing ; ensuite le POS demande un autre utilisateur.
const lockPOS = () => {
  setShowPosMenu(false);
  setUnlockCode("");
  setUnlockError("");
  setPosLocked(true);
};

// ==============================
// VERROUILLAGE AUTOMATIQUE
// ==============================

useEffect(() => {
  // Le compteur ne doit fonctionner que
  // lorsqu'une caisse est réellement ouverte.
  if (!cashSession || posLocked) {
    return;
  }

  let inactivityTimer = null;

  const startTimer = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    inactivityTimer = setTimeout(() => {
      setShowPosMenu(false);
      setUnlockCode("");
      setUnlockError("");
      setPosLocked(true);
    }, POS_INACTIVITY_TIME);
  };

  const handleActivity = () => {
    startTimer();
  };

  const events = [
    "mousedown",
    "touchstart",
    "keydown",
    "click",
  ];

  events.forEach((eventName) => {
    window.addEventListener(
      eventName,
      handleActivity
    );
  });

  startTimer();

  return () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    events.forEach((eventName) => {
      window.removeEventListener(
        eventName,
        handleActivity
      );
    });
  };
}, [cashSession, posLocked]);

// ==============================
// DÉVERROUILLER LE POS
// ==============================

// Utiliser les champs réellement enregistrés par Settings et Employees.
// Pour l'admin : settings/{storeId}.adminPosCode est prioritaire.
// Pour un employé : users/{userId}.code est prioritaire.
const verifyCashierPin = async (cashierId, cashierRole, enteredPin) => {
  if (!storeId || !cashierId) throw new Error("Utilisateur ou magasin introuvable.");
  const snap = await getDoc(doc(db, "users", cashierId));
  const data = snap.exists() ? snap.data() : null;
  // Seul l'administrateur de la session connectée peut utiliser le
  // compte admin sans document users. Ne pas se fier au rôle affiché seul.
  const isConnectedAdmin = connectedRole === "admin" && cashierId === connectedUserId;
  const isAdmin = data?.role === "admin" || (!data && isConnectedAdmin && cashierRole === "admin");
  if (!data && !isAdmin) throw new Error("Compte utilisateur introuvable.");
  if (data && (data.storeId !== storeId || data.status === "inactive" || data.canAccessPOS === false)) {
    throw new Error("Utilisateur non autorisé à utiliser le POS.");
  }
  if (!isAdmin && data?.permissions?.pos !== true) {
    throw new Error("Cet employé n'a pas accès au POS.");
  }
  let expected = "";
  if (isAdmin) {
    const settingsSnap = await getDoc(doc(db, "settings", storeId));
    expected = settingsSnap.exists() ? String(settingsSnap.data().adminPosCode ?? "").trim() : "";
    if (!expected) expected = String(data?.code || data?.posPin || "").trim();
  } else {
    expected = String(data?.code || data?.posPin || "").trim();
  }
  if (!expected) throw new Error(isAdmin ? "Configurez le code administrateur dans Paramètres." : "Aucun code POS configuré pour cet employé.");
  if (expected !== enteredPin.trim()) throw new Error("Code PIN incorrect.");
  return true;
};

const unlockPOS = async (event) => {
  event.preventDefault();
  const enteredCode = unlockCode.trim();
  if (!enteredCode) {
    setUnlockError("Veuillez entrer votre code.");
    return;
  }
  // Toujours vérifier le propriétaire de la caisse verrouillée,
  // même si la sélection d'utilisateur est actualisée entre-temps.
  const lockedCashierId = cashSession?.userId;
  const lockedCashierRole = cashSession?.role || userRole;
  if (!storeId || !cashSession?.id || !lockedCashierId) {
    setUnlockError("Aucune session de caisse active pour cet utilisateur.");
    return;
  }
  if (!navigator.onLine) {
    setUnlockError("Connexion Internet nécessaire pour déverrouiller le POS.");
    return;
  }
  try {
    setUnlocking(true);
    setUnlockError("");
    // Le code du propriétaire de la caisse reste valable. Le code
    // administrateur du même magasin peut aussi déverrouiller cette caisse,
    // sans changer son propriétaire ni créer une nouvelle session.
    let authorized = false;
    let ownerError = null;
    try {
      await verifyCashierPin(lockedCashierId, lockedCashierRole, enteredCode);
      authorized = true;
    } catch (error) {
      ownerError = error;
    }

    if (!authorized) {
      // Autorisation supplémentaire : code administrateur du magasin.
      // Le document settings est lié au storeId courant, pas au caissier.
      const adminSettings = await getDoc(doc(db, "settings", storeId));
      const adminData = adminSettings.exists() ? adminSettings.data() : null;
      const adminPin = String(adminData?.adminPosCode ?? "").trim();
      const sameStore = !adminData?.storeId || adminData.storeId === storeId;
      if (sameStore && adminPin && adminPin === enteredCode) {
        authorized = true;
      }
    }

    if (!authorized) {
      // Ne pas divulguer si un code administrateur existe ou non.
      if (ownerError?.code === "permission-denied") throw ownerError;
      throw new Error("Code PIN incorrect.");
    }
    setPosLocked(false);
    setUnlockCode("");
    setUnlockError("");
  } catch (error) {
    console.error("Erreur déverrouillage POS :", error);
    setUnlockError(error?.message || "Impossible de vérifier le code. Vérifiez votre connexion.");
    setUnlockCode("");
  } finally {
    setUnlocking(false);
  }
};
  // ==============================
  // VÉRIFIER LA CAISSE
  // ==============================

  useEffect(() => {
    if (!storeId || !userId) {
      setCashSession(null);
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
          const cashDoc =
            snapshot.docs[0];

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
          "Erreur vérification caisse :",
          error
        );

        setCashSession(null);
        setCashLoading(false);
      }
    );

    return () => unsubscribe();
  }, [storeId, userId, session]);

  // ==============================
  // OUVRIR LA CAISSE
  // ==============================

  const openCashRegister = async () => {
    if (!storeId || !userId || !selectedCashier) {
            return;
    }

    if (cashSession) {
      return;
    }

    // Le fonds initial peut être égal à zéro, mais doit être renseigné.
    const enteredAmount = openingAmount.trim().replace(",", ".");
    const amount = Number(enteredAmount);
    if (enteredAmount === "" || !Number.isFinite(amount) || amount < 0) {
      setOpeningAmountError("Indiquez un montant valide (0 autorisé).");
      return;
    }
    if (!navigator.onLine) {
      setOpeningAmountError("Connexion Internet nécessaire pour ouvrir la caisse.");
      return;
    }
    setOpeningAmountError("");
    setPinError("");
    setOpeningPin("");
    setPinModalOpen(true);
  };

  const confirmOpenCashRegister = async (event) => {
    event.preventDefault();
    if (!openingPin.trim() || !storeId || !userId || !selectedCashier) return;
    if (!navigator.onLine) {
      setPinError("Connexion Internet nécessaire pour vérifier le PIN.");
      return;
    }
    setPinChecking(true);
    setPinError("");
    try {
      // Même vérification pour ouvrir et déverrouiller la caisse.
      await verifyCashierPin(userId, userRole, openingPin);
      if (cashSession) throw new Error("Une caisse est déjà ouverte.");
      const alreadyOpen = await getDocsFromServer(query(
        collection(db, "cashSessions"),
        where("storeId", "==", storeId),
        where("userId", "==", userId),
        where("status", "==", "open")
      ));
      if (!alreadyOpen.empty) throw new Error("Cet utilisateur a déjà une caisse ouverte.");
      const amount = Number(openingAmount.trim().replace(",", "."));
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Fonds initial invalide.");
      setOpeningCash(true);

      const cashSessionsRef =
        collection(db, "cashSessions");

      const newCashSession = {
        storeId,
        userId,
        userName,
        role: userRole,
        openedAt: serverTimestamp(),
        closedAt: null,
        status: "open",
        openingAmount: amount,
        openingCurrency: "FC",
        totalSales: 0,
        numberOfSales: 0,
        createdAt: serverTimestamp(),
      };

      const documentReference =
        await addDoc(
          cashSessionsRef,
          newCashSession
        );

      setCashSession({
        id: documentReference.id,
        ...newCashSession,
        openedAt: new Date(),
      });

      setOpeningAmount("");
      setPinModalOpen(false);
    } catch (error) {
      console.error(
        "Erreur ouverture caisse :",
        error
      );

      setPinError(error.message || "Impossible d'ouvrir la caisse.");
    } finally {
      setOpeningCash(false);
      setPinChecking(false);
      setOpeningPin("");
    }
  };

  // ==============================
  // FERMER LA CAISSE
  // ==============================

  const closeCashRegister = async () => {
    if (!cashSession?.id) {
      return;
    }

    if (ticket.length > 0) {
      setShowTicket(true);

      return;
    }

    if (syncBusyRef.current || getOfflineSales().length > 0) {
      setShowSyncCenter(true);
       return;
    }
    if (!navigator.onLine) {
       return;
    }
    const confirmation = window.confirm(
      "Voulez-vous vraiment fermer la caisse ?"
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

      await updateDoc(
        cashSessionRef,
        {
          closedAt: serverTimestamp(),
          status: "closed",
        }
      );

      setCashSession(null);
      setTicket([]);
    } catch (error) {
      console.error(
        "Erreur fermeture caisse :",
        error
      );
    } finally {
      setClosingCash(false);
    }
  };

  // ==============================
  // FORMAT HEURE
  // ==============================

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return "--:--";
    }

    let date;

    if (
      typeof timestamp.toDate ===
      "function"
    ) {
      date = timestamp.toDate();
    } else if (
      timestamp instanceof Date
    ) {
      date = timestamp;
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

  // ==============================
  // RÉCUPÉRATION DES PRODUITS
  // ==============================

  useEffect(() => {
  // Attendre que la session utilisateur soit disponible
  if (!storeId) {
    setProducts([]);
    setLoading(false);
    return;
  }

  setLoading(true);

  // Charger uniquement les produits
  // appartenant au magasin connecté
  const productsQuery = query(
    collection(db, "products"),
    where("storeId", "==", storeId)
  );

  const unsubscribe = onSnapshot(
    productsQuery,

    // ==============================
    // DONNÉES REÇUES
    // ==============================
    (snapshot) => {
      const productsData = snapshot.docs.map(
        (productDoc) => ({
          id: productDoc.id,
          ...productDoc.data(),
        })
      );

      setProducts(productsData);
      setLoading(false);

      // Permet de savoir si les données
      // proviennent du cache local
      if (snapshot.metadata.fromCache) {
        console.log(
          "📦 Produits chargés depuis le cache local"
        );
      } else {
        console.log(
          "☁️ Produits chargés depuis Firebase"
        );
      }
    },

    // ==============================
    // ERREUR
    // ==============================
    (error) => {
      console.error(
        "Erreur chargement produits :",
        error
      );

      setLoading(false);
    }
  );

  return () => unsubscribe();
}, [storeId]);

  // ==============================
  // CATÉGORIES
  // ==============================

  const categories = [
    "Tous les articles",

    ...new Set(
      products
        .filter(
          (product) =>
            product.isActive !== false
        )
        .map(
          (product) =>
            product.categoryName ||
            product.category
        )
        .filter(Boolean)
    ),
  ];

  // ==============================
  // FILTRAGE
  // ==============================

  const filteredProducts =
    products.filter((product) => {
      const isActive =
        product.isActive !== false;

      if (!isActive) {
        return false;
      }

      const name =
        product.productName || "";

      const matchSearch = name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        );

      const productCategory =
        product.categoryName ||
        product.category ||
        "";

      const matchCategory =
        category ===
          "Tous les articles" ||
        productCategory === category;

      return (
        matchSearch &&
        matchCategory
      );
    });

  // ==============================
  // RÉCUPÉRER LES VARIANTES VALIDES
  // ==============================

  const getValidVariants = (
    product
  ) => {
    if (
      !Array.isArray(
        product?.variants
      )
    ) {
      return [];
    }

    return product.variants.filter(
      (variant) =>
        variant &&
        variant.type?.trim() !==
          "" &&
        Number(
          variant.quantity || 0
        ) > 0
    );
  };

  // ==============================
  // CLIQUER SUR UN PRODUIT
  // ==============================

  const handleProductClick = (
    product
  ) => {
    if (!cashSession) {
      return;
    }

    if (product.isActive === false) {
      return;
    }

    const variants =
      getValidVariants(product);

    if (variants.length > 0) {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setVariantQuantity(1);

      return;
    }

    addToTicket(product, null, 1);
  };

  // ==============================
  // AJOUT AU TICKET
  // ==============================

  const addToTicket = (
    product,
    variant = null,
    quantityToAdd = 1
  ) => {
    if (!cashSession) {
      return false;
    }

    if (product.isActive === false) {
      return false;
    }

    const stock = Number(
      product.stock || 0
    );

    const variantQuantity = Number(
      variant?.quantity || 1
    );

    const price = Number(
      variant?.price ??
        product.price ??
        product.sellingPrice ??
        0
    );

    const variantType =
      variant?.type?.trim() ||
      product.stockUnit ||
      "Unité";

    const quantity = Number(
      quantityToAdd || 0
    );

    // ==============================
    // VÉRIFICATIONS
    // ==============================

    if (quantity <= 0) {
      return false;
    }

    if (stock <= 0) {
      return false;
    }

    if (variantQuantity <= 0) {
      return false;
    }

    // Stock nécessaire pour la quantité demandée
    const requiredStock =
      quantity * variantQuantity;

    if (requiredStock > stock) {

      return false;
    }

    // ==============================
    // ARTICLE EXISTANT
    // ==============================

    const existingIndex =
      ticket.findIndex(
        (item) =>
          item.productId ===
            product.id &&
          item.variantType ===
            variantType
      );

    if (existingIndex !== -1) {
      const existingItem =
        ticket[existingIndex];

      const newQuantity =
        existingItem.quantity +
        quantity;

      const newRequiredStock =
        newQuantity *
        existingItem.variantQuantity;

      if (
        newRequiredStock >
        stock
      ) {
        return false;
      }

      setTicket(
        ticket.map(
          (item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  quantity:
                    newQuantity,
                  stockAvailable:
                    stock,
                }
              : item
        )
      );

      return true;
    }

    // ==============================
    // NOUVEL ARTICLE
    // ==============================

    setTicket([
      ...ticket,
      {
        productId:
          product.id,

        name:
          product.productName ||
          "Produit",

        price,

        quantity,

        variantType,

        variantQuantity,

        stockUnit:
          product.stockUnit || "",

        stockAvailable:
          stock,

        categoryName:
          product.categoryName ||
          product.category ||
          "Non classé",

        // Prix d'achat de l'unité de stock de base.
        basePurchasePrice: Number(
          product.purchasePrice || 0
        ),

        // Coût d'achat réel d'une variante vendue.
        // Exemple : pack de 12 bouteilles => prix achat bouteille × 12.
        purchasePrice:
          Number(product.purchasePrice || 0) *
          variantQuantity,
      },
    ]);

    return true;
  };

  // ==============================
  // CHOISIR UNE VARIANTE
  // ==============================

  const handleVariantClick = (
    product,
    variant
  ) => {
    const stock = Number(
      product.stock || 0
    );

    const conversionQuantity =
      Number(
        variant.quantity || 0
      );

    if (
      conversionQuantity <= 0
    ) {
      return;
    }

    if (
      stock <
      conversionQuantity
    ) {
      return;
    }

    // On ne ferme plus la modal.
    // On ouvre maintenant la sélection
    // de quantité.
    setSelectedVariant(variant);
    setVariantQuantity(1);
  };

  // ==============================
  // AUGMENTER QUANTITÉ VARIANTE
  // ==============================

  const increaseVariantQuantity = () => {
    if (
      !selectedProduct ||
      !selectedVariant
    ) {
      return;
    }

    const stock = Number(
      selectedProduct.stock || 0
    );

    const conversionQuantity =
      Number(
        selectedVariant.quantity || 1
      );

    const maxQuantity = Math.floor(
      stock / conversionQuantity
    );

    if (
      variantQuantity >=
      maxQuantity
    ) {
      return;
    }

    setVariantQuantity(
      (current) => current + 1
    );
  };

  // ==============================
  // DIMINUER QUANTITÉ VARIANTE
  // ==============================

  const decreaseVariantQuantity = () => {
    setVariantQuantity(
      (current) =>
        current > 1
          ? current - 1
          : 1
    );
  };

  // ==============================
  // CONFIRMER VARIANTE
  // ==============================

  const confirmVariant = () => {
    if (
      !selectedProduct ||
      !selectedVariant
    ) {
      return;
    }

    const added =
      addToTicket(
        selectedProduct,
        selectedVariant,
        variantQuantity
      );

    if (added) {
      setSelectedProduct(null);
      setSelectedVariant(null);
      setVariantQuantity(1);
    }
  };

  // ==============================
  // FERMER MODAL VARIANTE
  // ==============================

  const closeVariantModal = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setVariantQuantity(1);
  };

  // ==============================
  // AUGMENTER QUANTITÉ TICKET
  // ==============================

  const increaseQuantity = (
    index
  ) => {
    const item = ticket[index];

    const stock = Number(
      item.stockAvailable || 0
    );

    const newQuantity =
      item.quantity + 1;

    const requiredStock =
      newQuantity *
      item.variantQuantity;

    if (
      requiredStock >
      stock
    ) {
      return;
    }

    setTicket(
      ticket.map(
        (
          ticketItem,
          itemIndex
        ) =>
          itemIndex === index
            ? {
                ...ticketItem,
                quantity:
                  newQuantity,
              }
            : ticketItem
      )
    );
  };

  // ==============================
  // DIMINUER QUANTITÉ
  // ==============================

  const decreaseQuantity = (
    index
  ) => {
    const item = ticket[index];

    if (item.quantity <= 1) {
      removeFromTicket(index);

      return;
    }

    setTicket(
      ticket.map(
        (
          ticketItem,
          itemIndex
        ) =>
          itemIndex === index
            ? {
                ...ticketItem,
                quantity:
                  ticketItem.quantity -
                  1,
              }
            : ticketItem
      )
    );
  };

  // ==============================
  // SUPPRIMER DU TICKET
  // ==============================

  const removeFromTicket = (
    index
  ) => {
    setTicket(
      ticket.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  };

  // ==============================
  // VIDER LE TICKET
  // ==============================

  const clearTicket = () => {
    if (ticket.length === 0) {
      return;
    }

    const confirmation =
      window.confirm(
        "Voulez-vous vraiment vider le ticket ?"
      );

    if (confirmation) {
      setTicket([]);
    }
  };

  // ==============================
  // TOTAL
  // ==============================

  const total = ticket.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        item.quantity,
    0
  );

  // ==============================
  // NOMBRE ARTICLES
  // ==============================

  const totalItems =
    ticket.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  // ==============================
  // QUANTITÉ STOCK DE BASE
  // ==============================

  const getBaseQuantity = (
    item
  ) => {
    return (
      item.quantity *
      item.variantQuantity
    );
  };

  // ==============================
  // PARCOURS TICKET / PAIEMENT
  // ==============================

  const openTicket = () => {
    setTicketStep("ticket");
    setCashReceived("");
    setLastSale(null);
    setShowTicket(true);
  };

  const openPayment = () => {
    if (ticket.length === 0) {
      return;
    }

    setCashReceived(String(total));
    setTicketStep("payment");
  };

  // Enregistre seulement le ticket pour le reprendre plus tard.
  // Aucun stock n'est retiré et la vente n'entre pas dans le rapport.
  const savePendingTicket = async () => {
    if (savingTicket || ticket.length === 0) return;

    if (!cashSession?.id || !storeId || !userId) {
      return;
    }

    try {
      setSavingTicket(true);

      await addDoc(collection(db, "savedTickets"), {
        storeId,
        cashSessionId: cashSession.id,
        userId,
        userName,
        userRole,
        items: ticket,
        total,
        totalItems,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTicket([]);
      setShowTicket(false);
      setTicketStep("ticket");
      setCashReceived("");

    } catch (error) {
      console.error("Erreur enregistrement ticket :", error);
    } finally {
      setSavingTicket(false);
    }
  };

  // ==============================
// VALIDER UNE VENTE HORS CONNEXION
// ==============================

const handleOfflinePayment = async (received) => {
if (!cashSession?.id) {
    return false;
  }

  if (!storeId || !userId) {
    return false;
  }

  if (ticket.length === 0) {
    return false;
  }

  if (!Number.isFinite(received) || received < total) {

    return false;
  }

  try {
    setPaying(true);

    // ==============================
    // QUANTITÉ À RETIRER PAR PRODUIT
    // ==============================

    const stockByProduct = {};

    ticket.forEach((item) => {
      const baseQuantity =
        Number(item.quantity || 0) *
        Number(item.variantQuantity || 1);

      if (!stockByProduct[item.productId]) {
        stockByProduct[item.productId] = 0;
      }

      stockByProduct[item.productId] += baseQuantity;
    });

    // ==============================
    // VÉRIFIER LE STOCK LOCAL
    // ==============================

    for (const [productId, quantityToRemove] of Object.entries(
      stockByProduct
    )) {
      const product = products.find(
        (currentProduct) =>
          currentProduct.id === productId
      );

      if (!product) {
        return false;
      }

      const currentStock =
        Number(product.stock || 0);

      if (currentStock < quantityToRemove) {
        return false;
      }
    }

    // ==============================
    // CONSTRUIRE LES ARTICLES
    // ==============================

    const saleItems = ticket.map((item) => {
      const quantity =
        Number(item.quantity || 0);

      const sellingPrice =
        Number(item.price || 0);

      const conversionQuantity =
        Number(item.variantQuantity || 1);

      const purchasePrice =
        Number(item.purchasePrice || 0);

      return {
        productId: item.productId,
        name: item.name,

        categoryName:
          item.categoryName || "Non classé",

        variantType: item.variantType,

        quantity,

        price: sellingPrice,
        sellingPrice,

        purchasePrice,

        basePurchasePrice:
          Number(item.basePurchasePrice || 0),

        variantQuantity:
          conversionQuantity,

        baseQuantity:
          quantity * conversionQuantity,

        stockUnit:
          item.stockUnit || "",

        lineTotal:
          sellingPrice * quantity,

        linePurchaseCost:
          purchasePrice * quantity,

        profit:
          (sellingPrice - purchasePrice) *
          quantity,
      };
    });

    // ==============================
    // TOTAUX
    // ==============================

    const totalPurchaseCost =
      saleItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.linePurchaseCost || 0
          ),
        0
      );

    const totalProfit =
      total - totalPurchaseCost;

    const changeAmount =
      received - total;

    // ==============================
    // IDENTIFIANT LOCAL UNIQUE
    // ==============================

    const offlineSaleId =
      typeof crypto !== "undefined" &&
      crypto.randomUUID
        ? crypto.randomUUID()
        : `offline-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    // ==============================
    // CRÉER LA VENTE LOCALE
    // ==============================

    const offlineSale = {
      offlineSaleId,

      storeId,

      cashSessionId:
        cashSession.id,

      userId,
      userName,
      userRole,

      items: saleItems,

      stockByProduct,

      total,
      totalItems,
      totalPurchaseCost,
      profit: totalProfit,

      paymentMethod: "cash",

      amountReceived: received,

      changeAmount,

      status: "pending_sync",

      createdAt:
        new Date().toISOString(),
    };

    // ==============================
    // ENREGISTRER LOCALEMENT
    // ==============================

    const currentOfflineSales =
      getOfflineSales();

    const updatedOfflineSales = [
      ...currentOfflineSales,
      offlineSale,
    ];

    // Enregistrer d'abord dans la file de synchronisation.
    saveOfflineSales(updatedOfflineSales);
    // Puis dans l'historique local consultable sans réseau.
    try {
      persistLocalSale(offlineSale);
    } catch (historyError) {
      console.error("Historique local indisponible :", historyError);
      // La vente reste conservée dans la file de synchronisation.
    }

    // ==============================
    // DIMINUER LE STOCK À L'ÉCRAN
    // ==============================

    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const quantityToRemove =
          stockByProduct[product.id];

        if (!quantityToRemove) {
          return product;
        }

        return {
          ...product,

          stock:
            Number(product.stock || 0) -
            quantityToRemove,
        };
      })
    );

    // ==============================
    // AFFICHER LE REÇU
    // ==============================

    setLastSale({
      total,
      received,
      changeAmount,

      items: [...ticket],

      totalItems,

      offline: true,

      offlineSaleId,
    });

    setTicketStep("receipt");

    console.log(
      "🟠 Vente enregistrée hors connexion :",
      offlineSaleId
    );

    return true;
  } catch (error) {
    console.error(
      "Erreur vente hors connexion :",
      error
    );
    return false;
  } finally {
    setPaying(false);
  }
};


// ==============================
// SYNCHRONISER LES VENTES HORS LIGNE
// ==============================

const syncOfflineSales = async () => {
  // Pas de réseau ou synchronisation déjà en cours
  if (!navigator.onLine || syncBusyRef.current) return;
  syncBusyRef.current = true;
  const offlineSales = getOfflineSales();

  if (offlineSales.length === 0) {
    setPendingSalesCount(0);
    syncBusyRef.current = false;
    return;
  }
  setSyncProgress({ done: 0, total: offlineSales.length });
  setSyncNotice("");
  console.log(
    `🔄 Synchronisation de ${offlineSales.length} vente(s)...`
  );

  setSyncingSales(true);

  // On garde ici les ventes qui n'ont pas pu être synchronisées
  const remainingSales = [];
  const failed = {};
  let processed = 0;
  try {
    for (const sale of offlineSales) {
      try {
        // ==============================
        // IDENTIFIANT UNIQUE
        // ==============================

        if (!sale.offlineSaleId) {
          console.error(
            "Vente hors ligne sans identifiant :",
            sale
          );

          remainingSales.push(sale);
          failed[sale.offlineSaleId || `sans-id-${processed}`] = "Identifiant de vente manquant";
          continue;
        }

        const saleRef = doc(
          db,
          "sales",
          sale.offlineSaleId
        );

        const cashSessionRef = doc(
          db,
          "cashSessions",
          sale.cashSessionId
        );

        // ==============================
        // TRANSACTION FIRESTORE
        // ==============================

        await runTransaction(
          db,
          async (transaction) => {
            // --------------------------
            // Vérifier si déjà synchronisée
            // --------------------------

            const existingSaleSnapshot =
              await transaction.get(saleRef);

            if (existingSaleSnapshot.exists()) {
              console.log(
                "ℹ️ Vente déjà synchronisée :",
                sale.offlineSaleId
              );

              return;
            }

            // --------------------------
            // Vérifier les produits
            // --------------------------

            const productSnapshots = {};

            for (
              const [
                productId,
                quantityToRemove,
              ] of Object.entries(
                sale.stockByProduct || {}
              )
            ) {
              const productRef = doc(
                db,
                "products",
                productId
              );

              const productSnapshot =
                await transaction.get(
                  productRef
                );

              if (!productSnapshot.exists()) {
                throw new Error(
                  `SYNC_PRODUCT_NOT_FOUND|${productId}`
                );
              }

              const currentStock =
                Number(
                  productSnapshot.data()
                    .stock || 0
                );

              if (
                currentStock <
                Number(quantityToRemove)
              ) {
                throw new Error(
                  `SYNC_STOCK_INSUFFICIENT|${productId}|${currentStock}|${quantityToRemove}`
                );
              }

              productSnapshots[
                productId
              ] = {
                ref: productRef,
                currentStock,
                quantityToRemove:
                  Number(quantityToRemove),
              };
            }

            // --------------------------
            // Vérifier la caisse
            // --------------------------

            const cashSnapshot =
              await transaction.get(
                cashSessionRef
              );

            if (!cashSnapshot.exists()) {
              throw new Error(
                "SYNC_CASH_SESSION_NOT_FOUND"
              );
            }

            /*
             * Important :
             * une vente a pu être faite hors connexion
             * juste avant la fermeture de caisse.
             *
             * On autorise donc la synchronisation
             * même si la caisse est maintenant fermée,
             * tant que son document existe.
             */

            // --------------------------
            // Diminuer le stock
            // --------------------------

            Object.values(
              productSnapshots
            ).forEach((productData) => {
              transaction.update(
                productData.ref,
                {
                  stock:
                    productData.currentStock -
                    productData.quantityToRemove,

                  updatedAt:
                    serverTimestamp(),
                }
              );
            });

            // --------------------------
            // Créer la vente
            // --------------------------

            transaction.set(
              saleRef,
              {
                storeId:
                  sale.storeId,

                cashSessionId:
                  sale.cashSessionId,

                userId:
                  sale.userId,

                userName:
                  sale.userName,

                userRole:
                  sale.userRole,

                items:
                  sale.items || [],

                total:
                  Number(sale.total || 0),

                totalItems:
                  Number(
                    sale.totalItems || 0
                  ),

                totalPurchaseCost:
                  Number(
                    sale.totalPurchaseCost ||
                      0
                  ),

                profit:
                  Number(
                    sale.profit || 0
                  ),

                paymentMethod:
                  sale.paymentMethod ||
                  "cash",

                amountReceived:
                  Number(
                    sale.amountReceived ||
                      0
                  ),

                changeAmount:
                  Number(
                    sale.changeAmount || 0
                  ),

                status: "completed",

                // Permet de savoir que
                // cette vente vient du mode offline
                wasOffline: true,

                offlineSaleId:
                  sale.offlineSaleId,

                // Heure réelle de la vente
                offlineCreatedAt:
                  sale.createdAt,

                // Heure de synchronisation Firebase
                createdAt:
                  serverTimestamp(),

                syncedAt:
                  serverTimestamp(),
              }
            );

            // --------------------------
            // Mettre à jour la caisse
            // --------------------------

            transaction.update(
              cashSessionRef,
              {
                totalSales:
                  Number(
                    cashSnapshot.data()
                      .totalSales || 0
                  ) +
                  Number(
                    sale.total || 0
                  ),

                numberOfSales:
                  Number(
                    cashSnapshot.data()
                      .numberOfSales || 0
                  ) + 1,

                updatedAt:
                  serverTimestamp(),
              }
            );
          }
        );

        try {
          persistLocalSale({ ...sale, status: "completed", syncedLocallyAt: new Date().toISOString() });
        } catch (historyError) {
          console.warn("Impossible d'actualiser l'historique local :", historyError);
        }
        console.log(
          "✅ Vente synchronisée :",
          sale.offlineSaleId
        );
      } catch (error) {
        console.error(
          "❌ Synchronisation impossible :",
          sale.offlineSaleId,
          error
        );

        // Cette vente reste sur le téléphone.
        remainingSales.push(sale);
        failed[sale.offlineSaleId || `sans-id-${processed}`] = getSyncErrorLabel(error);

        /*
         * Si Internet vient encore de disparaître,
         * inutile de tenter les ventes suivantes.
         */
        if (!navigator.onLine) {
          const currentIndex =
            offlineSales.indexOf(sale);

          remainingSales.push(
            ...offlineSales.slice(
              currentIndex + 1
            )
          );

          break;
        }
      } finally {
        processed += 1;
        setSyncProgress({ done: processed, total: offlineSales.length });
      }
    }
    setSyncErrors(failed);
    if (Object.keys(failed).length) setSyncNotice("Certaines ventes nécessitent une nouvelle tentative ou une intervention de l'administrateur.");
    // ==============================
    // CONSERVER UNIQUEMENT LES ÉCHECS
    // ==============================

    // Une autre vente peut être ajoutée pendant la synchronisation :
    // ne jamais effacer ces nouvelles ventes.
    const attemptedIds = new Set(offlineSales.map((sale) => sale.offlineSaleId));
    const newlyAdded = getOfflineSales().filter(
      (sale) => !attemptedIds.has(sale.offlineSaleId)
    );
    saveOfflineSales([...remainingSales, ...newlyAdded]);

    if (remainingSales.length === 0) {
      console.log(
        "🟢 Toutes les ventes sont synchronisées."
      );
    } else {
      console.log(
        `🟡 ${remainingSales.length} vente(s) restent en attente.`
      );
    }
  } finally {
    syncBusyRef.current = false;
    setSyncingSales(false);
  }
}; 

// ==============================
// SYNCHRONISATION AUTOMATIQUE
// ==============================

useEffect(() => {
  if (!isOnline) {
    return;
  }

  const offlineSales = getOfflineSales();

  if (offlineSales.length === 0) {
    return;
  }

  syncOfflineSales();
}, [isOnline]);

  // ==============================
  // VALIDER LE PAIEMENT ESPÈCES
  // ==============================

  const handlePayment = async () => {
    if (paying) return;

    const received = Number(cashReceived || 0);

    // Toujours enregistrer la vente localement en premier.
    // Le paiement reste donc utilisable même sans accès réel à Firebase.
    const savedLocally = await handleOfflinePayment(received);

    if (!savedLocally) {
      return;
    }

    // Si un réseau est disponible, tenter la synchronisation après
    // l'enregistrement local. En cas d'échec, la vente reste en attente.
    if (navigator.onLine) {
      setTimeout(() => {
        syncOfflineSales();
      }, 0);
    }
  };

  const startNewSale = () => {
    setTicket([]);
    setCashReceived("");
    setLastSale(null);
    setTicketStep("ticket");
    setShowTicket(false);
  };

  const printReceipt = async () => {
    if (!lastSale) return;

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
    const fc = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FC`;
    const rows = (lastSale.items || []).map((item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return `<div class="item"><b>${escapeHtml(item.name)}</b><div class="line"><span>${quantity} x ${fc(price)}${item.variantType ? ` (${escapeHtml(item.variantType)})` : ""}</span><b>${fc(quantity * price)}</b></div></div>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="UTF-8"/><style>
      @page { size: 58mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      body { width: 54mm; padding: 2mm; font: 11px monospace; }
      h2, .center { text-align: center; } h2 { font-size: 14px; margin: 4px 0; }
      .line { display: flex; justify-content: space-between; gap: 5px; }
      .item { margin: 6px 0; overflow-wrap: anywhere; }
      hr { border: 0; border-top: 1px dashed #333; margin: 7px 0; }
      .total { font-weight: bold; font-size: 13px; }
    </style></head><body>
      <h2>STOCK MANAGER</h2>
      <div class="center">Ticket de caisse</div>
      <div class="center">${escapeHtml(new Date().toLocaleString("fr-FR"))}</div>
      <div>Caissier : ${escapeHtml(userName)}</div>
      <hr/>${rows}<hr/>
      <div class="line total"><span>TOTAL</span><span>${fc(lastSale.total)}</span></div>
      <div class="line"><span>Espèces</span><span>${fc(lastSale.received)}</span></div>
      <div class="line"><span>Monnaie</span><span>${fc(lastSale.changeAmount)}</span></div>
      <hr/><div class="center">Merci pour votre achat !</div>
    </body></html>`;

    try {
      if (Capacitor.isNativePlatform()) {
        const address = localStorage.getItem(`stockManagerBluetoothPrinter:${storeId}`);
        if (!address) {
          window.alert("Aucune imprimante Bluetooth sélectionnée. Ouvrez Paramètres > Imprimante Bluetooth, puis choisissez IposPrinter.");
          return;
        }

        // ESC/POS sur papier 58 mm : 32 caractères environ par ligne.
        // Le texte est préparé sans caractères accentués pour le test Q2i.
        const clean = (value) => String(value ?? "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\x20-\x7E]/g, "?");
        const money = (value) => `${Math.round(Number(value || 0)).toLocaleString("en-US").replace(/,/g, " ")} FC`;
        const width = 32;
        const line = (left, right) => {
          const a = clean(left);
          const b = clean(right);
          if (a.length + b.length + 1 > width) return `${a}\n${b.padStart(width)}\n`;
          return a + " ".repeat(width - a.length - b.length) + b + "\n";
        };
        const wrap = (value) => {
          const words = clean(value).split(/\s+/);
          const lines = [];
          let current = "";
          for (const word of words) {
            if (!word) continue;
            if (current && (current.length + word.length + 1 > width)) {
              lines.push(current);
              current = "";
            }
            if (word.length > width) {
              if (current) { lines.push(current); current = ""; }
              for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
            } else current = current ? `${current} ${word}` : word;
          }
          if (current) lines.push(current);
          return lines.join("\n") + "\n";
        };
        const receiptLines = [
          "STOCK MANAGER",
          "TICKET DE CAISSE",
          clean(new Date().toLocaleString("fr-FR")),
          "--------------------------------",
          wrap(`Caissier: ${userName}`).trimEnd(),
          "--------------------------------",
        ];
        for (const item of lastSale.items || []) {
          receiptLines.push(wrap(`${item.name}${item.variantType ? ` (${item.variantType})` : ""}`).trimEnd());
          receiptLines.push(line(`${Number(item.quantity || 0)} x ${money(item.price)}`, money(Number(item.quantity || 0) * Number(item.price || 0))).trimEnd());
        }
        receiptLines.push("--------------------------------");
        receiptLines.push(line("TOTAL", money(lastSale.total)).trimEnd());
        receiptLines.push(line("Especes", money(lastSale.received)).trimEnd());
        receiptLines.push(line("Monnaie", money(lastSale.changeAmount)).trimEnd());
        receiptLines.push("--------------------------------", "Merci pour votre achat !", "", "", "");
        await ReceiptPrinter.printBluetoothReceipt({
          address,
          text: receiptLines.join("\n"),
        });
      } else {
        window.print();
      }
    } catch (error) {
      console.error("Impression Bluetooth impossible :", error);
      window.alert((error?.message || "Impression Bluetooth impossible.") + "\nVérifiez le Bluetooth et l'imprimante sélectionnée dans Paramètres.");
    }
  };

  // ==============================
  // STOCK
  // ==============================

  const getStockClass = (
    product
  ) => {
    const stock = Number(
      product.stock || 0
    );

    const alertStock = Number(
      product.alertStock || 0
    );

    if (stock <= 0) {
      return styles.outOfStock;
    }

    if (
      alertStock > 0 &&
      stock <= alertStock
    ) {
      return styles.lowStock;
    }

    return styles.stock;
  };

  // ==============================
  // PRIX PRODUIT SANS VARIANTE
  // ==============================

  const getProductPrice = (
    product
  ) => {
    return Number(
      product.price ??
        product.sellingPrice ??
        0
    );
  };

  // ==============================
  // INFORMATIONS VARIANTE SÉLECTIONNÉE
  // ==============================

  const selectedVariantPrice =
    Number(
      selectedVariant?.price || 0
    );

  const selectedVariantConversion =
    Number(
      selectedVariant?.quantity || 1
    );

  const variantTotal =
    selectedVariantPrice *
    variantQuantity;

  const variantBaseQuantity =
    selectedVariantConversion *
    variantQuantity;

  const variantMaxQuantity =
    selectedProduct &&
    selectedVariant
      ? Math.floor(
          Number(
            selectedProduct.stock ||
              0
          ) /
            selectedVariantConversion
        )
      : 0;

  // ==============================
  // ÉCRAN DE CHARGEMENT CAISSE
  // ==============================

  if (
    !session ||
    (cashLoading && !posChoosingUser) || usersLoading
  ) {
    return (
      <div
        className={
          styles.cashAccessScreen
        }
      >
        <div
          className={
            styles.cashAccessCard
          }
        >
          <div
            className={
              styles.cashLoadingIcon
            }
          >
            🧾
          </div>

          <h2>
            Vérification de la caisse
          </h2>

          <p>
            Vérification de votre
            session de caisse...
          </p>
        </div>
      </div>
    );
  }

  // ==============================
  // CAISSE FERMÉE
  // ==============================

  if (!cashSession) {
    return (
      <div
        className={
          styles.cashAccessScreen
        }
      >
        <div
          className={
            styles.cashAccessCard
          }
        >
          <div
            className={
              styles.cashClosedIcon
            }
          >
            🧾
          </div>

          <div
            className={
              styles.cashStatusClosed
            }
          >
            CAISSE FERMÉE
          </div>

          <h1>
            Ouvrir la caisse
          </h1>

          <p
            className={
              styles.cashDescription
            }
          >
            Bonjour{" "}
            <strong>
              {userName}
            </strong>
            . Vous devez ouvrir
            votre caisse avant de
            commencer les ventes.
          </p>

          <div
            className={
              styles.cashUserInfo
            }
          >
            <div>
              <span>
                Utilisateur
              </span>

              <strong>{userName}</strong>
            </div>

            <div>
              <span>
                Rôle
              </span>

              <strong>
                {userRole}
              </strong>
            </div>
          </div>

          {usersError && <p role="alert" style={{ color: "#b91c1c" }}>{usersError}</p>}
          <div style={{ textAlign: "left", marginBottom: 18 }}>
            <label htmlFor="openingAmount" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Fonds de caisse initial (FC)
            </label>
            <input
              id="openingAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={openingAmount}
              onChange={(event) => {
                setOpeningAmount(event.target.value);
                setOpeningAmountError("");
              }}
              placeholder="Ex. 20000 (ou 0)"
              disabled={openingCash}
              style={{ width: "100%", height: 46, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 16, background: "#fff" }}
            />
            <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
              Saisissez l'argent déjà présent dans le tiroir avant les ventes.
            </p>
            {openingAmountError && (
              <p role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>
                {openingAmountError}
              </p>
            )}
          </div>

          <button
            type="button"
            className={
              styles.openCashButton
            }
            onClick={
              openCashRegister
            }
            disabled={openingCash || !selectedCashierId || usersLoading}
          >
            {openingCash
              ? "Ouverture..."
              : "Ouvrir la caisse"}
          </button>
          {pinModalOpen && (
            <div role="dialog" aria-modal="true" aria-label="Confirmer le code PIN"
              style={{ position: "fixed", inset: 0, background: "#0009", display: "grid", placeItems: "center", zIndex: 9999, padding: 16 }}>
              <form onSubmit={confirmOpenCashRegister}
                style={{ width: "100%", maxWidth: 380, background: "white", borderRadius: 14, padding: 24, textAlign: "left" }}>
                <h2>Confirmation du PIN</h2>
                <p>Confirmez le code personnel de {userName} pour ouvrir sa caisse.</p>
                <input autoFocus type="password" inputMode="numeric" autoComplete="off"
                  value={openingPin} onChange={e => { setOpeningPin(e.target.value); setPinError(""); }}
                  placeholder="Code PIN personnel" required disabled={pinChecking}
                  style={{ width: "100%", padding: 12, marginBottom: 12, border: "1px solid #ccc", borderRadius: 8 }}/>
                {pinError && <p role="alert" style={{ color: "#b91c1c" }}>{pinError}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" disabled={pinChecking} onClick={() => { setPinModalOpen(false); setOpeningPin(""); setPinError(""); }}>Annuler</button>
                  <button type="submit" disabled={pinChecking || !openingPin.trim()}>
                    {pinChecking ? "Vérification..." : "Confirmer et ouvrir"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==============================
  // POS
  // ==============================

  // ==============================
// ÉCRAN POS VERROUILLÉ
// ==============================

if (posLocked && cashSession) {
  return (
    <div className={styles.posLockScreen}>

      <div className={styles.posLockCard}>

        <div className={styles.posLockStatus}>
          POS VERROUILLÉ
        </div>

        <h1>
          Point de vente verrouillé
        </h1>

        <p className={styles.posLockDescription}>
          Entrez votre code personnel
          pour reprendre votre session.
        </p>

        <div className={styles.posLockUser}>

          <div className={styles.posLockAvatar}>
            {(cashSession?.userName || userName)
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <strong>
              {cashSession?.userName || userName}
            </strong>

            <span>
              {(cashSession?.role || userRole) === "admin"
                ? "Administrateur"
                : (cashSession?.role || userRole) === "manager"
                ? "Gérant"
                : "Caissier"}
            </span>
          </div>

        </div>

        <form
          onSubmit={unlockPOS}
          className={styles.posUnlockForm}
        >

          <label>
            Code d'accès
          </label>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={unlockCode}
            placeholder="••••••"
            onChange={(event) => {
              setUnlockCode(
                event.target.value.replace(
                  /\D/g,
                  ""
                )
              );

              setUnlockError("");
            }}
          />

          {unlockError && (
            <div
              className={
                styles.posUnlockError
              }
            >
              {unlockError}
            </div>
          )}

          <button
            type="submit"
            disabled={
              unlocking ||
              !unlockCode
            }
          >
            {unlocking
              ? "VÉRIFICATION..."
              : " DÉVERROUILLER"}
          </button>

        </form>

        <div className={styles.posLockInfo}>
          <span>
            Caisse toujours ouverte
          </span>

          <small>
            Votre ticket et votre session
            sont conservés.
          </small>
        </div>

      </div>

    </div>
  );
}

  return (
    <div className={styles.pos}>

      {showPrinterSettings && <div role="dialog" aria-modal="true" aria-label="Configuration imprimante" style={{position:"fixed",inset:0,zIndex:10000,background:"#000a",display:"grid",placeItems:"center",padding:16}}>
        <section style={{width:"100%",maxWidth:430,maxHeight:"90vh",overflowY:"auto",background:"#fff",color:"#111827",borderRadius:16,padding:20}}>
          <h2>🖨️ Configuration imprimante</h2>
          <p style={{fontSize:13}}>Choisissez l'imprimante Bluetooth associée au Q2i.</p>
          <button type="button" disabled={printerBusy} onClick={searchPrinters}>Rechercher les appareils Bluetooth</button>
          <label style={{display:"block",marginTop:16,marginBottom:6}}>Imprimante sélectionnée</label>
          <select style={{width:"100%",padding:12}} value={printerAddress} onChange={e => {
            const address = e.target.value; setPrinterAddress(address);
            if (address) localStorage.setItem(printerKey,address); else localStorage.removeItem(printerKey);
          }}>
            <option value="">Sélectionner une imprimante...</option>
            {printerAddress && !printerDevices.some(d => d.address === printerAddress) && <option value={printerAddress}>Imprimante enregistrée ({printerAddress})</option>}
            {printerDevices.map(d => <option key={d.address} value={d.address}>{d.name} — {d.address}</option>)}
          </select>
          <label style={{display:"flex",alignItems:"center",gap:10,marginTop:18}}>
            <input type="checkbox" checked={autoPrint} onChange={e => {setAutoPrint(e.target.checked);localStorage.setItem(autoPrintKey,String(e.target.checked));}} />
            Impression automatique après paiement (préférence)
          </label>
          <p style={{fontSize:12,color:"#6b7280"}}>La préférence est enregistrée sur ce terminal. L'impression automatique sera activée lors de son raccordement au flux de paiement.</p>
          <button type="button" disabled={printerBusy || !printerAddress} onClick={testPrinter}>Imprimer un ticket de test</button>
          {printerNotice && <p role="status" style={{fontSize:13}}>{printerNotice}</p>}
          <div style={{marginTop:18}}><button type="button" onClick={() => setShowPrinterSettings(false)}>Fermer</button></div>
        </section>
      </div>}
      {leavingStore && <div role="dialog" aria-modal="true" aria-label="Quitter le magasin" style={{position:"fixed",inset:0,zIndex:10001,background:"#000a",display:"grid",placeItems:"center",padding:16}}>
        <form onSubmit={disconnectStore} style={{width:"100%",maxWidth:400,background:"#fff",color:"#111827",borderRadius:16,padding:20}}>
          <h2>Se déconnecter du magasin</h2>
          <p>Cette action nécessite la clôture de toutes les caisses et la synchronisation des ventes.</p>
          <label htmlFor="logout-admin-pin">Code PIN administrateur</label>
          <input id="logout-admin-pin" type="password" inputMode="numeric" maxLength={4} autoComplete="off" value={logoutPin} onChange={e => setLogoutPin(e.target.value.replace(/\D/g,"").slice(0,4))} style={{display:"block",width:"100%",padding:12,margin:"8px 0 12px"}} />
          {logoutError && <p role="alert" style={{color:"#b91c1c"}}>{logoutError}</p>}
          <div style={{display:"flex",gap:10}}><button type="button" disabled={logoutBusy} onClick={() => setLeavingStore(false)}>Annuler</button><button type="submit" disabled={logoutBusy || logoutPin.length!==4}>{logoutBusy ? "Vérification..." : "Quitter le magasin"}</button></div>
        </form>
      </div>}

      {/* HEADER */}

      <header
        className={styles.header}
      >
        {/* Retour à la page précédente, sans fermer la caisse */}
        <button
          type="button"
          aria-label="Retour à la page précédente"
          title="Retour"
          onClick={() => {
            setShowPosMenu(false);
            // Retour volontaire : afficher les deux choix de connexion.
            // La session est conservée pour une éventuelle réouverture.
            navigate(Capacitor.isNativePlatform() ? "/pin" : "/", { replace: true, state: Capacitor.isNativePlatform() ? undefined : { manualHome: true } });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,.35)",
            background: "transparent",
            color: "inherit",
            fontSize: 25,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          ←
        </button>
        <div className={styles.posMenuWrapper}>
  <button
    type="button"
    className={styles.menu}
    onClick={() =>
      setShowPosMenu((current) => !current)
    }
  >
    ☰
  </button>

  {showPosMenu && (
    <div className={styles.posDropdownMenu}>
      <button
        type="button"
        onClick={() =>
          navigate("/sales-history")
        }
      >

        <div>
          <strong>Historique des ventes</strong>
          <small>Consulter les ventes effectuées</small>
        </div>
      </button>

      {session?.permissions?.expenses === true || isAdminSession ? (
      <button
        type="button"
        onClick={() =>
          navigate("/expenses")
        }
      >

        <div>
          <strong>Dépenses</strong>
          <small>Ajouter et consulter les dépenses</small>
        </div>
      </button>
      ) : null}

      <button type="button" onClick={() => { setShowPosMenu(false); setShowSyncCenter(true); }}>
        <div><strong>☁️ Synchronisation {pendingSalesCount ? `(${pendingSalesCount})` : ""}</strong>
        <small>Progression, erreurs et nouvelles tentatives</small></div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (syncBusyRef.current || getOfflineSales().length) {
            setShowPosMenu(false);
            setShowSyncCenter(true);
            alert("Synchronisez toutes les ventes avant la clôture.");
            return;
          }
          if (!navigator.onLine) {
            alert("Une connexion Internet est nécessaire pour clôturer la caisse.");
            return;
          }
          navigate("/cash-closing");
        }}
      >

        <div>
          <strong>Clôture de caisse</strong>
          <small>Voir le résumé et fermer la caisse</small>
        </div>
      </button>


      <button type="button" onClick={openPrinterSettings}>
        <div><strong>🖨️ Configuration imprimante</strong><small>Bluetooth, sélection et ticket de test</small></div>
      </button>
      <button type="button" onClick={() => {
        setShowPosMenu(false);
        if (cashSession) { alert("Clôturez votre caisse avant de changer de caissier."); navigate("/cash-closing"); }
        else navigate("/pin", { replace: true });
      }}>
        <div><strong>👥 Changer de caissier</strong><small>Clôturer puis saisir un autre code PIN</small></div>
      </button>
      {isAdminSession && <button type="button" onClick={() => { setShowPosMenu(false); setLogoutPin(""); setLogoutError(""); setLeavingStore(true); }}>
        <div><strong>🚪 Se déconnecter du magasin</strong><small>Retour à la connexion email / mot de passe</small></div>
      </button>}

  <button
  type="button"
  onClick={lockPOS}
>
  <div>
    <strong>
      🔒 Verrouiller le POS
    </strong>

    <small>
      Sécuriser temporairement la caisse
    </small>
  </div>
</button>
    </div>
  )}
</div>

        <div
          className={styles.title}
        >
          <span>
            Point de vente
          </span>

          <small
            className={
              styles.cashOpenIndicator
            }
          >
            {isOnline
              ? "🟢 En ligne"
              : "🟠 Hors connexion"}
          </small>
        </div>

        <button
          type="button"
          className={
            styles.ticketButtonHeader
          }
          onClick={openTicket}
        >
          🧾

          {totalItems > 0 && (
            <span
              className={
                styles.headerTicketCount
              }
            >
              {totalItems}
            </span>
          )}
        </button>
      </header>


      {showSyncCenter && (
        <div role="dialog" aria-modal="true" aria-label="Centre de synchronisation"
          style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"white",color:"#222",borderRadius:14,padding:20,width:"min(100%,540px)",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h2 style={{margin:0}}>☁️ Centre de synchronisation</h2>
              <button type="button" onClick={() => setShowSyncCenter(false)} style={{padding:8}}>✕</button>
            </div>
            <p>{isOnline ? "🟢 Réseau disponible" : "🟠 Hors connexion"}</p>
            <p><strong>{syncingSales ? "Synchronisation en cours" : pendingSalesCount ? "Ventes à synchroniser" : "Toutes les ventes locales ont été envoyées"}</strong></p>
            {syncProgress.total > 0 && <>
              <progress max={syncProgress.total} value={syncProgress.done} style={{width:"100%",height:16}} />
              <p>{syncProgress.done} / {syncProgress.total} ventes traitées (y compris les échecs)</p>
            </>}
            <p><strong>En attente :</strong> {pendingSalesCount}</p>
            <p><strong>Erreurs détectées :</strong> {Object.keys(syncErrors).length}</p>
            {syncNotice && <p style={{color:"#a44"}}>{syncNotice}</p>}
            {Object.entries(syncErrors).map(([id, message]) => (
              <div key={id} style={{border:"1px solid #e5b3b3",padding:10,borderRadius:8,marginBottom:8}}>
                <strong>Vente {id.slice(0,12)}…</strong><p style={{margin:"4px 0"}}>{message}</p>
              </div>
            ))}
            <button type="button" disabled={!isOnline || syncingSales || !pendingSalesCount}
              onClick={() => syncOfflineSales()}
              style={{padding:12,width:"100%",background:"#1769aa",color:"white",border:0,borderRadius:8,opacity:(!isOnline || syncingSales || !pendingSalesCount)?0.5:1}}>
              {syncingSales ? "Synchronisation en cours…" : "🔄 Réessayer la synchronisation"}
            </button>
            <p style={{fontSize:12,marginBottom:0}}>Les ventes en conflit sont conservées. Ne les recommencez pas. Un conflit de stock nécessite une régularisation par l'administrateur.</p>
          </div>
        </div>
      )}

      {/* INFORMATIONS CAISSE */}

      <section
        className={
          styles.cashInfoBar
        }
      >
        <div>
          <span>
            🟢 Caisse ouverte
          </span>

          <strong>
            {userName}
          </strong>
        </div>

        <div>
          <span>
            Ouverture
          </span>

          <strong>
            {formatTime(
              cashSession.openedAt
            )}
          </strong>
        </div>

        <button
	className={
            styles.closeCashButton
          }
        type="button"
        onClick={() =>
          navigate("/cash-closing")
        }
      >
Clôture de caisse
</button>
      </section>


      {/* BAR RE TICKET / PAIEMENT */}

      <section
        className={
          styles.paymentBar
        }
      >
        <button
          type="button"
          className={
            styles.openTickets
          }
          onClick={openTicket}
        >
          <span>
            TICKET
          </span>

          <strong>
            {totalItems} article
            {totalItems > 1
              ? "s"
              : ""}
          </strong>
        </button>

        <button
          type="button"
          className={
            styles.payment
          }
          onClick={() => {
            if (ticket.length === 0) {
              openTicket();
              return;
            }
            setShowTicket(true);
            setCashReceived(String(total));
            setTicketStep("payment");
          }}
        >
          <span>
            TOTAL
          </span>

          <strong>
            {total.toLocaleString(
              "fr-FR"
            )}{" "}
            FC
          </strong>
        </button>
      </section>


      {/* RECHERCHE */}

      <section
        className={
          styles.searchBar
        }
      >
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

        <select
          value={category}
          onChange={(e) =>
            setCategory(
              e.target.value
            )
          }
          className={
            styles.category
          }
        >
          {categories.map(
            (cat) => (
              <option
                key={cat}
                value={cat}
              >
                {cat}
              </option>
            )
          )}
        </select>

       
      </section>


      {/* PRODUITS */}

      <main
        className={
          styles.productsSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >

        </div>

        <div
          className={
            styles.products
          }
        >
          {loading && (
            <div
              className={
                styles.message
              }
            >
              Chargement des
              produits...
            </div>
          )}

          {!loading &&
            filteredProducts.length ===
              0 && (
              <div
                className={
                  styles.message
                }
              >
                Aucun produit
                trouvé
              </div>
            )}

          {!loading &&
            filteredProducts.map(
              (product) => {
                const variants =
                  getValidVariants(
                    product
                  );

                const stock =
                  Number(
                    product.stock || 0
                  );

                const hasVariants =
                  variants.length >
                  0;

                const disabled =
                  stock <= 0;

                return (
                  <button
                    type="button"
                    key={
                      product.id
                    }
                    className={`${styles.product} ${
                      disabled
                        ? styles.productDisabled
                        : ""
                    }`}
                    disabled={
                      disabled
                    }
                    onClick={() =>
                      handleProductClick(
                        product
                      )
                    }
                  >
                    <div
                      className={
                        styles.productImage
                      }
                    >
                      {product.image ? (
                        <img
                          src={
                            product.image
                          }
                          alt={
                            product.productName
                          }
                        />
                      ) : (
                        <div
                          className={
                            styles.noImage
                          }
                        >
                          📦
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        styles.productInfo
                      }
                    >
                      <div
                        className={
                          styles.productName
                        }
                      >
                        {
                          product.productName
                        }
                      </div>

                      {!hasVariants && (
                        <div
                          className={
                            styles.productPrice
                          }
                        >
                          {getProductPrice(
                            product
                          ).toLocaleString(
                            "fr-FR"
                          )}{" "}
                          FC
                        </div>
                      )}

                      {hasVariants && (
                        <div
                          className={
                            styles.variantHint
                          }
                        >
                          Choisir une
                          variante
                        </div>
                      )}

                      <div
                        className={
                          getStockClass(
                            product
                          )
                        }
                      >
                        Stock :{" "}
                        {stock}{" "}
                        {product.stockUnit ||
                          ""}
                      </div>
                    </div>
                  </button>
                );
              }
            )}
        </div>
      </main>


      {/* =================================
          MODAL VARIANTES
      ================================= */}

      {selectedProduct && (
        <div
          className={
            styles.modalOverlay
          }
          onClick={
            closeVariantModal
          }
        >
          <div
            className={
              styles.variantModal
            }
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL CHOIX VARIANTE */}

            {!selectedVariant && (
              <>
                <div
                  className={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2>
                      {
                        selectedProduct.productName
                      }
                    </h2>

                    <p>
                      Choisissez une
                      variante
                    </p>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      closeVariantModal
                    }
                  >
                    ×
                  </button>
                </div>

                <div
                  className={
                    styles.variantList
                  }
                >
                  {getValidVariants(
                    selectedProduct
                  ).map(
                    (
                      variant,
                      index
                    ) => {
                      const price =
                        Number(
                          variant.price ||
                            0
                        );

                      const quantity =
                        Number(
                          variant.quantity ||
                            0
                        );

                      const stock =
                        Number(
                          selectedProduct.stock ||
                            0
                        );

                      const available =
                        stock >=
                        quantity;

                      return (
                        <button
                          type="button"
                          key={index}
                          className={
                            styles.variantModalButton
                          }
                          disabled={
                            !available
                          }
                          onClick={() =>
                            handleVariantClick(
                              selectedProduct,
                              variant
                            )
                          }
                        >
                          <div
                            className={
                              styles.variantModalInfo
                            }
                          >
                            <strong>
                              {
                                variant.type
                              }
                            </strong>

                            <span>
                              {
                                quantity
                              }{" "}
                              {
                                selectedProduct.stockUnit
                              }
                            </span>
                          </div>

                          <div
                            className={
                              styles.variantModalPrice
                            }
                          >
                            {price.toLocaleString(
                              "fr-FR"
                            )}{" "}
                            FC
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </>
            )}


            {/* MODAL QUANTITÉ VARIANTE */}

            {selectedVariant && (
              <>
                <div
                  className={
                    styles.modalHeader
                  }
                >
                  <div>
                    <h2>
                      {
                        selectedVariant.type
                      }
                    </h2>

                    <p>
                      {
                        selectedProduct.productName
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      closeVariantModal
                    }
                  >
                    ×
                  </button>
                </div>

                <div
                  className={
                    styles.variantQuantityContent
                  }
                >

                  <div
                    className={
                      styles.variantQuantityInfo
                    }
                  >
                    <span>
                      Prix unitaire
                    </span>

                    <strong>
                      {selectedVariantPrice.toLocaleString(
                        "fr-FR"
                      )}{" "}
                      FC
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantQuantityInfo
                    }
                  >
                    <span>
                      1{" "}
                      {
                        selectedVariant.type
                      }{" "}
                      =
                    </span>

                    <strong>
                      {
                        selectedVariantConversion
                      }{" "}
                      {
                        selectedProduct.stockUnit
                      }
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantStockInfo
                    }
                  >
                    Stock disponible :{" "}
                    <strong>
                      {
                        selectedProduct.stock
                      }{" "}
                      {
                        selectedProduct.stockUnit
                      }
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantQuantityLabel
                    }
                  >
                    Quantité à vendre
                  </div>


                  <div
                    className={
                      styles.variantQuantityControls
                    }
                  >
                    <button
                      type="button"
                      onClick={
                        decreaseVariantQuantity
                      }
                    >
                      −
                    </button>

                    <strong>
                      {
                        variantQuantity
                      }
                    </strong>

                    <button
                      type="button"
                      onClick={
                        increaseVariantQuantity
                      }
                      disabled={
                        variantQuantity >=
                        variantMaxQuantity
                      }
                    >
                      +
                    </button>
                  </div>


                  <div
                    className={
                      styles.variantQuantityLimit
                    }
                  >
                    Maximum :{" "}
                    {
                      variantMaxQuantity
                    }{" "}
                    {
                      selectedVariant.type
                    }
                    {variantMaxQuantity >
                    1
                      ? "s"
                      : ""}
                  </div>


                  <div
                    className={
                      styles.variantBaseStock
                    }
                  >
                    Cette vente consommera{" "}
                    <strong>
                      {
                        variantBaseQuantity
                      }{" "}
                      {
                        selectedProduct.stockUnit
                      }
                    </strong>{" "}
                    du stock.
                  </div>


                  <div
                    className={
                      styles.variantTotal
                    }
                  >
                    <span>
                      Total
                    </span>

                    <strong>
                      {variantTotal.toLocaleString(
                        "fr-FR"
                      )}{" "}
                      FC
                    </strong>
                  </div>


                  <div
                    className={
                      styles.variantActions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.variantCancelButton
                      }
                      onClick={() => {
                        setSelectedVariant(
                          null
                        );
                        setVariantQuantity(
                          1
                        );
                      }}
                    >
                      Retour
                    </button>

                    <button
                      type="button"
                      className={
                        styles.variantAddButton
                      }
                      onClick={
                        confirmVariant
                      }
                    >
                      Ajouter au ticket
                    </button>
                  </div>

                </div>
              </>
            )}

          </div>
        </div>
      )}


      {/* =================================
          MODAL TICKET / PAIEMENT / REÇU
      ================================= */}

      {showTicket && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!paying) setShowTicket(false);
          }}
        >
          <div
            className={styles.ticketModal}
            onClick={(e) => e.stopPropagation()}
          >
            {ticketStep === "ticket" && (
              <>
                <div className={styles.ticketModalHeader}>
                  <div>
                    <h2>Ticket</h2>
                    <span>
                      {totalItems} article{totalItems > 1 ? "s" : ""}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setShowTicket(false)}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.ticketItems}>
                  {ticket.length === 0 ? (
                    <div className={styles.emptyTicket}>
                      <div>🛒</div>
                      <p>Le ticket est vide</p>
                      <span>Cliquez sur un produit pour commencer</span>
                    </div>
                  ) : (
                    ticket.map((item, index) => {
                      const lineTotal =
                        Number(item.price || 0) * item.quantity;
                      const baseQuantity = getBaseQuantity(item);

                      return (
                        <div
                          key={`${item.productId}-${item.variantType}`}
                          className={styles.ticketItem}
                        >
                          <div className={styles.ticketItemInfo}>
                            <strong>{item.name}</strong>
                            <span>{item.variantType}</span>
                            <small>
                              {baseQuantity} {item.stockUnit}
                            </small>
                          </div>

                          <div className={styles.ticketItemRight}>
                            <strong>
                              {lineTotal.toLocaleString("fr-FR")} FC
                            </strong>

                            <div className={styles.quantityControls}>
                              <button
                                type="button"
                                onClick={() => decreaseQuantity(index)}
                              >
                                −
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => increaseQuantity(index)}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() => removeFromTicket(index)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.ticketFooter}>
                  {ticket.length > 0 && (
                    <button
                      type="button"
                      className={styles.clearButton}
                      onClick={clearTicket}
                    >
                      Vider le ticket
                    </button>
                  )}

                  <div className={styles.totalRow}>
                    <span>Total</span>
                    <strong className={styles.totalAmount}>
                      {total.toLocaleString("fr-FR")} FC
                    </strong>
                  </div>

                  <div className={styles.ticketMainActions}>
                    <button
                      type="button"
                      className={styles.saveTicketButton}
                      disabled={ticket.length === 0 || savingTicket}
                      onClick={savePendingTicket}
                    >
                      {savingTicket ? "ENREGISTREMENT..." : "ENREGISTRER"}
                    </button>

                    <button
                      type="button"
                      className={styles.payButton}
                      disabled={ticket.length === 0}
                      onClick={openPayment}
                    >
                      PAYER {total.toLocaleString("fr-FR")} FC
                    </button>
                  </div>
                </div>
              </>
            )}

            {ticketStep === "payment" && (
              <>
                <div className={styles.paymentStepHeader}>
                  <button
                    type="button"
                    className={styles.backPaymentButton}
                    onClick={() => setTicketStep("ticket")}
                  >
                    ←
                  </button>
                  <strong>Paiement</strong>
                  <span />
                </div>

                <div className={styles.paymentStepContent}>
                  <div className={styles.paymentTotalBlock}>
                    <strong>{total.toLocaleString("fr-FR")} FC</strong>
                    <span>Montant total</span>
                  </div>

                  <label className={styles.cashReceivedField}>
                    <span>Espèces reçues</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Saisir le montant reçu"
                      autoFocus
                    />
                  </label>

                  <div className={styles.changePreview}>
                    <span>Monnaie à rendre</span>
                    <strong>
                      {Math.max(0, Number(cashReceived || 0) - total).toLocaleString("fr-FR")} FC
                    </strong>
                  </div>

                  <button
                    type="button"
                    className={styles.cashMethodButton}
                    disabled={
                      paying ||
                      !cashReceived ||
                      Number(cashReceived) < total
                    }
                    onClick={handlePayment}
                  >
                    <span className={styles.paymentMethodIcon}>💵</span>
                    <div>
                      <strong>{paying ? "PAIEMENT..." : "ESPÈCES"}</strong>
                      <small>Valider le paiement en espèces</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={styles.cardMethodButton}
                    disabled
                  >
                    <span className={styles.paymentMethodIcon}>💳</span>
                    <div>
                      <strong>CARTE</strong>
                      <small>Bientôt disponible</small>
                    </div>
                  </button>
                </div>
              </>
            )}

            {ticketStep === "receipt" && lastSale && (
              <>
                <div className={styles.receiptHeader}>
                  <div className={styles.receiptSuccess}>✓</div>
                  <h2>Paiement effectué</h2>
                  <p>La vente a été enregistrée avec succès.</p>
                </div>

                <div className={styles.receiptContent}>
                  <div className={styles.receiptAmounts}>
                    <div>
                      <span>Montant de la vente</span>
                      <strong>
                        {lastSale.total.toLocaleString("fr-FR")} FC
                      </strong>
                    </div>
                    <div>
                      <span>Espèces reçues</span>
                      <strong>
                        {lastSale.received.toLocaleString("fr-FR")} FC
                      </strong>
                    </div>
                    <div className={styles.changeAmountRow}>
                      <span>Monnaie à rendre</span>
                      <strong>
                        {lastSale.changeAmount.toLocaleString("fr-FR")} FC
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.printReceiptButton}
                    onClick={printReceipt}
                  >
                    🖨 Imprimer le reçu
                  </button>
                </div>

                <div className={styles.receiptFooter}>
                  <button
                    type="button"
                    className={styles.newSaleButton}
                    onClick={startNewSale}
                  >
                    ✓ NOUVELLE VENTE
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;