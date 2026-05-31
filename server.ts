import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Firebase Admin initialized via service account env variable.");
  } catch (e: any) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e.message);
    initializeApp();
  }
} else {
  initializeApp();
  console.log("Firebase Admin initialized via default credentials.");
}
const db = getFirestore();

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === originalHash;
}

function generateToken(payload: { username: string; role: string; full_name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payloadStr = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest("base64url");
  return `${header}.${payloadStr}.${signature}`;
}

function verifyToken(token: string): { username: string; role: string; full_name: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payloadStr, signature] = parts;
    
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${payloadStr}`)
      .digest("base64url");
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return null; // Expired
    
    return payload;
  } catch {
    return null;
  }
}

interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
    role: string;
    full_name: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is missing." });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: "Access token is invalid or expired." });
  }

  req.user = user;
  next();
}

function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. ${role} privilege required.` });
    }
    next();
  };
}

// Set up the database data seeding on startup
async function setupDatabase() {
  try {
    const usersRef = db.collection("users");
    const usersSnap = await usersRef.limit(1).get();

    if (usersSnap.empty) {
      await usersRef.doc("admin").set({
        username: "admin",
        password: hashPassword("admin123"),
        role: "Administrator",
        full_name: "Jane Doe (Admin)"
      });
      await usersRef.doc("warehouse").set({
        username: "warehouse",
        password: hashPassword("warehouse123"),
        role: "Warehouse Staff",
        full_name: "John Smith (Warehouse)"
      });
      console.log("Seeded default users in Firestore.");
    }

    const productsRef = db.collection("products");
    const productsSnap = await productsRef.limit(1).get();
    
    if (productsSnap.empty) {
      const defaultProducts = [
        { name: "Steel Rods 12mm", sku: "SR-12MM-001", qty: 120, min: 50, unit: "Pieces" },
        { name: "Copper Cable 2.5mm", sku: "CC-25MM-002", qty: 45, min: 100, unit: "Meters" },
        { name: "Aluminium Sheets (2x1m)", sku: "AS-21M-003", qty: 15, min: 20, unit: "Pieces" },
        { name: "Hex Bolt M8", sku: "HB-M8-004", qty: 1200, min: 300, unit: "Pieces" },
        { name: "Industrial Lubricant OIL-40", sku: "IL-OIL40-005", qty: 8, min: 15, unit: "kg" },
      ];

      for (const p of defaultProducts) {
        const docRef = productsRef.doc();
        const pData = {
          product_id: docRef.id,
          product_name: p.name,
          sku: p.sku,
          current_quantity: p.qty,
          min_threshold: p.min,
          unit: p.unit
        };
        await docRef.set(pData);

        const now = new Date().toISOString().substring(0, 16);
        const logRef = db.collection("stock_in").doc();
        await logRef.set({
          entry_id: logRef.id,
          product_id: docRef.id,
          sku: p.sku,
          product_name: p.name,
          quantity_added: p.qty + 10,
          date: now,
          batch_number: "BATCH-INIT-01",
          added_by: "admin",
          unit: p.unit
        });

        if (p.qty > 5) {
          const outRef = db.collection("stock_out").doc();
          await outRef.set({
            sale_id: outRef.id,
            product_id: docRef.id,
            sku: p.sku,
            product_name: p.name,
            quantity_sold: 10,
            customer_name: "Apex Industries Ltd",
            date: now,
            sold_by: "warehouse",
            unit: p.unit
          });
        }
      }
      console.log("Seeded default products in Firestore.");
    }
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

// Run DB setup
setupDatabase();

const app = express();
app.use(express.json());

// Enable CORS for cross-origin frontend requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// --- API ROUTES ---

// 1. User Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const userSnap = await db.collection("users").doc(username).get();
    if (!userSnap.exists) {
      return res.status(401).json({ error: "Invalid username or password credentials." });
    }

    const user = userSnap.data();
    if (user && verifyPassword(password, user.password)) {
      const token = generateToken({
        username: user.username,
        role: user.role,
        full_name: user.full_name,
      });
      res.json({
        success: true,
        user: {
          username: user.username,
          role: user.role,
          full_name: user.full_name,
          token,
        },
      });
    } else {
      res.status(401).json({ error: "Invalid username or password credentials." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Products (with Search, Filters, and Pagination)
app.get("/api/products", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const search = (req.query.search as string || "").trim();
    const filter = req.query.filter as string || "all";

    const offset = (page - 1) * limit;

    const snapshot = await db.collection("products").orderBy("product_name").get();
    let productsList: any[] = [];
    snapshot.forEach(doc => {
      productsList.push(doc.data());
    });

    if (search) {
      const searchLower = search.toLowerCase();
      productsList = productsList.filter(p => 
        (p.product_name && p.product_name.toLowerCase().includes(searchLower)) ||
        (p.sku && p.sku.toLowerCase().includes(searchLower))
      );
    }

    if (filter === "low") {
      productsList = productsList.filter(p => Number(p.current_quantity) < Number(p.min_threshold));
    }

    const totalItems = productsList.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedProducts = productsList.slice(offset, offset + limit);

    res.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create New Product
app.post("/api/products", authenticateToken, requireRole("Administrator"), async (req: AuthenticatedRequest, res) => {
  try {
    const { product_name, sku, current_quantity, min_threshold, unit, added_by } = req.body;

    if (!product_name || !sku || !unit) {
      return res.status(400).json({ error: "Missing required fields (Product Name, SKU, Unit)." });
    }

    const initialQty = Number(current_quantity) || 0;
    const threshold = Number(min_threshold) || 0;

    const result = await db.runTransaction(async (transaction) => {
      const productsRef = db.collection("products");
      const skuQuery = productsRef.where("sku", "==", sku);
      const skuSnap = await transaction.get(skuQuery);
      
      if (!skuSnap.empty) {
        return { status: 400, body: { error: `SKU '${sku}' already exists.` } };
      }

      const newDocRef = productsRef.doc();
      const productData = {
        product_id: newDocRef.id,
        product_name,
        sku,
        current_quantity: initialQty,
        min_threshold: threshold,
        unit
      };

      transaction.set(newDocRef, productData);

      if (initialQty > 0) {
        const now = new Date().toISOString().substring(0, 16);
        const logRef = db.collection("stock_in").doc();
        transaction.set(logRef, {
          entry_id: logRef.id,
          product_id: newDocRef.id,
          sku,
          product_name,
          quantity_added: initialQty,
          date: now,
          batch_number: "BATCH-NEW-PROD",
          added_by: added_by || "admin",
          unit
        });
      }

      return { status: 201, body: { success: true, product: productData } };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Record Stock In
app.post("/api/stock-in", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { product_id, quantity_added, date, batch_number, added_by } = req.body;

    if (!product_id || !quantity_added || !date || !added_by) {
      return res.status(400).json({ error: "Missing required stock entry fields." });
    }

    const qty = Number(quantity_added);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantity added must be a valid positive number." });
    }

    const result = await db.runTransaction(async (transaction) => {
      const productRef = db.collection("products").doc(String(product_id));
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        return { status: 404, body: { error: "Product not found." } };
      }

      const productData = productSnap.data();
      const currentQty = Number(productData?.current_quantity) || 0;
      const newQty = currentQty + qty;

      transaction.update(productRef, { current_quantity: newQty });

      const logRef = db.collection("stock_in").doc();
      const logData = {
        entry_id: logRef.id,
        product_id: String(product_id),
        sku: productData?.sku,
        product_name: productData?.product_name,
        quantity_added: qty,
        date,
        batch_number: batch_number || null,
        added_by,
        unit: productData?.unit
      };
      transaction.set(logRef, logData);

      return { 
        status: 200, 
        body: { 
          success: true, 
          product: { ...productData, product_id, current_quantity: newQty } 
        } 
      };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Record Stock Out
app.post("/api/stock-out", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { product_id, quantity_sold, customer_name, date, sold_by } = req.body;

    if (!product_id || !quantity_sold || !customer_name || !date || !sold_by) {
      return res.status(400).json({ error: "Missing required sales fields." });
    }

    const qty = Number(quantity_sold);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantity sold must be a valid positive number." });
    }

    const result = await db.runTransaction(async (transaction) => {
      const productRef = db.collection("products").doc(String(product_id));
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        return { status: 404, body: { error: "Product not found." } };
      }

      const productData = productSnap.data();
      const currentQty = Number(productData?.current_quantity) || 0;

      if (currentQty < qty) {
        return {
          status: 400,
          body: {
            error: `Insufficient stock. Requested sale: ${qty} ${productData?.unit}, available: ${currentQty} ${productData?.unit}.`
          }
        };
      }

      const newQty = currentQty - qty;
      transaction.update(productRef, { current_quantity: newQty });

      const logRef = db.collection("stock_out").doc();
      const logData = {
        sale_id: logRef.id,
        product_id: String(product_id),
        sku: productData?.sku,
        product_name: productData?.product_name,
        quantity_sold: qty,
        customer_name,
        date,
        sold_by,
        unit: productData?.unit
      };
      transaction.set(logRef, logData);

      return { 
        status: 200, 
        body: { 
          success: true, 
          product: { ...productData, product_id, current_quantity: newQty } 
        } 
      };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get All Stock In Logs with Product Names
app.get("/api/stock-in", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const search = (req.query.search as string || "").trim();

    const offset = (page - 1) * limit;

    const snapshot = await db.collection("stock_in").orderBy("date", "desc").get();
    let logsList: any[] = [];
    snapshot.forEach(doc => {
      logsList.push(doc.data());
    });

    if (search) {
      const searchLower = search.toLowerCase();
      logsList = logsList.filter(l =>
        (l.product_name && l.product_name.toLowerCase().includes(searchLower)) ||
        (l.sku && l.sku.toLowerCase().includes(searchLower)) ||
        (l.batch_number && l.batch_number.toLowerCase().includes(searchLower)) ||
        (l.added_by && l.added_by.toLowerCase().includes(searchLower))
      );
    }

    const totalItems = logsList.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedLogs = logsList.slice(offset, offset + limit);

    res.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get All Stock Out Logs with Product Names
app.get("/api/stock-out", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const search = (req.query.search as string || "").trim();

    const offset = (page - 1) * limit;

    const snapshot = await db.collection("stock_out").orderBy("date", "desc").get();
    let logsList: any[] = [];
    snapshot.forEach(doc => {
      logsList.push(doc.data());
    });

    if (search) {
      const searchLower = search.toLowerCase();
      logsList = logsList.filter(l =>
        (l.product_name && l.product_name.toLowerCase().includes(searchLower)) ||
        (l.sku && l.sku.toLowerCase().includes(searchLower)) ||
        (l.customer_name && l.customer_name.toLowerCase().includes(searchLower)) ||
        (l.sold_by && l.sold_by.toLowerCase().includes(searchLower))
      );
    }

    const totalItems = logsList.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedLogs = logsList.slice(offset, offset + limit);

    res.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. General Dashboard Statistics
app.get("/api/dashboard-stats", authenticateToken, async (req, res) => {
  try {
    const productsSnap = await db.collection("products").get();
    let totalSKUs = 0;
    let lowStockAlerts = 0;
    productsSnap.forEach(doc => {
      totalSKUs++;
      const p = doc.data();
      if (Number(p.current_quantity) < Number(p.min_threshold)) {
        lowStockAlerts++;
      }
    });

    const stockInSnap = await db.collection("stock_in").get();
    let totalInflow = 0;
    stockInSnap.forEach(doc => {
      totalInflow += Number(doc.data().quantity_added) || 0;
    });

    const stockOutSnap = await db.collection("stock_out").get();
    let totalOutflow = 0;
    stockOutSnap.forEach(doc => {
      totalOutflow += Number(doc.data().quantity_sold) || 0;
    });
    
    res.json({
      totalSKUs,
      lowStockAlerts,
      totalInflow,
      totalOutflow,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- VITE MIDDLEWARE SETUP ---
// Only set up Vite when running in local development mode, not in serverless Firebase environment
async function startServer() {
  if (!process.env.FIREBASE_CONFIG && process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen locally if not inside Firebase Cloud Functions
  if (!process.env.FIREBASE_CONFIG) {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Standalone Express server running on port ${PORT}`);
    });
  }
}

startServer().catch(console.error);

// Export HTTPS Cloud Function for Firebase v2
export const api = onRequest({ cors: true, memory: "256MiB" }, app);
