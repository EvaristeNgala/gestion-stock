import { useState } from "react";
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
} from "firebase/auth";

import { db, auth } from "../firebase";

import "./home.css";

function Home() {
  const navigate = useNavigate();

  // ==========================================
  // ÉTATS
  // ==========================================

  const [loginType, setLoginType] = useState("employee");

  // Connexion administrateur
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Connexion employé
  const [storeName, setStoreName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ==========================================
  // CONNEXION ADMINISTRATEUR
  // ==========================================

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
      // 2. RECHERCHER L'EMPLOYÉ
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
          "Code personnel incorrect pour ce magasin."
        );
        return;
      }

      // On prend le premier employé correspondant
      const employeeDoc =
        employeeSnapshot.docs[0];

      const employeeData =
        employeeDoc.data();

      const employeeId =
        employeeDoc.id;

      // ==========================================
      // 3. VÉRIFIER LE RÔLE
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
      // 4. VÉRIFIER LE STATUT
      // ==========================================

      if (
        employeeData.status === "inactive"
      ) {
        setError(
          "Ce compte employé est désactivé."
        );
        return;
      }

      // ==========================================
      // 5. VÉRIFIER LE STORE ID
      // ==========================================

      if (!employeeData.storeId) {
        setError(
          "Cet employé n'est associé à aucun magasin."
        );
        return;
      }

      // ==========================================
      // 6. PERMISSIONS
      // ==========================================

      const permissions =
        employeeData.permissions || {};

      // ==========================================
      // 7. CRÉER LA SESSION EMPLOYÉ
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

        // Conservé uniquement pour
        // compatibilité avec l'ancien système
        storeCode:
          storeData.storeCode ||
          employeeData.storeCode ||
          "",

        permissions: {
          pos:
            permissions.pos === true,

          products:
            permissions.products === true,

          stock:
            permissions.stock === true,

          sales:
            permissions.sales === true,

          expenses:
            permissions.expenses === true,

          reports:
            permissions.reports === true,

          settings:
            permissions.settings === true,
        },
      };

      // ==========================================
      // 8. ENREGISTRER LA SESSION
      // ==========================================

      localStorage.setItem(
        "storeSession",
        JSON.stringify(session)
      );

      // ==========================================
      // 9. REDIRECTION SELON LE RÔLE
      // ==========================================

      if (
        employeeData.role === "cashier"
      ) {
        // Caissier → directement POS
        navigate("/pos");
      } else if (
        employeeData.role === "manager"
      ) {
        // Manager → Dashboard
        navigate("/dashboard");
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
                et votre code personnel.
              </p>

              <div className="formGroup">

                <label>
                  Nom du magasin
                </label>

                <input
                  type="text"
                  placeholder="Ex : Elva"
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
                  Code personnel
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Ex : 050392"
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

                <label>
                  Mot de passe
                </label>

                <input
                  type="password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
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

        </div>

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

