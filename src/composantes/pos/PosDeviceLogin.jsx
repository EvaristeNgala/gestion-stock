import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import "./posAccess.css";

export default function PosDeviceLogin() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const data = snapshot.data();
        if (snapshot.exists() && data.role === "admin" && data.status !== "inactive" && data.storeId) {
          localStorage.setItem("stockManagerDeviceStore", JSON.stringify({storeId:data.storeId, adminUid:user.uid, storeName:data.storeName || "Mon magasin"}));
          navigate("/pin", {replace:true});
          return;
        }
      } catch (e) { console.warn("Vérification magasin impossible", e); }
    }
    setChecking(false);
  }, () => setChecking(false)), [navigate]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snapshot = await getDoc(doc(db, "users", credential.user.uid));
      const data = snapshot.data();
      if (!snapshot.exists() || data.role !== "admin" || data.status === "inactive" || !data.storeId) throw new Error("Ce compte ne peut pas associer un magasin à ce terminal.");
      localStorage.setItem("stockManagerDeviceStore", JSON.stringify({storeId:data.storeId, adminUid:credential.user.uid, storeName:data.storeName || "Mon magasin"}));
      navigate("/pin", {replace:true});
    } catch (e) { setError(e?.message?.includes("Ce compte") ? e.message : "Connexion impossible. Vérifiez vos identifiants et votre réseau."); }
    finally { setBusy(false); }
  };
  if (checking) return <main className="sm-access"><p>Vérification du magasin…</p></main>;
  return <main className="sm-access"><div className="sm-login-card">
    <div className="sm-logo">▦</div><h1>STOCK MANAGER <span>POS</span></h1>
    <p>Bienvenue dans votre espace de vente</p>
    <form onSubmit={submit}><label>Adresse email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {error && <p role="alert" className="sm-error">{error}</p>}
    <button disabled={busy} className="sm-login-btn">{busy ? "Connexion…" : "Se connecter"}</button></form>
    <small>Le magasin doit être créé depuis le site Stock Manager.</small>
  </div></main>;
}
