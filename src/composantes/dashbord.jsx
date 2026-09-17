import { useNavigate } from "react-router-dom";
import styles from "./dashbord.module.css";

function Dashboard() {

  const navigate = useNavigate();


  // ==============================
  // RÉCUPÉRER LA SESSION
  // ==============================

  const savedSession =
    localStorage.getItem("storeSession");

  const session = savedSession
    ? JSON.parse(savedSession)
    : null;


  // ==============================
  // INFORMATIONS UTILISATEUR
  // ==============================

  const userName =
    session?.name || "Utilisateur";

  const storeName =
    session?.storeName || "Mon magasin";

  const storeId =
    session?.storeId || "";

  const role =
    session?.role || "Utilisateur";


  // ==============================
  // CARTES DU DASHBOARD
  // ==============================

  const cards = [

    {
      title: "Produits",
      description: "Gestion des produits",
      path: "/products",
      icon: "📦"
    },

    {
      title: "Stock",
      description: "Gestion des stocks",
      path: "/stock",
      icon: "🏪"
    },

    {
      title: "POS",
      description: "Point de vente",
      path: "/pos",
      icon: "💳"
    },

    {
      title: "Rapports",
      description: "Statistiques et rapports",
      path: "/reports",
      icon: "📊"
    },

    {
      title: "Paramètres",
      description: "Configuration du magasin",
      path: "/settings",
      icon: "⚙️"
    }

  ];


  // ==============================
  // AFFICHAGE
  // ==============================

  return (

    <div className={styles.dashboard}>


      {/* ============================== */}
      {/* EN-TÊTE */}
      {/* ============================== */}

      <header className={styles.header}>

        <div className={styles.menu}>
          ☰
        </div>

        <h1>
          Stock Manager
        </h1>

        <div className={styles.logo}>
          🏪
        </div>

      </header>


      {/* ============================== */}
      {/* INFORMATIONS UTILISATEUR */}
      {/* ============================== */}

      <section className={styles.userCard}>

       


        <div>

          <h2>
            Bienvenue {userName}
          </h2>

          <p>
            {storeName}
          </p>

          <span>
            {role === "admin"
              ? "Administrateur"
              : role === "manager"
                ? "Gérant"
                : role === "cashier"
                  ? "Caissier"
                  : "Utilisateur"
            }
          </span>

        </div>

      </section>


      {/* ============================== */}
      {/* INFORMATIONS MAGASIN */}
      {/* ============================== */}

      


      {/* ============================== */}
      {/* MODULES */}
      {/* ============================== */}

      <section className={styles.grid}>

        {cards.map((item) => (

          <button
            key={item.title}
            className={styles.card}
            onClick={() => navigate(item.path)}
          >

            

            <h2
              style={{
                color: "#1e3a8a"
              }}
            >
              {item.title}
            </h2>

            <p
              style={{
                marginTop: "-10px"
              }}
            >
              {item.description}
            </p>

          </button>

        ))}

      </section>


      {/* ============================== */}
      {/* NAVIGATION BASSE */}
      {/* ============================== */}

      <nav className={styles.bottomNav}>

        <button className={styles.active}>
          🏠
        </button>

        <button>
          🔔
        </button>

        <button>
          🧾
        </button>

        <button>
          👤
        </button>

      </nav>

    </div>
  );
}


export default Dashboard;