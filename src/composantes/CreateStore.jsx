import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../firebase";

import "./CreateStore.css";

function CreateStore() {
  const navigate = useNavigate();

  // ==============================
  // ÉTATS
  // ==============================

  const [storeName, setStoreName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ==============================
  // CRÉATION DU MAGASIN
  // ==============================

  const handleCreateStore = async (e) => {
    e.preventDefault();

    // ==============================
    // VÉRIFICATIONS
    // ==============================

    if (
      !storeName.trim() ||
      !adminName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    if (password.length < 6) {
      alert("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Les deux mots de passe ne correspondent pas.");
      return;
    }

    // Cette variable permet de savoir si Firebase Auth a déjà créé
    // le compte, au cas où l'enregistrement Firestore échouerait.
    let createdUser = null;

    try {
      setLoading(true);

      // ==============================
      // NETTOYAGE DES DONNÉES
      // ==============================

      const cleanStoreName = storeName.trim();
      const cleanStoreNameLower = cleanStoreName.toLowerCase();
      const cleanAdminName = adminName.trim();
      const cleanEmail = email.trim().toLowerCase();

      // ==============================
      // VÉRIFIER SI LE MAGASIN EXISTE
      // ==============================

      const storesQuery = query(
        collection(db, "stores"),
        where("storeNameLower", "==", cleanStoreNameLower)
      );

      const storesSnapshot = await getDocs(storesQuery);

      // Compatibilité avec les anciens magasins qui n'ont pas
      // encore le champ storeNameLower.
      let oldStoreExists = false;

      if (storesSnapshot.empty) {
        const allStoresSnapshot = await getDocs(collection(db, "stores"));

        allStoresSnapshot.forEach((storeDoc) => {
          const data = storeDoc.data();
          const existingName = (data.storeName || "")
            .toString()
            .trim()
            .toLowerCase();

          if (existingName === cleanStoreNameLower) {
            oldStoreExists = true;
          }
        });
      }

      if (!storesSnapshot.empty || oldStoreExists) {
        alert("Un magasin portant ce nom existe déjà.");
        return;
      }

      // ==============================
      // CRÉER LE COMPTE FIREBASE AUTH
      // ==============================

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      const user = userCredential.user;
      createdUser = user;

      // L'UID de l'administrateur reste l'identifiant du magasin.
      // Nous conservons donc la compatibilité avec le magasin de test.
      const storeId = user.uid;

      // ==============================
      // PRÉPARER LES DOCUMENTS FIRESTORE
      // ==============================

      const storeData = {
        storeId,
        storeName: cleanStoreName,
        storeNameLower: cleanStoreNameLower,
        createdBy: user.uid,
        status: "active",
        createdAt: serverTimestamp(),
      };

      const adminData = {
        uid: user.uid,
        name: cleanAdminName,
        email: cleanEmail,
        role: "admin",
        storeId,
        storeName: cleanStoreName,
        storeNameLower: cleanStoreNameLower,
        status: "active",
        createdAt: serverTimestamp(),
      };

      // ==============================
      // ENREGISTREMENT ATOMIQUE
      // ==============================
      // Les deux documents sont enregistrés ensemble :
      // soit les deux réussissent, soit aucun n'est enregistré.

      const batch = writeBatch(db);

      batch.set(doc(db, "stores", storeId), storeData);
      batch.set(doc(db, "users", user.uid), adminData);

      await batch.commit();

      // ==============================
      // SESSION ADMIN
      // ==============================

      const session = {
        uid: user.uid,
        userId: user.uid,
        name: cleanAdminName,
        role: "admin",
        storeId,
        storeName: cleanStoreName,
        storeCode: "",
        email: cleanEmail,
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

      localStorage.setItem("storeSession", JSON.stringify(session));

      // Vider les champs après la réussite complète.
      setStoreName("");
      setAdminName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      alert("Votre magasin a été créé avec succès.");
      navigate("/dashboard");
    } catch (error) {
      console.error("Erreur lors de la création du magasin :", error);

      let cleanupFailed = false;

      // Si le compte Auth vient d'être créé mais que l'écriture
      // Firestore a échoué, on tente de supprimer ce compte incomplet.
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          cleanupFailed = true;
          console.error(
            "Impossible de supprimer le compte créé sans magasin :",
            cleanupError
          );

          // On ferme au moins la session Firebase si la suppression
          // du compte n'a pas pu être effectuée.
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error("Erreur lors de la déconnexion :", signOutError);
          }
        }
      }

      // ==============================
      // MESSAGES D'ERREUR
      // ==============================

      if (error.code === "auth/email-already-in-use") {
        alert("Cette adresse email est déjà utilisée.");
      } else if (error.code === "auth/invalid-email") {
        alert("L'adresse email n'est pas valide.");
      } else if (error.code === "auth/weak-password") {
        alert("Le mot de passe est trop faible.");
      } else if (cleanupFailed) {
        alert(
          "La création du magasin a échoué et le nettoyage du compte n'a pas pu être terminé. Vérifiez votre connexion et contactez l'administrateur avant de réessayer avec cette adresse email."
        );
      } else if (createdUser) {
        alert(
          "Le compte administrateur a été annulé, car l'enregistrement du magasin a échoué. Vérifiez votre connexion et réessayez."
        );
      } else {
        alert(
          "Une erreur est survenue lors de la création du magasin. Vérifiez votre connexion et réessayez."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // RETOUR
  // ==============================

  const handleBack = () => {
    navigate("/");
  };

  // ==============================
  // AFFICHAGE
  // ==============================

  return (
    <div className="create-store-page">
      {/* OVERLAY */}
      <div className="create-store-overlay"></div>

      {/* CONTENU */}
      <div className="create-store-container">
        {/* RETOUR */}
        <button
          type="button"
          className="create-store-back"
          onClick={handleBack}
        >
          ← Retour
        </button>

        {/* CARTE */}
        <div className="create-store-card">
          {/* EN-TÊTE */}
          <div className="create-store-header">
            <h1>Créer un magasin</h1>
            <p>
              Configurez votre magasin et créez votre compte administrateur.
            </p>
          </div>

          {/* FORMULAIRE */}
          <form onSubmit={handleCreateStore}>
            {/* NOM DU MAGASIN */}
            <div className="create-form-group">
              <label htmlFor="storeName">Nom du magasin</label>
              <input
                id="storeName"
                type="text"
                placeholder="Ex : Boutique Elva"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                autoComplete="organization"
              />
            </div>

            {/* NOM ADMIN */}
            <div className="create-form-group">
              <label htmlFor="adminName">Nom de l'administrateur</label>
              <input
                id="adminName"
                type="text"
                placeholder="Ex : Evariste"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                autoComplete="name"
              />
            </div>

            {/* EMAIL */}
            <div className="create-form-group">
              <label htmlFor="email">Adresse email</label>
              <input
                id="email"
                type="email"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* MOT DE PASSE */}
            <div className="create-form-group">
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                placeholder="Minimum 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* CONFIRMATION */}
            <div className="create-form-group">
              <label htmlFor="confirmPassword">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirmez votre mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* BOUTON */}
            <button
              type="submit"
              className="create-store-submit"
              disabled={loading}
            >
              {loading ? "Création en cours..." : "Créer mon magasin"}
            </button>
          </form>

          {/* INFORMATION */}
          <div className="create-store-info">
            <p>
              Votre compte administrateur vous permettra de gérer votre
              magasin et de créer les accès de vos employés.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateStore;
