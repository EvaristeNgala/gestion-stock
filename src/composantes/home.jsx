import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import {

  collection,

  doc,

  getDoc,

  getDocs,

  query,

  where,

} from "firebase/firestore";

import {

  signInWithEmailAndPassword,

  sendPasswordResetEmail,
  onAuthStateChanged,

} from "firebase/auth";

import { db, auth } from "../firebase";

import "./home.css";

function Home() {

  const navigate = useNavigate();
  const [checkingSavedSession, setCheckingSavedSession] = useState(true);

  // Une session conservée ne remplace pas les permissions des routes.
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("storeSession") || "null");
    } catch {
      localStorage.removeItem("storeSession");
    }
    const valid = saved?.storeId && (saved?.uid || saved?.userId);
    if (!valid) {
      setCheckingSavedSession(false);
      return;
    }

    const finish = (allowed) => {
      if (!active) return;
      if (allowed) {
        const key = `stockManagerLastPage:${saved.storeId}:${saved.uid || saved.userId}`;
        const last = localStorage.getItem(key);
        const fallback = saved.role === "admin" || [
          "products", "stock", "stockAdjustment", "sales", "expenses",
          "reports", "settings", "calendar", "cash-history"
        ].some((p) => saved.permissions?.[p] === true) ? "/dashboard" : "/pos";
        const path = last?.split(/[?#]/)[0] || "";
        const required = path.startsWith("/products") || path === "/Addproducts" ? "products"
          : path === "/stock/adjustment" ? "stockAdjustment"
          : path === "/stock" ? "stock"
          : path === "/pos" || path === "/cash-closing" ? "pos"
          : path === "/reports" ? "reports"
          : path === "/settings/employees" ? "adminOnly"
          : path === "/settings" ? "settings"
          : path === "/sales-history" ? "sales"
          : path === "/expenses" ? "expenses"
          : path === "/calendar" ? "calendar"
          : path === "/cash-history" ? "cash-history"
          : path === "/dashboard" ? "dashboard" : "unknown";
        const isAdmin = saved.role === "admin" && saved.loginMode === "admin";
        const permitted = isAdmin || (required === "dashboard"
          ? fallback === "/dashboard"
          : required !== "unknown" && required !== "adminOnly" && saved.permissions?.[required] === true);
        const target = last?.startsWith("/") && !last.startsWith("//") && permitted
          ? last : fallback;
        navigate(target, { replace: true });
      } else {
        // La session admin Firebase a expiré : ne pas restaurer son compte.
        localStorage.removeItem("storeSession");
        setCheckingSavedSession(false);
      }
    };

    if (saved.role === "admin" && saved.loginMode === "admin") {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        finish(Boolean(firebaseUser && firebaseUser.uid === (saved.uid || saved.userId)));
      }, () => finish(false));
    } else if (["cashier", "manager"].includes(saved.role) &&
      ["employeeCode", "employee"].includes(saved.loginMode)) {
      finish(true);
    } else {
      finish(false);
    }
    return () => { active = false; unsubscribe(); };
  }, [navigate]);

  // ==========================================

  // ÉTATS

  // ==========================================

  const [loginType, setLoginType] = useState("employee");

  // Connexion administrateur

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);

  const [resetMessage, setResetMessage] = useState("");

  // Connexion employé

  const [storeName, setStoreName] = useState("");

  const [employeeCode, setEmployeeCode] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // ==========================================

  // INSTALLATION PWA

  // ==========================================

  const [installPrompt, setInstallPrompt] = useState(null);

  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {

    const checkInstalled = () => {

      const standalone =

        window.matchMedia("(display-mode: standalone)").matches ||

        window.navigator.standalone === true;

      setIsInstalled(standalone);

    };

    const handleBeforeInstallPrompt = (event) => {

      event.preventDefault();

      setInstallPrompt(event);

    };

    const handleAppInstalled = () => {

      setIsInstalled(true);

      setInstallPrompt(null);

    };

    checkInstalled();

    window.addEventListener(

      "beforeinstallprompt",

      handleBeforeInstallPrompt

    );

    window.addEventListener(

      "appinstalled",

      handleAppInstalled

    );

    return () => {

      window.removeEventListener(

        "beforeinstallprompt",

        handleBeforeInstallPrompt

      );

      window.removeEventListener(

        "appinstalled",

        handleAppInstalled

      );

    };

  }, []);

  const handleInstallApp = async () => {

    if (!installPrompt) {

      return;

    }

    try {

      await installPrompt.prompt();

      await installPrompt.userChoice;

    } catch (error) {

      console.error(

        "Erreur pendant l'installation de la PWA :",

        error

      );

    } finally {

      setInstallPrompt(null);

    }

  };

  // ==========================================

  // CONNEXION ADMINISTRATEUR

  // ==========================================

  const handlePasswordReset = async () => {

    setError("");

    setResetMessage("");

    const adminEmail = email.trim();

    if (!adminEmail) {

      setError("Saisissez d'abord votre adresse email administrateur.");

      return;

    }

    try {

      setResetLoading(true);

      await sendPasswordResetEmail(auth, adminEmail);

      setResetMessage("Si cette adresse est associée à un compte, vous recevrez un email de réinitialisation. Vérifiez aussi vos spams.");

    } catch (error) {

      console.error("Réinitialisation du mot de passe :", error.code);

      if (error.code === "auth/invalid-email") {

        setError("L'adresse email n'est pas valide.");

      } else if (error.code === "auth/too-many-requests") {

        setError("Trop de tentatives. Réessayez plus tard.");

      } else {

        setError("Impossible d'envoyer le message pour le moment. Vérifiez votre connexion et réessayez.");

      }

    } finally {

      setResetLoading(false);

    }

  };

  const handleAdminLogin = async (e) => {

    e.preventDefault();

    setError("");

    if (!email.trim() || !password.trim()) {

      setError("Veuillez remplir tous les champs.");

      return;

    }

    try {

      setLoading(true);

      // Connexion Firebase Auth

      const userCredential =

        await signInWithEmailAndPassword(

          auth,

          email.trim(),

          password

        );

      const user = userCredential.user;

      // Récupérer le document utilisateur

      const userRef = doc(

        db,

        "users",

        user.uid

      );

      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {

        setError(

          "Utilisateur introuvable dans la base de données."

        );

        return;

      }

      const userData = userSnap.data();

      // Vérifier le rôle

      if (userData.role !== "admin") {

        setError(

          "Ce compte n'est pas un compte administrateur."

        );

        return;

      }

      // Vérifier le statut

      if (userData.status === "inactive") {

        setError(

          "Ce compte administrateur est désactivé."

        );

        return;

      }

      if (!userData.storeId) {

        setError(

          "Aucun magasin n'est associé à ce compte."

        );

        return;

      }

      // ==========================================

      // SESSION ADMIN

      // ==========================================

      const session = {

        uid: user.uid,

        userId: user.uid,

        name: userData.name || "",

        role: "admin",

        loginMode: "admin",

        storeId: userData.storeId || "",

        storeName: userData.storeName || "",

        storeCode:

          userData.storeCode ||

          userData.storeName ||

          "",

        email: user.email || "",

        permissions: {

          pos: true,

          products: true,

          stock: true,

          sales: true,

          expenses: true,

          reports: true,

          settings: true,

        },

      };

      localStorage.setItem(

        "storeSession",

        JSON.stringify(session)

      );

      // Aller au dashboard

      navigate("/dashboard");

    } catch (error) {

      console.error(

        "Erreur connexion administrateur :",

        error

      );

      if (

        error.code === "auth/invalid-credential" ||

        error.code === "auth/wrong-password" ||

        error.code === "auth/user-not-found"

      ) {

        setError(

          "Email ou mot de passe incorrect."

        );

      } else {

        setError(

          "Une erreur est survenue lors de la connexion."

        );

      }

    } finally {

      setLoading(false);

    }

  };

  // ==========================================

  // CONNEXION EMPLOYÉ

  // ==========================================

  const handleEmployeeLogin = async (e) => {

    e.preventDefault();

    setError("");

    const enteredStoreName =

      storeName.trim().toLowerCase();

    const enteredEmployeeCode =

      employeeCode.trim();

    if (

      !enteredStoreName ||

      !enteredEmployeeCode

    ) {

      setError(

        "Veuillez remplir tous les champs."

      );

      return;

    }

    try {

      setLoading(true);

      // ==========================================

      // 1. RECHERCHER LE MAGASIN

      // ==========================================

      let storeData = null;

      let storeId = null;

      // ------------------------------------------

      // Recherche principale avec storeNameLower

      // ------------------------------------------

      const storesQuery = query(

        collection(db, "stores"),

        where(

          "storeNameLower",

          "==",

          enteredStoreName

        )

      );

      const storesSnapshot =

        await getDocs(storesQuery);

      if (!storesSnapshot.empty) {

        const storeDoc =

          storesSnapshot.docs[0];

        storeData = storeDoc.data();

        storeId =

          storeData.storeId ||

          storeDoc.id;

      }

      // ==========================================

      // COMPATIBILITÉ AVEC TON ANCIEN MAGASIN

      // ==========================================

      //

      // Ton magasin actuel peut ne pas encore

      // avoir storeNameLower.

      //

      // On fait donc une recherche de secours.

      // ==========================================

      if (!storeData) {

        const allStoresSnapshot =

          await getDocs(

            collection(db, "stores")

          );

        allStoresSnapshot.forEach(

          (storeDoc) => {

            const data =

              storeDoc.data();

            const currentStoreName =

              (

                data.storeName || ""

              )

                .toString()

                .trim()

                .toLowerCase();

            if (

              currentStoreName ===

              enteredStoreName

            ) {

              storeData = data;

              storeId =

                data.storeId ||

                storeDoc.id;

            }

          }

        );

      }

      // ==========================================

      // MAGASIN INTROUVABLE

      // ==========================================

      if (!storeData || !storeId) {

        setError(

          "Aucun magasin ne correspond à ce nom."

        );

        return;

      }

      // ==========================================

      // 2. CODE ADMINISTRATEUR : REDIRECTION VERS UNE AUTHENTIFICATION FORTE

      // Le PIN admin ne crée JAMAIS de session administrateur.

      // Il reste réservé au déverrouillage des caisses dans POS.jsx.

      const settingsSnapshot = await getDoc(doc(db, "settings", storeId));

      if (settingsSnapshot.exists()) {

        const adminPosCode = String(settingsSnapshot.data().adminPosCode ?? "").trim();

        if (adminPosCode && adminPosCode === enteredEmployeeCode) {

          setEmployeeCode("");

          setLoginType("admin");

          setError("Code administrateur reconnu. Pour accéder à votre espace administrateur, connectez-vous avec votre e-mail et votre mot de passe.");

          return;

        }

      }

      // ==========================================

      // 3. SINON, RECHERCHER L'EMPLOYÉ

      // ==========================================

      const employeeQuery = query(

        collection(db, "users"),

        where("storeId", "==", storeId),

        where("code", "==", enteredEmployeeCode)

      );

      const employeeSnapshot =

        await getDocs(employeeQuery);

      if (employeeSnapshot.empty) {

        setError(

          "Code employé incorrect pour ce magasin."

        );

        return;

      }

      if (employeeSnapshot.size !== 1) {

          setError("Ce code est attribué à plusieurs employés. Contactez l'administrateur.");

          return;

        }

        const employeeDoc = employeeSnapshot.docs[0];

      const employeeData =

        employeeDoc.data();

      const employeeId =

        employeeDoc.id;

      // ==========================================

      // 4. VÉRIFIER LE RÔLE

      // ==========================================

      if (

        employeeData.role !== "cashier" &&

        employeeData.role !== "manager"

      ) {

        setError(

          "Ce compte n'est pas un compte employé."

        );

        return;

      }

      // ==========================================

      // 5. VÉRIFIER LE STATUT

      // ==========================================

      if (employeeData.status === "inactive") {

        setError(

          "Ce compte employé est désactivé."

        );

        return;

      }

      if (!employeeData.storeId) {

        setError(

          "Cet employé n'est associé à aucun magasin."

        );

        return;

      }

      const permissions =

        employeeData.permissions || {};

      // ==========================================

      // 6. CRÉER LA SESSION EMPLOYÉ

      // ==========================================

      const session = {

        uid: employeeId,

        userId: employeeId,

        name: employeeData.name || "",

        role: employeeData.role,

        storeId: employeeData.storeId,

        storeName:

          storeData.storeName ||

          employeeData.storeName ||

          "",

        storeCode:

          storeData.storeCode ||

          employeeData.storeCode ||

          "",

        loginMode: "employeeCode",

        permissions: Object.fromEntries(

          Object.entries(permissions).map(([key, value]) => [key, value === true])

        ),

      };

      localStorage.setItem(

        "storeSession",

        JSON.stringify(session)

      );

      // ==========================================

      // 7. REDIRECTION SELON LE RÔLE

      // ==========================================

      const managementKeys = ["products", "stock", "stockAdjustment", "sales", "expenses", "reports", "settings", "calendar", "cash-history"];

        if (managementKeys.some(key => permissions[key] === true)) {

          navigate("/dashboard", { replace: true });

        } else if (permissions.pos === true) {

          navigate("/pos", { replace: true });

        } else {

          localStorage.removeItem("storeSession");

          setError("Aucune fonctionnalité n'est autorisée pour ce compte.");

        }

    } catch (error) {

      console.error(

        "Erreur connexion employé :",

        error

      );

      setError(

        "Une erreur est survenue lors de la connexion."

      );

    } finally {

      setLoading(false);

    }

  };

  // ==========================================

  // INTERFACE

  // ==========================================

  return (

    <div className="home">

      <div className="homeOverlay">

        {/* =====================================

            LOGO / TITRE

        ===================================== */}

        <div className="homeHeader">

          <div className="logo">

            🏪

          </div>

          <h1>

            Mon Magasin POS

          </h1>

          <p>

            Gestion simple et intelligente

            des produits, stocks et ventes

          </p>

        </div>

        {/* =====================================

            CARTE DE CONNEXION

        ===================================== */}

        <div className="loginCard">

          <div className="loginTabs">

            <button

              type="button"

              className={

                loginType === "employee"

                  ? "active"

                  : ""

              }

              onClick={() => {

                setLoginType("employee");

                setError("");

              }}

            >

              Connexion employé

            </button>

            <button

              type="button"

              className={

                loginType === "admin"

                  ? "active"

                  : ""

              }

              onClick={() => {

                setLoginType("admin");

                setError("");

              }}

            >

              Administrateur

            </button>

          </div>

          {/* =====================================

              MESSAGE ERREUR

          ===================================== */}

          {error && (

            <div className="errorMessage">

              {error}

            </div>

          )}

          {/* =====================================

              FORMULAIRE EMPLOYÉ

          ===================================== */}

          {loginType === "employee" && (

            <form

              onSubmit={handleEmployeeLogin}

              className="loginForm"

            >

              <h2>

                Connexion employé

              </h2>

              <p className="formDescription">

                Entrez le nom de votre magasin

                et votre code d'accès.

              </p>

              <div className="formGroup">

                <label>

                  Nom du magasin

                </label>

                <input

                  type="text"

                  placeholder="Ex : Employé"

                  value={storeName}

                  onChange={(e) =>

                    setStoreName(

                      e.target.value

                    )

                  }

                />

              </div>

              <div className="formGroup">

                <label>

                  Code d'accès

                </label>

                <input

                  type="password"

                  inputMode="numeric"

                  maxLength={6}

                  placeholder="Ex : 123456"

                  value={employeeCode}

                  onChange={(e) =>

                    setEmployeeCode(

                      e.target.value.replace(

                        /\D/g,

                        ""

                      )

                    )

                  }

                />

              </div>

              <button

                type="submit"

                className="loginButton"

                disabled={loading}

              >

                {loading

                  ? "Connexion..."

                  : "Se connecter"}

              </button>

            </form>

          )}

          {/* =====================================

              FORMULAIRE ADMIN

          ===================================== */}

          {loginType === "admin" && (

            <form

              onSubmit={handleAdminLogin}

              className="loginForm"

            >

              <h2>

                Connexion administrateur

              </h2>

              <p className="formDescription">

                Connectez-vous avec votre compte

                administrateur.

              </p>

              <div className="formGroup">

                <label>

                  Adresse email

                </label>

                <input

                  type="email"

                  placeholder="Votre email"

                  value={email}

                  onChange={(e) =>

                    setEmail(

                      e.target.value

                    )

                  }

                />

              </div>

              <div className="formGroup">

                <label htmlFor="admin-password">Mot de passe</label>

                <div className="adminPasswordField">

                  <input

                    id="admin-password"

                    type={showPassword ? "text" : "password"}

                    placeholder="Votre mot de passe"

                    value={password}

                    autoComplete="current-password"

                    onChange={(e) => setPassword(e.target.value)}

                  />

                  <button

                    type="button"

                    className="adminPasswordToggle"

                    onClick={() => setShowPassword((current) => !current)}

                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}

                    aria-pressed={showPassword}

                  >

                    {showPassword ? "Masquer" : "Voir"}

                  </button>

                </div>

              </div>

              <div className="adminResetRow">

                <button

                  type="button"

                  className="adminResetButton"

                  onClick={handlePasswordReset}

                  disabled={loading || resetLoading}

                >

                  {resetLoading ? "Envoi en cours..." : "Mot de passe oublié ?"}

                </button>

              </div>

              {resetMessage && (

                <p className="adminResetMessage" role="status">{resetMessage}</p>

              )}

              <button

                type="submit"

                className="loginButton"

                disabled={loading}

              >

                {loading

                  ? "Connexion..."

                  : "Se connecter"}

              </button>

            </form>

          )}

        </div>

        {/* =====================================

            INSTALLER L'APPLICATION

        ===================================== */}

        {installPrompt && !isInstalled && (

          <button

            type="button"

            className="installAppButton"

            onClick={handleInstallApp}

          >

            <span className="installAppIcon">📲</span>

            Installer l'application

          </button>

        )}

        {/* =====================================

            CRÉER UN MAGASIN

        ===================================== */}

        <button

          type="button"

          className="createStoreButton"

          onClick={() =>

            navigate("/create-store")

          }

        >

          + Créer un magasin

        </button>

      </div>

    </div>

  );

}

export default Home;

