const express = require("express");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const port = 3000;

const prisma = new PrismaClient();

const activeTokens = new Set();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: path.join(__dirname, "uploads") });

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    return epoch.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.includes("/") ? trimmed.split("/") : trimmed.split("-");
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) {
        y = y > "50" ? "19" + y : "20" + y;
      }
      const iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(
        2,
        "0"
      )}`;
      const test = new Date(iso);
      if (!isNaN(test.getTime())) {
        return iso;
      }
    }
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

function parseAmount(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseStatus(receivedCell) {
  if (!receivedCell) return "CHUA_NHAN";
  const raw = String(receivedCell).trim();
  if (!raw) return "CHUA_NHAN";
  const str = raw.toLowerCase();
  const plain = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (plain.includes("hoan")) return "HOAN";
  return "DA_NHAN";
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    const token = parts[1];
    if (activeTokens.has(token)) {
      return next();
    }
  }
  return res
    .status(401)
    .json({ error: "Không có quyền truy cập, vui lòng đăng nhập" });
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Thiếu tài khoản hoặc mật khẩu" });
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res
      .status(401)
      .json({ error: "Tài khoản hoặc mật khẩu không đúng" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  activeTokens.add(token);
  return res.json({ token });
});

app.post("/api/import", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Thiếu file upload" });
  }
  const filePath = req.file.path;
  try {
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheet =
      workbook.Sheets["2025"] || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return res.status(400).json({ error: "Không tìm thấy sheet dữ liệu" });
    }
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
    if (rows.length <= 1) {
      return res.status(400).json({ error: "Sheet không có dữ liệu" });
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const operations = [];
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const productName = row[1];
      const originalAmount = parseAmount(row[2]);
      const discountedAmount = parseAmount(row[3]);
      const addressCode = row[4] ? String(row[4]).trim() : null;
      const orderDate = parseExcelDate(row[5]);
      const trackingCode = row[6] ? String(row[6]).trim() : null;
      const receivedCell = row[7];
      const receivedDate =
        parseStatus(receivedCell) === "DA_NHAN"
          ? parseExcelDate(receivedCell)
          : null;
      const status = parseStatus(receivedCell);
      if (!trackingCode) {
        skipped += 1;
        continue;
      }
      operations.push(
        prisma.order
          .upsert({
            where: { tracking_code: trackingCode },
            create: {
              product_name: productName || null,
              original_amount: originalAmount,
              discounted_amount: discountedAmount,
              address_code: addressCode,
              order_date: orderDate,
              tracking_code: trackingCode,
              received_date: receivedDate,
              status,
              note: null,
              shop_name: null,
            },
            update: {
              product_name: productName || null,
              original_amount: originalAmount,
              discounted_amount: discountedAmount,
              address_code: addressCode,
              order_date: orderDate,
              received_date: receivedDate,
              status,
              note: null,
              shop_name: null,
            },
          })
          .then(result => {
            if (result) {
              updated += 1;
            } else {
              inserted += 1;
            }
          })
          .catch(() => {
            skipped += 1;
          })
      );
    }
    Promise.all(operations).then(
      () => {
        fs.unlink(filePath, () => {});
        return res.json({ inserted, updated, skipped });
      },
      () => {
        fs.unlink(filePath, () => {});
        return res.status(500).json({ error: "Lỗi lưu dữ liệu" });
      }
    );
  } catch (e) {
    fs.unlink(filePath, () => {});
    return res.status(500).json({ error: "Lỗi đọc file Excel" });
  }
});

app.get("/api/orders", authMiddleware, (req, res) => {
  const { q, status, fromDate, toDate } = req.query;
  const where = {};
  const keyword = typeof q === "string" ? q.trim() : "";
  if (keyword) {
    where.OR = [
      { product_name: { contains: keyword } },
      { tracking_code: { contains: keyword } },
    ];
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (fromDate || toDate) {
    where.order_date = {};
    if (fromDate) {
      where.order_date.gte = fromDate;
    }
    if (toDate) {
      where.order_date.lte = toDate;
    }
  }
  prisma.order
    .findMany({
      where,
      orderBy: [
        { order_date: "desc" },
        { id: "desc" },
      ],
    })
    .then(rows => res.json(rows))
    .catch(() => res.status(500).json({ error: "Lỗi truy vấn dữ liệu" }));
});

app.post("/api/orders", authMiddleware, (req, res) => {
  const {
    product_name,
    original_amount,
    discounted_amount,
    address_code,
    order_date,
    tracking_code,
    received_date,
    status,
    note,
    shop_name,
  } = req.body;

  if (!tracking_code) {
    return res.status(400).json({ error: "Thiếu mã vận đơn" });
  }

  const data = {
    product_name: product_name || null,
    original_amount: parseAmount(original_amount),
    discounted_amount: parseAmount(discounted_amount),
    address_code: address_code || null,
    order_date: order_date || null,
    tracking_code,
    received_date: received_date || null,
    status: status || "CHUA_NHAN",
    note: note || null,
    shop_name: shop_name || null,
  };

  prisma.order
    .create({ data })
    .then(order => res.json(order))
    .catch(err => {
      if (err && err.code === "P2002") {
        return res
          .status(400)
          .json({ error: "Mã vận đơn đã tồn tại trong hệ thống" });
      }
      return res.status(500).json({ error: "Lỗi tạo đơn hàng" });
    });
});

app.put("/api/orders/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const data = {};
  const fields = [
    "product_name",
    "original_amount",
    "discounted_amount",
    "address_code",
    "order_date",
    "tracking_code",
    "received_date",
    "status",
    "note",
    "shop_name",
  ];
  fields.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      if (
        key === "original_amount" ||
        key === "discounted_amount"
      ) {
        const num = req.body[key];
        data[key] = num == null ? null : Number(num);
      } else {
        data[key] = req.body[key];
      }
    }
  });
  prisma.order
    .update({
      where: { id: Number(id) },
      data,
    })
    .then(order => res.json(order))
    .catch(() =>
      res.status(500).json({ error: "Lỗi cập nhật đơn hàng" })
    );
});

app.delete("/api/orders/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  prisma.order
    .delete({
      where: { id: Number(id) },
    })
    .then(() => res.json({ success: true }))
    .catch(() =>
      res.status(500).json({ error: "Lỗi xóa đơn hàng" })
    );
});

app.get("/api/stats/daily", authMiddleware, (req, res) => {
  const { q, status, fromDate, toDate } = req.query;
  const where = {};
  const keyword = typeof q === "string" ? q.trim() : "";
  if (keyword) {
    where.OR = [
      { product_name: { contains: keyword } },
      { tracking_code: { contains: keyword } },
    ];
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (fromDate || toDate) {
    where.order_date = {};
    if (fromDate) {
      where.order_date.gte = fromDate;
    }
    if (toDate) {
      where.order_date.lte = toDate;
    }
  }
  if (!where.order_date) {
    where.order_date = {};
  }
  where.order_date.not = null;
  prisma.order
    .groupBy({
      by: ["order_date"],
      where,
      _count: { id: true },
      _sum: { original_amount: true, discounted_amount: true },
      orderBy: { order_date: "asc" },
    })
    .then(groups =>
      res.json(
        groups.map(g => ({
          order_date: g.order_date,
          total_orders: g._count.id,
          total_original: g._sum.original_amount || 0,
          total_discounted: g._sum.discounted_amount || 0,
          total_profit:
            (g._sum.original_amount || 0) -
            (g._sum.discounted_amount || 0),
        }))
      )
    )
    .catch(() =>
      res
        .status(500)
        .json({ error: "Lỗi truy vấn thống kê theo ngày" })
    );
});

app.get("/api/stats/monthly", authMiddleware, (req, res) => {
  const { q, status, fromDate, toDate } = req.query;
  const where = {};
  const keyword = typeof q === "string" ? q.trim() : "";
  if (keyword) {
    where.OR = [
      { product_name: { contains: keyword } },
      { tracking_code: { contains: keyword } },
    ];
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (fromDate || toDate) {
    where.order_date = {};
    if (fromDate) {
      where.order_date.gte = fromDate;
    }
    if (toDate) {
      where.order_date.lte = toDate;
    }
  }
  if (!where.order_date) {
    where.order_date = {};
  }
  where.order_date.not = null;
  prisma.order
    .findMany({
      where,
      select: {
        order_date: true,
        original_amount: true,
        discounted_amount: true,
      },
    })
    .then(rows => {
      const map = {};
      rows.forEach(row => {
        if (!row.order_date) return;
        const key = String(row.order_date).slice(0, 7);
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            month: key,
            total_orders: 0,
            total_original: 0,
            total_discounted: 0,
            total_profit: 0,
          };
        }
        map[key].total_orders += 1;
        if (typeof row.original_amount === "number") {
          map[key].total_original += row.original_amount;
        }
        if (typeof row.discounted_amount === "number") {
          map[key].total_discounted += row.discounted_amount;
        }
        map[key].total_profit =
          map[key].total_original - map[key].total_discounted;
      });
      const result = Object.values(map).sort((a, b) =>
        a.month.localeCompare(b.month)
      );
      res.json(result);
    })
    .catch(() =>
      res
        .status(500)
        .json({ error: "Lỗi truy vấn thống kê theo tháng" })
    );
});

app.get("/api/stats/summary", authMiddleware, (req, res) => {
  const result = {};
  prisma.order
    .aggregate({
      _count: { id: true },
      _sum: { original_amount: true, discounted_amount: true },
    })
    .then(agg => {
      result.total_orders = agg._count.id || 0;
      result.total_original = agg._sum.original_amount || 0;
      result.total_discounted = agg._sum.discounted_amount || 0;
      result.total_profit =
        (result.total_original || 0) - (result.total_discounted || 0);
      return prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      });
    })
    .then(groups => {
      result.status_counts = groups.map(g => ({
        status: g.status,
        count: g._count._all,
      }));
      res.json(result);
    })
    .catch(() =>
      res.status(500).json({ error: "Lỗi truy vấn thống kê" })
    );
});

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});
