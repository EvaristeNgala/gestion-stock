import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import styles from "./pos.module.css";

function POS() {
  const [products, setProducts] = useState([]);
  const [ticket, setTicket] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous les articles");
  const [loading, setLoading] = useState(true);

  // Produit actuellement sélectionné pour la modal des variantes
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Affichage de la modal du ticket
  const [showTicket, setShowTicket] = useState(false);

  // ==============================
  // RÉCUPÉRATION DES PRODUITS
  // ==============================

  useEffect(() => {
    const productsRef = collection(db, "products");

    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(productsData);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur Firebase :", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ==============================
  // CATÉGORIES
  // ==============================

  const categories = [
    "Tous les articles",
    ...new Set(
      products
        .map(
          (product) =>
            product.categoryName || product.category
        )
        .filter(Boolean)
    ),
  ];

  // ==============================
  // FILTRAGE
  // ==============================

  const filteredProducts = products.filter((product) => {
    const name = product.productName || "";

    const matchSearch = name
      .toLowerCase()
      .includes(search.toLowerCase());

    const productCategory =
      product.categoryName ||
      product.category ||
      "";

    const matchCategory =
      category === "Tous les articles" ||
      productCategory === category;

    return matchSearch && matchCategory;
  });

  // ==============================
  // RÉCUPÉRER LES VARIANTES VALIDES
  // ==============================

  const getValidVariants = (product) => {
    if (!Array.isArray(product?.variants)) {
      return [];
    }

    return product.variants.filter(
      (variant) =>
        variant &&
        variant.type?.trim() !== "" &&
        Number(variant.quantity || 0) > 0
    );
  };

  // ==============================
  // CLIQUER SUR UN PRODUIT
  // ==============================

  const handleProductClick = (product) => {
    const variants = getValidVariants(product);

    // Si le produit possède des variantes,
    // on ouvre la modal.
    if (variants.length > 0) {
      setSelectedProduct(product);
      return;
    }

    // Produit sans variante :
    // ajout direct au ticket.
    addToTicket(product, null);
  };

  // ==============================
  // AJOUT AU TICKET
  // ==============================

  const addToTicket = (product, variant = null) => {
    const stock = Number(product.stock || 0);

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

    // ==============================
    // VÉRIFICATION STOCK
    // ==============================

    if (stock <= 0) {
      alert("Ce produit est en rupture de stock.");
      return;
    }

    if (variantQuantity <= 0) {
      alert("La quantité de la variante est invalide.");
      return;
    }

    if (stock < variantQuantity) {
      alert(
        `Stock insuffisant.\n\nStock disponible : ${stock} ${
          product.stockUnit || ""
        }`
      );
      return;
    }

    // ==============================
    // ARTICLE EXISTANT
    // ==============================

    const existingIndex = ticket.findIndex(
      (item) =>
        item.productId === product.id &&
        item.variantType === variantType
    );

    if (existingIndex !== -1) {
      const existingItem = ticket[existingIndex];

      const newQuantity =
        existingItem.quantity + 1;

      const requiredStock =
        newQuantity *
        existingItem.variantQuantity;

      if (requiredStock > stock) {
        alert(
          `Stock insuffisant.\n\nStock disponible : ${stock} ${
            product.stockUnit || ""
          }`
        );
        return;
      }

      setTicket(
        ticket.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: newQuantity,
              }
            : item
        )
      );

      return;
    }

    // ==============================
    // NOUVEL ARTICLE
    // ==============================

    setTicket([
      ...ticket,
      {
        productId: product.id,
        name:
          product.productName ||
          "Produit",

        price,

        quantity: 1,

        variantType,

        variantQuantity,

        stockUnit:
          product.stockUnit || "",

        stockAvailable: stock,
      },
    ]);
  };

  // ==============================
  // CHOIX D'UNE VARIANTE
  // ==============================

  const handleVariantClick = (
    product,
    variant
  ) => {
    addToTicket(product, variant);

    // Fermer la modal
    setSelectedProduct(null);
  };

  // ==============================
  // AUGMENTER QUANTITÉ
  // ==============================

  const increaseQuantity = (index) => {
    const item = ticket[index];

    const stock = Number(
      item.stockAvailable || 0
    );

    const newQuantity =
      item.quantity + 1;

    const requiredStock =
      newQuantity *
      item.variantQuantity;

    if (requiredStock > stock) {
      alert(
        `Stock insuffisant.\n\nStock disponible : ${stock} ${
          item.stockUnit || ""
        }`
      );
      return;
    }

    setTicket(
      ticket.map((ticketItem, itemIndex) =>
        itemIndex === index
          ? {
              ...ticketItem,
              quantity: newQuantity,
            }
          : ticketItem
      )
    );
  };

  // ==============================
  // DIMINUER QUANTITÉ
  // ==============================

  const decreaseQuantity = (index) => {
    const item = ticket[index];

    if (item.quantity <= 1) {
      removeFromTicket(index);
      return;
    }

    setTicket(
      ticket.map((ticketItem, itemIndex) =>
        itemIndex === index
          ? {
              ...ticketItem,
              quantity:
                ticketItem.quantity - 1,
            }
          : ticketItem
      )
    );
  };

  // ==============================
  // SUPPRIMER DU TICKET
  // ==============================

  const removeFromTicket = (index) => {
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

    const confirmation = window.confirm(
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

  const totalItems = ticket.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  // ==============================
  // QUANTITÉ STOCK DE BASE
  // ==============================

  const getBaseQuantity = (item) => {
    return (
      item.quantity *
      item.variantQuantity
    );
  };

  // ==============================
  // STOCK
  // ==============================

  const getStockClass = (product) => {
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

  const getProductPrice = (product) => {
    return Number(
      product.price ??
        product.sellingPrice ??
        0
    );
  };

  return (
    <div className={styles.pos}>

      {/* =================================
          HEADER
      ================================= */}

      <header className={styles.header}>

        <button
          type="button"
          className={styles.menu}
        >
          ☰
        </button>

        <div className={styles.title}>
          <span>Point de vente</span>
        </div>

        <button
          type="button"
          className={styles.ticketButtonHeader}
          onClick={() =>
            setShowTicket(true)
          }
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


      {/* =================================
          BARRE TICKET / PAIEMENT
      ================================= */}

      <section className={styles.paymentBar}>

        <button
          type="button"
          className={styles.openTickets}
          onClick={() =>
            setShowTicket(true)
          }
        >
          <span>TICKET</span>

          <strong>
            {totalItems} article
            {totalItems > 1
              ? "s"
              : ""}
          </strong>
        </button>

        <button
          type="button"
          className={styles.payment}
          onClick={() =>
            setShowTicket(true)
          }
        >
          <span>TOTAL</span>

          <strong>
            {total.toLocaleString(
              "fr-FR"
            )}{" "}
            FC
          </strong>
        </button>

      </section>


      {/* =================================
          RECHERCHE
      ================================= */}

      <section className={styles.searchBar}>

        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value)
          }
          className={styles.category}
        >
          {categories.map((cat) => (
            <option
              key={cat}
              value={cat}
            >
              {cat}
            </option>
          ))}
        </select>

        <div
          className={styles.searchIcon}
        >
          🔍
        </div>

      </section>


      {/* =================================
          PRODUITS
      ================================= */}

      <main className={styles.productsSection}>

        <div className={styles.sectionTitle}>

          <h2>Produits</h2>

          <span>
            {filteredProducts.length} produit
            {filteredProducts.length > 1
              ? "s"
              : ""}
          </span>

        </div>


        <div className={styles.products}>

          {loading && (
            <div className={styles.message}>
              Chargement des produits...
            </div>
          )}


          {!loading &&
            filteredProducts.length === 0 && (
              <div className={styles.message}>
                Aucun produit trouvé
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
                  variants.length > 0;

                const disabled =
                  stock <= 0;

                return (
                  <button
                    type="button"
                    key={product.id}
                    className={`${styles.product} ${
                      disabled
                        ? styles.productDisabled
                        : ""
                    }`}
                    disabled={disabled}
                    onClick={() =>
                      handleProductClick(
                        product
                      )
                    }
                  >

                    {/* IMAGE */}

                    <div
                      className={
                        styles.productImage
                      }
                    >

                      {product.image ? (
                        <img
                          src={product.image}
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


                    {/* INFORMATIONS */}

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
                        {product.productName}
                      </div>


                      {/* PRIX */}

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


                      {/* MESSAGE VARIANTE */}

                      {hasVariants && (
                        <div
                          className={
                            styles.variantHint
                          }
                        >
                          Choisir une variante
                        </div>
                      )}


                      {/* STOCK */}

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
          className={styles.modalOverlay}
          onClick={() =>
            setSelectedProduct(null)
          }
        >

          <div
            className={styles.variantModal}
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* HEADER MODAL */}

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
                  Choisissez une variante
                </p>

              </div>

              <button
                type="button"
                className={
                  styles.closeButton
                }
                onClick={() =>
                  setSelectedProduct(null)
                }
              >
                ×
              </button>

            </div>


            {/* VARIANTES */}

            <div
              className={
                styles.variantList
              }
            >

              {getValidVariants(
                selectedProduct
              ).map(
                (variant, index) => {

                  const price = Number(
                    variant.price || 0
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
                    stock >= quantity;

                  return (
                    <button
                      type="button"
                      key={index}
                      className={
                        styles.variantModalButton
                      }
                      disabled={!available}
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
                          {variant.type}
                        </strong>

                        <span>
                          {quantity}{" "}
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

          </div>

        </div>
      )}


      {/* =================================
          MODAL TICKET
      ================================= */}

      {showTicket && (
        <div
          className={styles.modalOverlay}
          onClick={() =>
            setShowTicket(false)
          }
        >

          <div
            className={styles.ticketModal}
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div
              className={
                styles.ticketModalHeader
              }
            >

              <div>

                <h2>Ticket</h2>

                <span>
                  {totalItems} article
                  {totalItems > 1
                    ? "s"
                    : ""}
                </span>

              </div>

              <button
                type="button"
                className={
                  styles.closeButton
                }
                onClick={() =>
                  setShowTicket(false)
                }
              >
                ×
              </button>

            </div>


            {/* ARTICLES */}

            <div
              className={
                styles.ticketItems
              }
            >

              {ticket.length === 0 ? (
                <div
                  className={
                    styles.emptyTicket
                  }
                >

                  <div>🛒</div>

                  <p>
                    Le ticket est vide
                  </p>

                  <span>
                    Cliquez sur un produit
                    pour commencer
                  </span>

                </div>
              ) : (
                ticket.map(
                  (item, index) => {

                    const lineTotal =
                      Number(
                        item.price || 0
                      ) *
                      item.quantity;

                    const baseQuantity =
                      getBaseQuantity(
                        item
                      );

                    return (
                      <div
                        key={`${item.productId}-${item.variantType}`}
                        className={
                          styles.ticketItem
                        }
                      >

                        {/* INFOS */}

                        <div
                          className={
                            styles.ticketItemInfo
                          }
                        >

                          <strong>
                            {item.name}
                          </strong>

                          <span>
                            {item.variantType}
                          </span>

                          <small>
                            {baseQuantity}{" "}
                            {
                              item.stockUnit
                            }
                          </small>

                        </div>


                        {/* DROITE */}

                        <div
                          className={
                            styles.ticketItemRight
                          }
                        >

                          <strong>
                            {lineTotal.toLocaleString(
                              "fr-FR"
                            )}{" "}
                            FC
                          </strong>


                          <div
                            className={
                              styles.quantityControls
                            }
                          >

                            <button
                              type="button"
                              onClick={() =>
                                decreaseQuantity(
                                  index
                                )
                              }
                            >
                              −
                            </button>

                            <span>
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                increaseQuantity(
                                  index
                                )
                              }
                            >
                              +
                            </button>

                          </div>

                        </div>


                        {/* SUPPRIMER */}

                        <button
                          type="button"
                          className={
                            styles.removeButton
                          }
                          onClick={() =>
                            removeFromTicket(
                              index
                            )
                          }
                        >
                          ×
                        </button>

                      </div>
                    );
                  }
                )
              )}

            </div>


            {/* FOOTER */}

            <div
              className={
                styles.ticketFooter
              }
            >

              {ticket.length > 0 && (
                <button
                  type="button"
                  className={
                    styles.clearButton
                  }
                  onClick={clearTicket}
                >
                  Vider le ticket
                </button>
              )}


              <div
                className={
                  styles.totalRow
                }
              >

                <span>
                  Total
                </span>

                <strong
                  className={
                    styles.totalAmount
                  }
                >
                  {total.toLocaleString(
                    "fr-FR"
                  )}{" "}
                  FC
                </strong>

              </div>


              <button
                type="button"
                className={
                  styles.payButton
                }
                disabled={
                  ticket.length === 0
                }
                onClick={() =>
                  alert(
                    "Le paiement sera ajouté dans la prochaine étape."
                  )
                }
              >
                PAYER{" "}
                {total.toLocaleString(
                  "fr-FR"
                )}{" "}
                FC
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default POS;