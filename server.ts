import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import sqlite3 from "sqlite3";
import crypto from "crypto";

// Create/connect to the SQLite database file
const dbPath = process.env.NODE_ENV === "production"
  ? "/data/inventory.db"
  : path.join(process.cwd(), "inventory.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database at", dbPath);
    db.run("PRAGMA foreign_keys = ON;"); // Ensure foreign-key constraints are active
    db.run("PRAGMA busy_timeout = 5000;"); // Set lock busy timeout to 5 seconds
  }
});

// Wrap database functions in Promises for cleaner async/await usage
function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function dbGet<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

class Mutex {
  private queue: Promise<any> = Promise.resolve();

  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const next = this.queue.then(callback);
    this.queue = next.catch(() => {});
    return next;
  }
}

const dbMutex = new Mutex();

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

// Set up the relational database tables on startup
async function setupDatabase() {
  try {
    // 1. Create Users Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        full_name TEXT NOT NULL
      )
    `);

    // 2. Create Products Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        current_quantity REAL DEFAULT 0,
        min_threshold REAL DEFAULT 0,
        unit TEXT NOT NULL
      )
    `);

    // 3. Create Stock_In Table (Logs)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Stock_In (
        entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity_added REAL NOT NULL,
        date TEXT NOT NULL,
        batch_number TEXT,
        added_by TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES Products (product_id) ON DELETE CASCADE
      )
    `);

    // 4. Create Stock_Out Table (Logs)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS Stock_Out (
        sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity_sold REAL NOT NULL,
        customer_name TEXT NOT NULL,
        date TEXT NOT NULL,
        sold_by TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES Products (product_id) ON DELETE CASCADE
      )
    `);

    console.log("Database tables verified/created successfully.");

    // Seed default users if they don't exist
    const userCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM Users");
    if (userCount && userCount.count === 0) {
      await dbRun(
        "INSERT INTO Users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
        ["admin", hashPassword("admin123"), "Administrator", "Jane Doe (Admin)"]
      );
      await dbRun(
        "INSERT INTO Users (username, password, role, full_name) VALUES (?, ?, ?, ?)",
        ["warehouse", hashPassword("warehouse123"), "Warehouse Staff", "John Smith (Warehouse)"]
      );
      console.log("Seeded default users (admin/admin123, warehouse/warehouse123) in secure hashed format.");
    } else {
      // Migrate plain-text passwords to hashed passwords if Users table is not empty
      const users = await dbAll<any>("SELECT username, password FROM Users");
      for (const u of users) {
        if (!u.password.includes(":")) {
          const hashed = hashPassword(u.password);
          await dbRun("UPDATE Users SET password = ? WHERE username = ?", [hashed, u.username]);
          console.log(`Migrated user '${u.username}' password to hashed format.`);
        }
      }
    }

    // Seed default products if they don't exist
    const productCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM Products");
    if (productCount && productCount.count === 0) {
      const defaultProducts = [
        { name: "Steel Rods 12mm", sku: "SR-12MM-001", qty: 120, min: 50, unit: "Pieces" },
        { name: "Copper Cable 2.5mm", sku: "CC-25MM-002", qty: 45, min: 100, unit: "Meters" }, // Low Stock
        { name: "Aluminium Sheets (2x1m)", sku: "AS-21M-003", qty: 15, min: 20, unit: "Pieces" }, // Low Stock
        { name: "Hex Bolt M8", sku: "HB-M8-004", qty: 1200, min: 300, unit: "Pieces" },
        { name: "Industrial Lubricant OIL-40", sku: "IL-OIL40-005", qty: 8, min: 15, unit: "kg" }, // Low Stock
      ];

      for (const p of defaultProducts) {
        const result = await dbRun(
          "INSERT INTO Products (product_name, sku, current_quantity, min_threshold, unit) VALUES (?, ?, ?, ?, ?)",
          [p.name, p.sku, p.qty, p.min, p.unit]
        );
        
        // Let's seed initial log transactions for these products
        const productId = result.lastID;
        const now = new Date().toISOString().substring(0, 16); // format: YYYY-MM-DDTHH:MM
        
        // Seed Stock In log
        await dbRun(
          "INSERT INTO Stock_In (product_id, quantity_added, date, batch_number, added_by) VALUES (?, ?, ?, ?, ?)",
          [productId, p.qty + 10, now, "BATCH-INIT-01", "admin"]
         );

        // Seed a small sub-log of stock out if initial stock was slightly modified
        if (p.qty > 5) {
          await dbRun(
            "INSERT INTO Stock_Out (product_id, quantity_sold, customer_name, date, sold_by) VALUES (?, ?, ?, ?, ?)",
            [productId, 10, "Apex Industries Ltd", now, "warehouse"]
          );
        }
      }
      console.log("Seeded default products and transaction history logs.");
    }
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

// Run DB setup
setupDatabase();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Express body parser
  app.use(express.json());

  // --- API ROUTES ---

  // 1. User Login
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
      }

      const user = await dbGet<any>(
        "SELECT username, password, role, full_name FROM Users WHERE username = ?",
        [username]
      );

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

      let whereClause = "1=1";
      const params: any[] = [];

      if (search) {
        whereClause += " AND (product_name LIKE ? OR sku LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      if (filter === "low") {
        whereClause += " AND current_quantity < min_threshold";
      }

      // Count query for total items matching filter/search
      const countRes = await dbGet<{ total: number }>(
        `SELECT COUNT(*) as total FROM Products WHERE ${whereClause}`,
        params
      );
      const totalItems = countRes?.total || 0;
      const totalPages = Math.ceil(totalItems / limit);

      // Fetch items for the page
      const products = await dbAll<any>(
        `SELECT 
          product_id, 
          product_name, 
          sku, 
          current_quantity, 
          min_threshold, 
          unit,
          (current_quantity < min_threshold) AS is_low_stock
        FROM Products 
        WHERE ${whereClause}
        ORDER BY product_name ASC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        products,
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

      const result = await dbMutex.runExclusive(async () => {
        await dbRun("BEGIN IMMEDIATE");
        try {
          // Check SKU uniqueness
          const existing = await dbGet<any>("SELECT sku FROM Products WHERE sku = ?", [sku]);
          if (existing) {
            await dbRun("ROLLBACK");
            return { status: 400, body: { error: `SKU '${sku}' already exists.` } };
          }

          const insertResult = await dbRun(
            `INSERT INTO Products (product_name, sku, current_quantity, min_threshold, unit) 
             VALUES (?, ?, ?, ?, ?)`,
            [product_name, sku, initialQty, threshold, unit]
          );

          const productId = insertResult.lastID;

          // If initial stock was entered, log it in Stock_In table
          if (initialQty > 0) {
            const now = new Date().toISOString().substring(0, 16);
            await dbRun(
              `INSERT INTO Stock_In (product_id, quantity_added, date, batch_number, added_by) 
               VALUES (?, ?, ?, ?, ?)`,
              [productId, initialQty, now, "BATCH-NEW-PROD", added_by || "admin"]
            );
          }

          await dbRun("COMMIT");
          const newProduct = await dbGet("SELECT * FROM Products WHERE product_id = ?", [productId]);
          return { status: 201, body: { success: true, product: newProduct } };
        } catch (innerErr: any) {
          await dbRun("ROLLBACK");
          throw innerErr;
        }
      });

      res.status(result.status).json(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Record Stock In (Manufacturing / Purchasing Entry)
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

      const result = await dbMutex.runExclusive(async () => {
        await dbRun("BEGIN IMMEDIATE");
        try {
          // Check if product exists and update quantity
          const updateResult = await dbRun(
            "UPDATE Products SET current_quantity = current_quantity + ? WHERE product_id = ?",
            [qty, product_id]
          );

          if (updateResult.changes === 0) {
            await dbRun("ROLLBACK");
            return { status: 404, body: { error: "Product not found." } };
          }

          // Record Stock In Transaction
          await dbRun(
            `INSERT INTO Stock_In (product_id, quantity_added, date, batch_number, added_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [product_id, qty, date, batch_number || null, added_by]
          );

          await dbRun("COMMIT");
          const updatedProduct = await dbGet("SELECT * FROM Products WHERE product_id = ?", [product_id]);
          return { status: 200, body: { success: true, product: updatedProduct } };
        } catch (innerErr: any) {
          await dbRun("ROLLBACK");
          throw innerErr;
        }
      });

      res.status(result.status).json(result.body);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Record Stock Out (Sales / Deliveries Entry)
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

      const result = await dbMutex.runExclusive(async () => {
        await dbRun("BEGIN IMMEDIATE");
        try {
          // Atomic subtraction with validation check in WHERE clause
          const updateResult = await dbRun(
            "UPDATE Products SET current_quantity = current_quantity - ? WHERE product_id = ? AND current_quantity >= ?",
            [qty, product_id, qty]
          );

          if (updateResult.changes === 0) {
            await dbRun("ROLLBACK");
            
            // Check if product exists to provide proper error feedback
            const product = await dbGet<any>("SELECT * FROM Products WHERE product_id = ?", [product_id]);
            if (!product) {
              return { status: 404, body: { error: "Product not found." } };
            }
            return {
              status: 400,
              body: {
                error: `Insufficient stock. Requested sale: ${qty} ${product.unit}, available: ${product.current_quantity} ${product.unit}.`
              }
            };
          }

          // Record Stock Out Transaction
          await dbRun(
            `INSERT INTO Stock_Out (product_id, quantity_sold, customer_name, date, sold_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [product_id, qty, customer_name, date, sold_by]
          );

          await dbRun("COMMIT");
          const updatedProduct = await dbGet("SELECT * FROM Products WHERE product_id = ?", [product_id]);
          return { status: 200, body: { success: true, product: updatedProduct } };
        } catch (innerErr: any) {
          await dbRun("ROLLBACK");
          throw innerErr;
        }
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

      let whereClause = "1=1";
      const params: any[] = [];

      if (search) {
        whereClause += " AND (p.product_name LIKE ? OR p.sku LIKE ? OR s.batch_number LIKE ? OR s.added_by LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const countRes = await dbGet<{ total: number }>(
        `SELECT COUNT(*) as total 
         FROM Stock_In s
         JOIN Products p ON s.product_id = p.product_id
         WHERE ${whereClause}`,
        params
      );
      const totalItems = countRes?.total || 0;
      const totalPages = Math.ceil(totalItems / limit);

      const logs = await dbAll<any>(`
        SELECT 
          s.entry_id, 
          s.product_id, 
          s.quantity_added, 
          s.date, 
          s.batch_number, 
          s.added_by,
          p.product_name,
          p.sku,
          p.unit
        FROM Stock_In s
        JOIN Products p ON s.product_id = p.product_id
        WHERE ${whereClause}
        ORDER BY s.date DESC, s.entry_id DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      res.json({
        logs,
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

      let whereClause = "1=1";
      const params: any[] = [];

      if (search) {
        whereClause += " AND (p.product_name LIKE ? OR p.sku LIKE ? OR s.customer_name LIKE ? OR s.sold_by LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const countRes = await dbGet<{ total: number }>(
        `SELECT COUNT(*) as total 
         FROM Stock_Out s
         JOIN Products p ON s.product_id = p.product_id
         WHERE ${whereClause}`,
        params
      );
      const totalItems = countRes?.total || 0;
      const totalPages = Math.ceil(totalItems / limit);

      const logs = await dbAll<any>(`
        SELECT 
          s.sale_id, 
          s.product_id, 
          s.quantity_sold, 
          s.customer_name, 
          s.date, 
          s.sold_by,
          p.product_name,
          p.sku,
          p.unit
        FROM Stock_Out s
        JOIN Products p ON s.product_id = p.product_id
        WHERE ${whereClause}
        ORDER BY s.date DESC, s.sale_id DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      res.json({
        logs,
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
      const skus = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM Products");
      const lowStock = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM Products WHERE current_quantity < min_threshold");
      const stockInFlow = await dbGet<{ total: number }>("SELECT SUM(quantity_added) as total FROM Stock_In");
      const stockOutFlow = await dbGet<{ total: number }>("SELECT SUM(quantity_sold) as total FROM Stock_Out");
      
      res.json({
        totalSKUs: skus?.count || 0,
        lowStockAlerts: lowStock?.count || 0,
        totalInflow: stockInFlow?.total || 0,
        totalOutflow: stockOutFlow?.total || 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---

  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
