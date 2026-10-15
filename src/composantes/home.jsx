import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "../firebase";
import "./home.css";

// Accueil du SITE WEB uniquement : les employés utilisent le PIN du terminal Android.
export default function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setIsInstalled(installed);
    const beforeInstall = (event) => { event.preventDefault(); setInstallPrompt(event); };
    const installedHandler = () => { setIsInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch (e) { console.warn("Installation non disponible :", e); }
    finally { setInstallPrompt(null); }
  };

  const handlePasswordReset = async () => {
    setError(""); setResetMessage("");
    if (!email.trim()) { setError("Saisissez d'abord votre adresse e-mail."); return; }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage("Si cette adresse est associée à un compte, vous recevrez un e-mail de réinitialisation.");
    } catch (e) {
      setError(e.code === "auth/invalid-email" ? "Adresse e-mail invalide." : "Impossible d'envoyer l'e-mail pour le moment.");
    } finally { setResetLoading(false); }
  };

  const handleLogin = async (event) => {
    event.preventDefault(); setError(""); setResetMessage("");
    if (!email.trim() || !password) { setError("Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      const data = snap.data();
      if (!snap.exists() || data.role !== "admin" || data.status === "inactive" || !data.storeId) {
        await signOut(auth);
        throw new Error("Seul un administrateur disposant d'un magasin actif peut se connecter au site.");
      }
      localStorage.setItem("storeSession", JSON.stringify({
        uid: credential.user.uid, userId: credential.user.uid, name: data.name || "",
        role: "admin", loginMode: "admin", storeId: data.storeId,
        storeName: data.storeName || "", storeCode: data.storeCode || data.storeName || "",
        email: credential.user.email || "",
        permissions: { pos: true, products: true, stock: true, stockAdjustment: true,
          sales: true, expenses: true, reports: true, settings: true,
          calendar: true, "cash-history": true, dashboard: true },
      }));
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found"
        ? "E-mail ou mot de passe incorrect." : e.message || "Connexion impossible.");
    } finally { setLoading(false); }
  };

  return (
    <div className="home"><div className="homeOverlay">
      <div className="homeHeader">
        <div className="logo">🏪</div>
        <h1>Mon Magasin POS</h1>
        <p>Gestion simple et intelligente des produits, stocks et ventes</p>
      </div>
      <div className="loginCard">
        <form onSubmit={handleLogin} className="loginForm">
          <h2>Se connecter</h2>
          <p className="formDescription">Accédez à votre espace administrateur.</p>
          {error && <div className="errorMessage" role="alert">{error}</div>}
          <div className="formGroup">
            <label htmlFor="admin-email">Adresse e-mail</label>
            <input id="admin-email" type="email" autoComplete="username" placeholder="Votre adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="formGroup">
            <label htmlFor="admin-password">Mot de passe</label>
            <div className="adminPasswordField">
              <input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="adminPasswordToggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? "Masquer" : "Voir"}</button>
            </div>
          </div>
          <div className="adminResetRow">
            <button type="button" className="adminResetButton" onClick={handlePasswordReset} disabled={loading || resetLoading}>{resetLoading ? "Envoi en cours…" : "Mot de passe oublié ?"}</button>
          </div>
          {resetMessage && <p className="adminResetMessage" role="status">{resetMessage}</p>}
          <button type="submit" className="loginButton" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
        </form>
      </div>
      {installPrompt && !isInstalled && <button type="button" className="installAppButton" onClick={handleInstallApp}><span className="installAppIcon">📲</span>Installer l'application</button>}
      <button type="button" className="createStoreButton" onClick={() => navigate("/create-store")}>+ Créer un magasin</button>
    </div></div>
  );
}
