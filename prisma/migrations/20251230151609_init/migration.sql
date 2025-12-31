-- CreateTable
CREATE TABLE "Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_name" TEXT,
    "original_amount" REAL,
    "discounted_amount" REAL,
    "address_code" TEXT,
    "order_date" TEXT,
    "tracking_code" TEXT NOT NULL,
    "received_date" TEXT,
    "status" TEXT,
    "note" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_tracking_code_key" ON "Order"("tracking_code");
