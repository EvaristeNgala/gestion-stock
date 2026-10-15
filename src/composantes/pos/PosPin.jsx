import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import "./posAccess.css";

const readDevice = () => { try { return JSON.parse(localStorage.getItem("stockManagerDeviceStore") || "null"); } catch { return null; } };
const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };

export default function PosPin({ onUnlock, onLock }) {
  const navigate = useNavigate();
  const [device] = useState(readDevice);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      if (!user || !device || user.uid !== device.adminUid) { navigate("/", { replace: true }); return; }
      setVerified(true);
    });
  }, [device, navigate]);

  const verify = async (code) => {
    if (!device || busy) return;
    setBusy(true); setError("");
    try {
      if (!navigator.onLine) throw new Error("Internet requis pour vérifier le PIN.");
      const settings = await getDoc(doc(db, "settings", device.storeId));
      const adminCode = String(settings.data()?.adminPosCode ?? "").trim();
      let account = null;
      if (adminCode && adminCode === code) {
        const admin = await getDoc(doc(db, "users", device.adminUid));
        if (!admin.exists() || admin.data().storeId !== device.storeId || admin.data().status === "inactive") throw new Error("Administrateur non autorisé.");
        account = { uid: device.adminUid, userId: device.adminUid, name: admin.data().name || "Administrateur", role: "admin", loginMode: "admin", storeId: device.storeId, storeName: device.storeName, permissions: { pos: true, sales: true, expenses: true, settings: true, "cash-history": true } };
      } else {
        const users = await getDocs(query(collection(db, "users"), where("storeId", "==", device.storeId), where("code", "==", code)));
        if (users.size !== 1) throw new Error("Code PIN incorrect ou attribué à plusieurs utilisateurs.");
        const item = users.docs[0], data = item.data();
        if (!["cashier", "manager"].includes(data.role) || data.status === "inactive" || data.canAccessPOS === false || data.permissions?.pos !== true) throw new Error("Cet utilisateur n'est pas autorisé à utiliser le POS.");
        account = { uid: item.id, userId: item.id, name: data.name || "Employé", role: data.role, loginMode: "employeeCode", storeId: device.storeId, storeName: device.storeName, permissions: data.permissions || {} };
      }
      localStorage.setItem("storeSession", JSON.stringify(account));
      onUnlock();
      navigate("/pos", { replace: true });
    } catch (e) { setError(e?.message || "Impossible de vérifier ce code."); setPin(""); }
    finally { setBusy(false); }
  };

  const digit = (value) => {
    if (busy) return;
    if (value === "erase") { setPin(s => s.slice(0, -1)); setError(""); return; }
    const next = (pin + value).slice(0, 4);
    setPin(next); setError("");
    if (next.length === 4) verify(next);
  };

  const disconnectDevice = async (event) => {
    event.preventDefault();
    if (logoutBusy || !device) return;
    setLogoutBusy(true); setLogoutError("");
    try {
      if (!navigator.onLine) throw new Error("Internet nécessaire pour déconnecter le magasin.");
      const pending = readJSON("stockManagerOfflineSales", []);
      if (!Array.isArray(pending)) throw new Error("Impossible de vérifier les ventes locales : données invalides.");
      if (pending.length) throw new Error("Synchronisez les ventes en attente avant de quitter le magasin.");
      const settings = await getDoc(doc(db, "settings", device.storeId));
      const expected = String(settings.data()?.adminPosCode ?? "").trim();
      if (!/^\d{4}$/.test(adminPin) || !expected || adminPin !== expected) throw new Error("Code administrateur incorrect.");
      // Contrôler la caisse du dernier utilisateur de CE terminal, sans bloquer les autres terminaux.
      const active = readJSON("stockManagerActiveCashier", null);
      if (active?.storeId === device.storeId && active?.cashSessionId) {
        const cash = await getDoc(doc(db, "cashSessions", active.cashSessionId));
        if (cash.exists() && cash.data().storeId === device.storeId && cash.data().status === "open") {
          throw new Error("La caisse de ce terminal est ouverte. Clôturez-la avant de quitter le magasin.");
        }
      }
      if (!window.confirm("Déconnecter ce magasin du terminal ? Une nouvelle connexion email et mot de passe sera nécessaire.")) return;
      await signOut(auth);
      localStorage.removeItem("stockManagerDeviceStore");
      localStorage.removeItem("storeSession");
      localStorage.removeItem("stockManagerActiveCashier");
      localStorage.removeItem("posActiveUser");
      localStorage.removeItem("posRequireSelection");
      onLock?.();
      navigate("/", { replace: true });
    } catch (e) { setLogoutError(e?.message || "Déconnexion impossible."); }
    finally { setLogoutBusy(false); }
  };

  if (!verified) return <main className="sm-access">Vérification de la connexion…</main>;
  return <main className="sm-pin-screen">
    <section className="sm-pin-top">
      <div className="sm-logo">▦</div><h1>STOCK MANAGER <span>POS</span></h1>
      <p className="sm-store-name">{device?.storeName}</p><p>Saisissez votre code PIN</p>
      <div className="sm-pin-dots" aria-label={`${pin.length} chiffres saisis`}>{[0,1,2,3].map(i=><span key={i} className={i<pin.length?"filled":""}/>)}</div>
      {error && <p role="alert" className="sm-error">{error}</p>}{busy && <p>Vérification…</p>}
    </section>
    <section className="sm-keypad" aria-label="Clavier numérique">
      {["1","2","3","4","5","6","7","8","9","","0","erase"].map((value,i)=>value ? <button key={i} type="button" disabled={busy || showLogout} onClick={()=>digit(value)}>{value==="erase"?"Effacer":value}</button> : <div key={i}/>)}
    </section>
    <button type="button" onClick={()=>{setShowLogout(true);setAdminPin("");setLogoutError("");}} style={{margin:"20px auto",display:"block",padding:12,border:"1px solid #94a3b8",borderRadius:10,background:"transparent",color:"inherit"}}>Déconnecter le magasin (administrateur)</button>
    {showLogout && <div role="dialog" aria-modal="true" aria-label="Déconnexion administrateur" style={{position:"fixed",inset:0,zIndex:9999,background:"#0009",display:"grid",placeItems:"center",padding:16}}>
      <form onSubmit={disconnectDevice} style={{background:"white",color:"#111827",width:"100%",maxWidth:400,padding:24,borderRadius:16}}>
        <h2>Quitter le magasin</h2><p>Seul l'administrateur peut dissocier ce terminal du magasin.</p>
        <label>Code PIN administrateur<input type="password" inputMode="numeric" maxLength={4} autoComplete="off" required value={adminPin} onChange={e=>setAdminPin(e.target.value.replace(/\D/g,"").slice(0,4))} style={{display:"block",width:"100%",padding:12,marginTop:8}}/></label>
        {logoutError && <p role="alert" style={{color:"#b91c1c"}}>{logoutError}</p>}
        <div style={{display:"flex",gap:10,marginTop:18}}><button type="button" disabled={logoutBusy} onClick={()=>setShowLogout(false)}>Annuler</button><button type="submit" disabled={logoutBusy || adminPin.length!==4}>{logoutBusy?"Vérification…":"Déconnecter"}</button></div>
      </form>
    </div>}
  </main>;
}
