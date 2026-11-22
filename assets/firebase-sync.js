import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch, getDocs
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  signOut, onAuthStateChanged
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

let currentAuthUser = null;

function isAdminUser(u) {
  return Boolean(u && u.emailVerified && u.email && u.email.toLowerCase() === ADMIN_EMAIL);
}

function sanitizeProduct(p, idx = 0) {
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
    id: String(i.id || ""),
    sku: String(i.sku || ""),
    name: String(i.name || "Repuesto").slice(0, 120),
    qty: Math.max(1, Math.floor(Number(i.qty) || 1)),
    price: Math.max(0, Number(i.price) || 0)
  })) : [];
  const computedTotal = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  const total = Math.max(1, Math.min(50000, Number(s.total) || computedTotal || 1));
  return {
    id: String(s.id || ("#GB-" + Math.floor(1050 + Math.random() * 8900))).slice(0, 24),
    date: String(s.date || new Date().toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })).slice(0, 60),
    createdAt: Number(s.createdAt) || Date.now(),
    client: String(s.client || "Cliente GB").trim().slice(0, 80) || "Cliente GB",
    phone: String(s.phone || "987654321").replace(/\D/g, "").slice(0, 15) || "987654321",
    moto: String(s.moto || "Moto por confirmar").slice(0, 100),
    delivery: String(s.delivery || "Recoger en taller GB").slice(0, 140),
    install: Boolean(s.install),
    payMethod: String(s.payMethod || "Yape QR").slice(0, 80),
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

  async seedInventoryIfEmpty(defaultList) {
    if (!isAdminUser(currentAuthUser)) return false;
    const snap = await getDocs(collection(db, "inventory"));
    if (!snap.empty) return false;
    const batch = writeBatch(db);
    defaultList.forEach((item, idx) => {
      const clean = sanitizeProduct(item, idx);
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
    list.forEach((item, idx) => {
      const clean = sanitizeProduct(item, idx);
      batch.set(doc(db, "inventory", clean.id), clean);
    });
    await batch.commit();
  },

  async createSaleOrder(saleObj) {
    const clean = sanitizeSaleForCreate(saleObj);
    const docId = `sale_${clean.createdAt}_${Math.floor(100 + Math.random() * 900)}`;
    await setDoc(doc(db, "sales", docId), clean);
    return { ...clean, _docId: docId };
  },

  subscribeSales(onData, onError) {
    const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ ...d.data(), _docId: d.id }));
        onData(list, snap.metadata);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  async confirmSaleAndDeductStock(sale, inventoryList) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    if (!sale || !sale._docId) return;
    const batch = writeBatch(db);
    if (!sale.stockDeducted && Array.isArray(sale.items)) {
      for (const it of sale.items) {
        const inv = inventoryList.find(p => p.id === it.id || p.sku === it.sku);
        if (inv) {
          const newStock = Math.max(0, Math.floor(Number(inv.stock) || 0) - Math.max(1, Math.floor(Number(it.qty) || 1)));
          batch.update(doc(db, "inventory", inv.id), { stock: newStock, updatedAt: Date.now() });
        }
      }
    }
    batch.update(doc(db, "sales", sale._docId), { status: "Pagado", stockDeducted: true });
    await batch.commit();
  },

  async updateSaleStatus(docId, newStatus) {
    if (!isAdminUser(currentAuthUser)) throw new Error("Admin auth required");
    await updateDoc(doc(db, "sales", String(docId)), { status: String(newStatus) });
  }
};

window.GBCloud = GBCloud;
window.dispatchEvent(new CustomEvent("gb-cloud-ready", { detail: GBCloud }));
