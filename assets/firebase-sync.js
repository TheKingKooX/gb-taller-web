import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCaVZ4mLLPphz5wIIONeFOwg63GecalRYU",
  authDomain: "gb-taller-pe.firebaseapp.com",
  projectId: "gb-taller-pe",
  storageBucket: "gb-taller-pe.firebasestorage.app",
  messagingSenderId: "34304901638",
  appId: "1:34304901638:web:0299a64fe66b57621d3987"
};

const ADMIN_EMAIL = "thekingkoox@gmail.com";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Procesar resultado si el navegador usó signInWithRedirect (ej. móvil o popup bloqueado)
getRedirectResult(auth).catch((err) => {
  if (err && err.code) console.warn("Auth redirect result:", err.code);
});

let currentAuthUser = null;

function isAdminUser(u) {
  return Boolean(u && u.emailVerified && u.email && u.email.toLowerCase() === ADMIN_EMAIL);
}

function makeSecureDocId() {
  let hex = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  } else {
    hex = Math.floor(1e15 + Math.random() * 8e15).toString(16);
  }
  return `sale_${Date.now()}_${hex}`;
}

function makeReceiptCode(orderId) {
  const cleanId = String(orderId || "GB").replace(/[^A-Z0-9-]/gi, "") || "GB";
  return `COMP-${cleanId}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function normalizeSaleDoc(d) {
  const data = d.data();
  return {
    ...data,
    createdAt: toMillis(data.createdAt),
    _docId: d.id
  };
}

function sanitizeProduct(p) {
  const out = {
    id: String(p.id || ("prod-" + Date.now())),
    sku: String(p.sku || "GB-RP-001"),
    brand: String(p.brand || "GB"),
    name: String(p.name || "Repuesto"),
    cat: String(p.cat || "Accesorios"),
    price: Math.max(0, Number(p.price) || 0),
    stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
    fits: Array.isArray(p.fits) && p.fits.length ? p.fits.slice(0, 10).map(String) : ["msx"],
    fitText: String(p.fitText || ""),
    img: String(p.img || "assets/productos/disco-freno.jpg"),
    spec: String(p.spec || ""),
    models: String(p.models || ""),
    tag: String(p.tag || ""),
    tagType: String(p.tagType || ""),
    excl: Boolean(p.excl),
    updatedAt: Date.now()
  };
  if (p.was !== undefined && p.was !== null && Number(p.was) > 0) {
    out.was = Number(p.was);
  }
  return out;
}

function sanitizeSaleForCreate(s) {
  const items = Array.isArray(s.items) ? s.items.slice(0, 30).map(i => ({
    id: String(i.id || "item").slice(0, 64) || "item",
    sku: String(i.sku || "GB-SKU").slice(0, 40) || "GB-SKU",
    name: String(i.name || "Repuesto").slice(0, 160) || "Repuesto",
    qty: Math.max(1, Math.min(100, Math.floor(Number(i.qty) || 1))),
    price: Math.max(0, Math.min(50000, Number(i.price) || 0))
  })) : [];
  if (!items.length) {
    items.push({ id: "general", sku: "GB-GEN-001", name: "Pedido Taller GB", qty: 1, price: 1 });
  }
  const computedTotal = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  const total = Math.max(1, Math.min(50000, Number(s.total) || computedTotal || 1));
  const rawPhone = String(s.phone || "").replace(/\D/g, "").slice(0, 15);
  const safePhone = rawPhone.length >= 6 ? rawPhone : "987654321";

  return {
    id: String(s.id || ("#GB-" + Math.floor(1050 + Math.random() * 8900))).slice(0, 24),
    date: String(s.date || new Date().toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })).slice(0, 60),
    createdAt: serverTimestamp(),
    client: String(s.client || "Cliente GB").trim().slice(0, 80) || "Cliente GB",
    phone: safePhone,
    moto: String(s.moto || "Moto por confirmar").slice(0, 100) || "Moto por confirmar",
    delivery: String(s.delivery || "Recoger en taller GB").slice(0, 140) || "Recoger en taller GB",
    install: Boolean(s.install),
    payMethod: String(s.payMethod || "Yape QR").slice(0, 80) || "Yape QR",
    status: "Pendiente",
    stockDeducted: false,
    total,
    items
  };
}

const GBCloud = {
  ADMIN_EMAIL,
  enabled: true,
  isAdmin: () => isAdminUser(currentAuthUser),
  getUser: () => currentAuthUser,

  onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
      currentAuthUser = user;
      callback(user, isAdminUser(user));
    });
  },

  async signInAdminGoogle() {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      return res.user;
    } catch (err) {
      if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw err;
    }
  },

  async signOutAdmin() {
    await signOut(auth);
  },

  subscribeInventory(onData, onError) {
    return onSnapshot(
      collection(db, "inventory"),
      (snap) => {
        const items = [];
        snap.forEach((d) => items.push({ ...d.data(), id: d.id }));
        onData(items, snap.metadata);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  async fetchInventoryOnce() {
    const snap = await getDocs(collection(db, "inventory"));
    const items = [];
    snap.forEach((d) => items.push({ ...d.data(), id: d.id }));
    return items;
  },

  async seedInventoryIfEmpty(defaultList) {
    if (!isAdminUser(currentAuthUser)) return false;
    const snap = await getDocs(collection(db, "inventory"));
    if (!snap.empty) return false;
    const batch = writeBatch(db);
    defaultList.forEach((item) => {
      const clean = sanitizeProduct(item);
      batch.set(doc(db, "inventory", clean.id), clean);
    });
    await batch.commit();
    return true;
  },

  async upsertProduct(product) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    const clean = sanitizeProduct(product);
    await setDoc(doc(db, "inventory", clean.id), clean);
    return clean;
  },

  async deleteProduct(productId) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    await deleteDoc(doc(db, "inventory", String(productId)));
  },

  async replaceAllInventory(list) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    const existing = await getDocs(collection(db, "inventory"));
    const batch = writeBatch(db);
    const keepIds = new Set(list.map(x => String(x.id)));
    existing.forEach((d) => {
      if (!keepIds.has(d.id)) batch.delete(d.ref);
    });
    list.forEach((item) => {
      const clean = sanitizeProduct(item);
      batch.set(doc(db, "inventory", clean.id), clean);
    });
    await batch.commit();
  },

  async createSaleOrder(saleObj) {
    const clean = sanitizeSaleForCreate(saleObj);
    const docId = makeSecureDocId();
    const nowMs = Date.now();
    const batch = writeBatch(db);
    batch.set(doc(db, "sales", docId), clean);
    batch.set(doc(db, "order_status", docId), {
      orderId: clean.id,
      status: "Pendiente",
      total: clean.total,
      payMethod: clean.payMethod,
      verifiedAt: null,
      receiptCode: "",
      updatedAt: nowMs
    });
    await batch.commit();
    return { ...clean, createdAt: nowMs, _docId: docId };
  },

  subscribeOrderStatus(docId, onData, onError) {
    return onSnapshot(
      doc(db, "order_status", String(docId)),
      (snap) => {
        if (snap.exists()) onData({ _docId: snap.id, ...snap.data() }, snap.metadata);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  subscribeSales(onData, onError) {
    return onSnapshot(
      collection(db, "sales"),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push(normalizeSaleDoc(d)));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onData(list, snap.metadata);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  async fetchSalesOnce() {
    const snap = await getDocs(collection(db, "sales"));
    const list = [];
    snap.forEach((d) => list.push(normalizeSaleDoc(d)));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  },

  async confirmSaleAndDeductStock(sale, inventoryList) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    if (!sale || !sale._docId) return null;
    const verifiedAt = Date.now();
    const receiptCode = sale.receiptCode || makeReceiptCode(sale.id);
    const batch = writeBatch(db);
    if (!sale.stockDeducted && Array.isArray(sale.items)) {
      for (const it of sale.items) {
        const inv = inventoryList.find(p => p.id === it.id || p.sku === it.sku);
        if (inv) {
          const newStock = Math.max(0, Math.floor(Number(inv.stock) || 0) - Math.max(1, Math.floor(Number(it.qty) || 1)));
          batch.update(doc(db, "inventory", inv.id), { stock: newStock, updatedAt: verifiedAt });
        }
      }
    }
    batch.update(doc(db, "sales", sale._docId), { status: "Pagado", stockDeducted: true, updatedAt: verifiedAt });
    batch.set(doc(db, "order_status", sale._docId), {
      orderId: String(sale.id || "#GB").slice(0, 24),
      status: "Pagado",
      total: Math.max(1, Number(sale.total) || 1),
      payMethod: String(sale.payMethod || "Lemon Cash QR").slice(0, 80),
      verifiedAt,
      receiptCode,
      updatedAt: verifiedAt
    }, { merge: true });
    await batch.commit();
    return { receiptCode, verifiedAt };
  },

  async updateSaleStatus(docId, newStatus, saleObj = null) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    const nowMs = Date.now();
    const isVerified = (newStatus === "Pagado" || newStatus === "Entregado");
    const verifiedAt = isVerified ? (saleObj?.verifiedAt || nowMs) : null;
    const receiptCode = isVerified ? (saleObj?.receiptCode || makeReceiptCode(saleObj?.id)) : "";
    const batch = writeBatch(db);
    batch.update(doc(db, "sales", String(docId)), { status: String(newStatus), updatedAt: nowMs });
    batch.set(doc(db, "order_status", String(docId)), {
      orderId: String(saleObj?.id || "#GB").slice(0, 24),
      status: String(newStatus),
      total: Math.max(1, Number(saleObj?.total) || 1),
      payMethod: String(saleObj?.payMethod || "Lemon Cash QR").slice(0, 80),
      verifiedAt,
      receiptCode,
      updatedAt: nowMs
    }, { merge: true });
    await batch.commit();
    return { receiptCode, verifiedAt };
  }
};

window.GBCloud = GBCloud;
window.dispatchEvent(new CustomEvent("gb-cloud-ready", { detail: GBCloud }));
