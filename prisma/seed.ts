import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding FarmOps database...\n");

  // Clean existing data
  await prisma.stockCountItem.deleteMany();
  await prisma.stockCount.deleteMany();
  await prisma.seasonInventoryPlan.deleteMany();
  await prisma.season.deleteMany();
  await prisma.wasteRecord.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.resourceRequest.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.stockTransaction.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ───────────────────────────────────────────────
  console.log("Creating users...");
  const hashedPassword = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Samuel Ibe",
      email: "admin@farmops.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  const farmManager = await prisma.user.create({
    data: {
      name: "Kwame Asante",
      email: "manager@farmops.com",
      password: hashedPassword,
      role: "FARM_MANAGER",
    },
  });

  const warehouseManager = await prisma.user.create({
    data: {
      name: "Ama Mensah",
      email: "warehouse@farmops.com",
      password: hashedPassword,
      role: "WAREHOUSE_MANAGER",
    },
  });

  const fieldWorker = await prisma.user.create({
    data: {
      name: "Kofi Boateng",
      email: "worker@farmops.com",
      password: hashedPassword,
      role: "FIELD_WORKER",
    },
  });

  const accountant = await prisma.user.create({
    data: {
      name: "Akua Darko",
      email: "accountant@farmops.com",
      password: hashedPassword,
      role: "ACCOUNTANT",
    },
  });

  console.log("  ✅ 5 users created");

  // ─── Farms ───────────────────────────────────────────────
  console.log("Creating farms...");
  const kumasiFarm = await prisma.farm.create({
    data: {
      name: "Kumasi Farm",
      location: "Kumasi, Ashanti Region",
      description: "Main cocoa and maize production farm",
      acreage: 120,
    },
  });

  const tamaleFarm = await prisma.farm.create({
    data: {
      name: "Tamale Farm",
      location: "Tamale, Northern Region",
      description: "Rice and soybean cultivation",
      acreage: 85,
    },
  });

  const sunyaniFarm = await prisma.farm.create({
    data: {
      name: "Sunyani Farm",
      location: "Sunyani, Bono Region",
      description: "Oil palm and vegetable production",
      acreage: 65,
    },
  });

  console.log("  ✅ 3 farms created");

  // ─── Warehouses ──────────────────────────────────────────
  console.log("Creating warehouses...");
  const kumasiMain = await prisma.warehouse.create({
    data: {
      name: "Main Warehouse",
      farmId: kumasiFarm.id,
      location: "Building A, Kumasi Farm",
      type: "PHYSICAL",
      capacity: 5000,
    },
  });

  const kumasiChemical = await prisma.warehouse.create({
    data: {
      name: "Chemical Store",
      farmId: kumasiFarm.id,
      location: "Building B, Kumasi Farm",
      type: "PHYSICAL",
      capacity: 1000,
    },
  });

  const tamaleMain = await prisma.warehouse.create({
    data: {
      name: "Main Warehouse",
      farmId: tamaleFarm.id,
      location: "Zone 3, Tamale Farm",
      type: "PHYSICAL",
      capacity: 4000,
    },
  });

  const tamaleCold = await prisma.warehouse.create({
    data: {
      name: "Cold Storage",
      farmId: tamaleFarm.id,
      location: "Zone 3, Tamale Farm",
      type: "COLD_STORAGE",
      capacity: 500,
    },
  });

  const sunyaniMain = await prisma.warehouse.create({
    data: {
      name: "Main Warehouse",
      farmId: sunyaniFarm.id,
      location: "Plot 12, Sunyani Farm",
      type: "PHYSICAL",
      capacity: 3500,
    },
  });

  console.log("  ✅ 5 warehouses created");

  // ─── Categories ──────────────────────────────────────────
  console.log("Creating categories...");
  const seedsCategory = await prisma.category.create({
    data: { name: "Seeds", icon: "🌱", color: "#ca8a04" },
  });
  const fertilizerCategory = await prisma.category.create({
    data: { name: "Fertilizers", icon: "🧪", color: "#16a34a" },
  });
  const pesticideCategory = await prisma.category.create({
    data: { name: "Pesticides", icon: "🐛", color: "#dc2626" },
  });
  const herbicideCategory = await prisma.category.create({
    data: { name: "Herbicides", icon: "🌿", color: "#059669" },
  });
  const feedCategory = await prisma.category.create({
    data: { name: "Animal Feed", icon: "🐄", color: "#7c3aed" },
  });
  const fuelCategory = await prisma.category.create({
    data: { name: "Fuel", icon: "⛽", color: "#2563eb" },
  });
  const toolsCategory = await prisma.category.create({
    data: { name: "Tools", icon: "🔧", color: "#6b7280" },
  });
  const packagingCategory = await prisma.category.create({
    data: { name: "Packaging", icon: "📦", color: "#a855f7" },
  });

  console.log("  ✅ 8 categories created");

  // ─── Suppliers ───────────────────────────────────────────
  console.log("Creating suppliers...");
  const agroChem = await prisma.supplier.create({
    data: {
      name: "AgroChem Ghana Ltd",
      contactPerson: "Mr. Kofi Amoako",
      phone: "+233 24 123 4567",
      email: "kofi@agrochemgh.com",
      address: "Tema Industrial Area, Accra",
      rating: 5,
    },
  });

  const farmInputs = await prisma.supplier.create({
    data: {
      name: "Farm Inputs Co.",
      contactPerson: "Ms. Ama Serwah",
      phone: "+233 20 987 6543",
      email: "ama@farminputs.co",
      address: "Kumasi Adum",
      rating: 4,
    },
  });

  const northernSeeds = await prisma.supplier.create({
    data: {
      name: "Northern Seeds Ltd",
      contactPerson: "Mr. Abdul Razak",
      phone: "+233 26 555 1234",
      email: "abdul@northernseeds.com",
      address: "Tamale, Northern Region",
      rating: 4,
    },
  });

  const ghanaFeeds = await prisma.supplier.create({
    data: {
      name: "Ghana Feeds Inc.",
      contactPerson: "Ms. Efua Mensah",
      phone: "+233 27 777 8888",
      email: "efua@ghanafeeds.com",
      address: "Sunyani, Bono Region",
      rating: 3,
    },
  });

  const fuelMaster = await prisma.supplier.create({
    data: {
      name: "FuelMaster Ghana",
      contactPerson: "Mr. Emmanuel Tetteh",
      phone: "+233 24 444 3333",
      email: "emmanuel@fuelmaster.com",
      address: "Tema, Greater Accra",
      rating: 5,
    },
  });

  console.log("  ✅ 5 suppliers created");

  // ─── Inventory Items ─────────────────────────────────────
  console.log("Creating inventory items...");

  const npk = await prisma.inventoryItem.create({
    data: {
      name: "NPK 15-15-15",
      categoryId: fertilizerCategory.id,
      unitOfMeasure: "bags",
      description: "Balanced NPK fertilizer for general crop use",
      minimumStockLevel: 50,
      reorderPoint: 60,
      reorderQuantity: 100,
      defaultSupplierId: agroChem.id,
      shelfLifeDays: 730,
      requiresExpiryTracking: true,
    },
  });

  const urea = await prisma.inventoryItem.create({
    data: {
      name: "Urea Fertilizer",
      categoryId: fertilizerCategory.id,
      unitOfMeasure: "bags",
      description: "High nitrogen fertilizer for top dressing",
      minimumStockLevel: 40,
      reorderPoint: 50,
      reorderQuantity: 80,
      defaultSupplierId: agroChem.id,
      shelfLifeDays: 365,
      requiresExpiryTracking: true,
    },
  });

  const maizeSeeds = await prisma.inventoryItem.create({
    data: {
      name: "Maize Seeds (Hybrid)",
      categoryId: seedsCategory.id,
      unitOfMeasure: "bags",
      description: "High-yield hybrid maize seeds",
      minimumStockLevel: 30,
      reorderPoint: 40,
      reorderQuantity: 60,
      defaultSupplierId: northernSeeds.id,
      shelfLifeDays: 365,
      requiresExpiryTracking: true,
    },
  });

  const riceSeeds = await prisma.inventoryItem.create({
    data: {
      name: "Rice Seeds",
      categoryId: seedsCategory.id,
      unitOfMeasure: "bags",
      description: "Jasmine rice seeds for paddy cultivation",
      minimumStockLevel: 20,
      reorderPoint: 25,
      reorderQuantity: 40,
      defaultSupplierId: northernSeeds.id,
      requiresExpiryTracking: false,
    },
  });

  const pesticideDT = await prisma.inventoryItem.create({
    data: {
      name: "Pesticide DT105",
      categoryId: pesticideCategory.id,
      unitOfMeasure: "liters",
      description: "Broad-spectrum insecticide",
      minimumStockLevel: 20,
      reorderPoint: 25,
      reorderQuantity: 30,
      defaultSupplierId: agroChem.id,
      shelfLifeDays: 545,
      requiresExpiryTracking: true,
    },
  });

  const herbicideRoundup = await prisma.inventoryItem.create({
    data: {
      name: "Roundup Herbicide",
      categoryId: herbicideCategory.id,
      unitOfMeasure: "liters",
      description: "Non-selective systemic herbicide",
      minimumStockLevel: 15,
      reorderPoint: 20,
      reorderQuantity: 25,
      defaultSupplierId: agroChem.id,
      shelfLifeDays: 730,
      requiresExpiryTracking: true,
    },
  });

  const animalFeed = await prisma.inventoryItem.create({
    data: {
      name: "Animal Feed (Layers)",
      categoryId: feedCategory.id,
      unitOfMeasure: "bags",
      description: "Complete feed for laying hens",
      minimumStockLevel: 25,
      reorderPoint: 30,
      reorderQuantity: 50,
      defaultSupplierId: ghanaFeeds.id,
      shelfLifeDays: 180,
      requiresExpiryTracking: true,
    },
  });

  const diesel = await prisma.inventoryItem.create({
    data: {
      name: "Diesel Fuel",
      categoryId: fuelCategory.id,
      unitOfMeasure: "liters",
      description: "Diesel for tractors and farm equipment",
      minimumStockLevel: 500,
      reorderPoint: 600,
      reorderQuantity: 1000,
      defaultSupplierId: fuelMaster.id,
      requiresExpiryTracking: false,
    },
  });

  const seeds = await prisma.inventoryItem.create({
    data: {
      name: "Tomato Seeds",
      categoryId: seedsCategory.id,
      unitOfMeasure: "packets",
      description: "Roma tomato seeds",
      minimumStockLevel: 10,
      reorderPoint: 15,
      reorderQuantity: 20,
      defaultSupplierId: northernSeeds.id,
      shelfLifeDays: 365,
      requiresExpiryTracking: true,
    },
  });

  const pruningShears = await prisma.inventoryItem.create({
    data: {
      name: "Pruning Shears",
      categoryId: toolsCategory.id,
      unitOfMeasure: "units",
      description: "Professional bypass pruning shears",
      minimumStockLevel: 5,
      reorderPoint: 8,
      reorderQuantity: 10,
      defaultSupplierId: farmInputs.id,
      requiresExpiryTracking: false,
    },
  });

  console.log("  ✅ 10 inventory items created");

  // ─── Inventory Batches ───────────────────────────────────
  console.log("Creating inventory batches...");

  // NPK batches
  const npkBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: npk.id,
      batchNumber: "NPK-0826-001",
      supplierId: agroChem.id,
      purchasePrice: 150,
      quantity: 50,
      quantityRemaining: 30,
      warehouseId: kumasiMain.id,
      expiryDate: new Date("2028-03-15"),
      purchaseDate: new Date("2026-08-01"),
      status: "ACTIVE",
    },
  });

  const npkBatch2 = await prisma.inventoryBatch.create({
    data: {
      itemId: npk.id,
      batchNumber: "NPK-0826-002",
      supplierId: agroChem.id,
      purchasePrice: 150,
      quantity: 60,
      quantityRemaining: 50,
      warehouseId: tamaleMain.id,
      expiryDate: new Date("2028-06-20"),
      purchaseDate: new Date("2026-08-10"),
      status: "ACTIVE",
    },
  });

  // Urea batch
  const ureaBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: urea.id,
      batchNumber: "UREA-0826-001",
      supplierId: agroChem.id,
      purchasePrice: 180,
      quantity: 40,
      quantityRemaining: 35,
      warehouseId: kumasiMain.id,
      expiryDate: new Date("2027-12-31"),
      purchaseDate: new Date("2026-08-05"),
      status: "ACTIVE",
    },
  });

  // Maize seeds batches
  const maizeBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: maizeSeeds.id,
      batchNumber: "MAIZE-0826-001",
      supplierId: northernSeeds.id,
      purchasePrice: 150,
      quantity: 40,
      quantityRemaining: 25,
      warehouseId: sunyaniMain.id,
      expiryDate: new Date("2027-06-30"),
      purchaseDate: new Date("2026-07-15"),
      status: "ACTIVE",
    },
  });

  const maizeBatch2 = await prisma.inventoryBatch.create({
    data: {
      itemId: maizeSeeds.id,
      batchNumber: "MAIZE-0826-002",
      supplierId: northernSeeds.id,
      purchasePrice: 150,
      quantity: 50,
      quantityRemaining: 40,
      warehouseId: kumasiMain.id,
      expiryDate: new Date("2027-09-15"),
      purchaseDate: new Date("2026-08-01"),
      status: "ACTIVE",
    },
  });

  // Pesticide batch
  const dtBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: pesticideDT.id,
      batchNumber: "DT105-0826-001",
      supplierId: agroChem.id,
      purchasePrice: 300,
      quantity: 30,
      quantityRemaining: 12,
      warehouseId: kumasiChemical.id,
      expiryDate: new Date("2025-12-31"),
      purchaseDate: new Date("2026-06-01"),
      status: "ACTIVE",
    },
  });

  // Herbicide batch
  const roundupBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: herbicideRoundup.id,
      batchNumber: "ROUND-0826-001",
      supplierId: agroChem.id,
      purchasePrice: 250,
      quantity: 20,
      quantityRemaining: 18,
      warehouseId: kumasiChemical.id,
      expiryDate: new Date("2028-06-30"),
      purchaseDate: new Date("2026-08-15"),
      status: "ACTIVE",
    },
  });

  // Animal feed batch
  const feedBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: animalFeed.id,
      batchNumber: "FEED-0826-001",
      supplierId: ghanaFeeds.id,
      purchasePrice: 50,
      quantity: 100,
      quantityRemaining: 80,
      warehouseId: sunyaniMain.id,
      expiryDate: new Date("2027-03-15"),
      purchaseDate: new Date("2026-08-20"),
      status: "ACTIVE",
    },
  });

  // Diesel batch
  const dieselBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: diesel.id,
      batchNumber: "DSL-0826-001",
      supplierId: fuelMaster.id,
      purchasePrice: 5,
      quantity: 3000,
      quantityRemaining: 2400,
      warehouseId: kumasiMain.id,
      purchaseDate: new Date("2026-08-25"),
      status: "ACTIVE",
    },
  });

  // Rice seeds batch
  const riceBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: riceSeeds.id,
      batchNumber: "RICE-0826-001",
      supplierId: northernSeeds.id,
      purchasePrice: 120,
      quantity: 30,
      quantityRemaining: 22,
      warehouseId: tamaleMain.id,
      expiryDate: new Date("2027-03-01"),
      purchaseDate: new Date("2026-08-10"),
      status: "ACTIVE",
    },
  });

  // Tomato seeds batch (near expiry)
  const tomatoBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: seeds.id,
      batchNumber: "TOM-0626-001",
      supplierId: northernSeeds.id,
      purchasePrice: 25,
      quantity: 15,
      quantityRemaining: 8,
      warehouseId: sunyaniMain.id,
      expiryDate: new Date("2026-10-15"),
      purchaseDate: new Date("2026-06-01"),
      status: "ACTIVE",
    },
  });

  // Pruning shears
  const shearsBatch1 = await prisma.inventoryBatch.create({
    data: {
      itemId: pruningShears.id,
      batchNumber: "TOOL-0826-001",
      supplierId: farmInputs.id,
      purchasePrice: 200,
      quantity: 12,
      quantityRemaining: 10,
      warehouseId: kumasiMain.id,
      purchaseDate: new Date("2026-08-01"),
      status: "ACTIVE",
    },
  });

  console.log("  ✅ 12 batches created");

  // ─── Stock Transactions ──────────────────────────────────
  console.log("Creating stock transactions...");

  const txData = [
    {
      type: "RECEIVED" as const,
      batchId: npkBatch1.id,
      toWarehouseId: kumasiMain.id,
      quantity: 50,
      unitCost: 150,
      totalValue: 7500,
      reason: "Monthly restock from AgroChem",
      performedById: warehouseManager.id,
      farmId: kumasiFarm.id,
    },
    {
      type: "ISSUED" as const,
      batchId: npkBatch1.id,
      fromWarehouseId: kumasiMain.id,
      quantity: 10,
      unitCost: 150,
      totalValue: 1500,
      reason: "Top dressing — Rice Farm A",
      performedById: warehouseManager.id,
      farmId: kumasiFarm.id,
    },
    {
      type: "RECEIVED" as const,
      batchId: npkBatch2.id,
      toWarehouseId: tamaleMain.id,
      quantity: 60,
      unitCost: 150,
      totalValue: 9000,
      reason: "Restock for rice season",
      performedById: warehouseManager.id,
      farmId: tamaleFarm.id,
    },
    {
      type: "TRANSFERRED" as const,
      batchId: maizeBatch2.id,
      fromWarehouseId: kumasiMain.id,
      toWarehouseId: sunyaniMain.id,
      quantity: 10,
      unitCost: 150,
      totalValue: 1500,
      reason: "Inter-farm transfer for planting",
      performedById: farmManager.id,
      farmId: kumasiFarm.id,
    },
    {
      type: "WASTED" as const,
      batchId: dtBatch1.id,
      fromWarehouseId: kumasiChemical.id,
      quantity: 5,
      unitCost: 300,
      totalValue: 1500,
      reason: "Spillage during handling",
      performedById: warehouseManager.id,
      farmId: kumasiFarm.id,
    },
    {
      type: "RECEIVED" as const,
      batchId: feedBatch1.id,
      toWarehouseId: sunyaniMain.id,
      quantity: 100,
      unitCost: 50,
      totalValue: 5000,
      reason: "Weekly feed delivery",
      performedById: warehouseManager.id,
      farmId: sunyaniFarm.id,
    },
    {
      type: "ISSUED" as const,
      batchId: dieselBatch1.id,
      fromWarehouseId: kumasiMain.id,
      quantity: 600,
      unitCost: 5,
      totalValue: 3000,
      reason: "Tractor operations — this week",
      performedById: warehouseManager.id,
      farmId: kumasiFarm.id,
    },
    {
      type: "RECEIVED" as const,
      batchId: ureaBatch1.id,
      toWarehouseId: kumasiMain.id,
      quantity: 40,
      unitCost: 180,
      totalValue: 7200,
      reason: "Urea restock",
      performedById: warehouseManager.id,
      farmId: kumasiFarm.id,
    },
  ];

  for (const tx of txData) {
    await prisma.stockTransaction.create({ data: tx });
  }

  console.log("  ✅ 8 transactions created");

  // ─── Resource Requests ───────────────────────────────────
  console.log("Creating resource requests...");

  await prisma.resourceRequest.create({
    data: {
      requestNumber: "REQ-0826-0001",
      requestedById: fieldWorker.id,
      farmId: tamaleFarm.id,
      warehouseId: tamaleMain.id,
      itemId: npk.id,
      quantity: 10,
      unitOfMeasure: "bags",
      purpose: "Rice Farm B — top dressing application",
      priority: "URGENT",
      status: "PENDING",
    },
  });

  await prisma.resourceRequest.create({
    data: {
      requestNumber: "REQ-0826-0002",
      requestedById: fieldWorker.id,
      farmId: kumasiFarm.id,
      warehouseId: kumasiChemical.id,
      itemId: pesticideDT.id,
      quantity: 5,
      unitOfMeasure: "liters",
      purpose: "Cocoa pest control — Block 3",
      priority: "HIGH",
      status: "APPROVED",
      reviewedById: farmManager.id,
      reviewedAt: new Date("2026-08-31T09:00:00"),
    },
  });

  await prisma.resourceRequest.create({
    data: {
      requestNumber: "REQ-0826-0003",
      requestedById: fieldWorker.id,
      farmId: sunyaniFarm.id,
      warehouseId: sunyaniMain.id,
      itemId: maizeSeeds.id,
      quantity: 15,
      unitOfMeasure: "bags",
      purpose: "New planting — Block 7",
      priority: "MEDIUM",
      status: "FULFILLED",
      reviewedById: farmManager.id,
      reviewedAt: new Date("2026-08-28T15:00:00"),
      fulfilledAt: new Date("2026-08-29T10:00:00"),
    },
  });

  await prisma.resourceRequest.create({
    data: {
      requestNumber: "REQ-0826-0004",
      requestedById: fieldWorker.id,
      farmId: tamaleFarm.id,
      itemId: diesel.id,
      quantity: 200,
      unitOfMeasure: "liters",
      purpose: "Tractor operations — this week",
      priority: "MEDIUM",
      status: "REJECTED",
      reviewedById: farmManager.id,
      reviewNote: "Fuel allocation already scheduled for this week",
      reviewedAt: new Date("2026-08-28T08:30:00"),
    },
  });

  await prisma.resourceRequest.create({
    data: {
      requestNumber: "REQ-0826-0005",
      requestedById: fieldWorker.id,
      farmId: sunyaniFarm.id,
      warehouseId: sunyaniMain.id,
      itemId: animalFeed.id,
      quantity: 20,
      unitOfMeasure: "bags",
      purpose: "Layer house restocking",
      priority: "LOW",
      status: "PENDING",
    },
  });

  console.log("  ✅ 5 resource requests created");

  // ─── Notifications ───────────────────────────────────────
  console.log("Creating notifications...");

  const notifData = [
    {
      userId: warehouseManager.id,
      type: "LOW_STOCK" as const,
      title: "Low Stock Alert: NPK 15-15-15",
      message: "NPK stock at Kumasi Main is at 30 bags (min: 50).",
      entity: "InventoryItem",
      entityId: npk.id,
    },
    {
      userId: warehouseManager.id,
      type: "EXPIRING" as const,
      title: "Expiry Warning: Pesticide DT105",
      message: "Batch DT105-0826-001 expires Dec 31, 2025. Use first.",
      entity: "InventoryBatch",
      entityId: dtBatch1.id,
    },
    {
      userId: farmManager.id,
      type: "REQUEST_PENDING" as const,
      title: "New Request: REQ-0826-0001",
      message: "Kofi Boateng requested 10 bags NPK (Urgent).",
      entity: "ResourceRequest",
    },
    {
      userId: fieldWorker.id,
      type: "REQUEST_APPROVED" as const,
      title: "Request Approved: REQ-0826-0002",
      message: "Your request for Pesticide DT105 has been approved.",
      entity: "ResourceRequest",
    },
  ];

  for (const notif of notifData) {
    await prisma.notification.create({ data: notif });
  }

  console.log("  ✅ 4 notifications created");

  // ─── Seasons ─────────────────────────────────────────────
  console.log("Creating seasons...");

  const majorSeason = await prisma.season.create({
    data: {
      name: "Major Season 2026",
      farmId: kumasiFarm.id,
      cropType: "Maize & Cassava",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-08-31"),
      status: "ACTIVE",
    },
  });

  const minorSeason = await prisma.season.create({
    data: {
      name: "Minor Season 2026",
      farmId: tamaleFarm.id,
      cropType: "Rice & Soybean",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-02-28"),
      status: "PLANNING",
    },
  });

  console.log("  ✅ 2 seasons created");

  // ─── Purchase Orders ──────────────────────────────────
  console.log("Creating purchase orders...");

  const po1 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-0826-0001",
      supplierId: agroChem.id,
      farmId: kumasiFarm.id,
      createdById: admin.id,
      status: "RECEIVED",
      totalAmount: 21000,
      expectedDeliveryDate: new Date("2026-08-15"),
      actualDeliveryDate: new Date("2026-08-14"),
      notes: "Monthly fertilizer restock",
      items: {
        create: [
          { itemId: npk.id, quantity: 50, unitPrice: 150, totalPrice: 7500, quantityReceived: 50 },
          { itemId: urea.id, quantity: 40, unitPrice: 180, totalPrice: 7200, quantityReceived: 40 },
          { itemId: pesticideDT.id, quantity: 21, unitPrice: 300, totalPrice: 6300, quantityReceived: 21 },
        ],
      },
    },
  });

  const po2 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-0826-0002",
      supplierId: northernSeeds.id,
      farmId: tamaleFarm.id,
      createdById: farmManager.id,
      status: "SHIPPED",
      totalAmount: 8800,
      expectedDeliveryDate: new Date("2026-09-05"),
      notes: "Minor season seed procurement",
      items: {
        create: [
          { itemId: riceSeeds.id, quantity: 30, unitPrice: 120, totalPrice: 3600, quantityReceived: 0 },
          { itemId: maizeSeeds.id, quantity: 20, unitPrice: 150, totalPrice: 3000, quantityReceived: 0 },
          { itemId: seeds.id, quantity: 88, unitPrice: 25, totalPrice: 2200, quantityReceived: 0 },
        ],
      },
    },
  });

  const po3 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-0826-0003",
      supplierId: fuelMaster.id,
      farmId: kumasiFarm.id,
      createdById: warehouseManager.id,
      status: "CONFIRMED",
      totalAmount: 15000,
      expectedDeliveryDate: new Date("2026-09-10"),
      notes: "Fuel restock for tractor operations",
      items: {
        create: [
          { itemId: diesel.id, quantity: 3000, unitPrice: 5, totalPrice: 15000, quantityReceived: 0 },
        ],
      },
    },
  });

  const po4 = await prisma.purchaseOrder.create({
    data: {
      orderNumber: "PO-0826-0004",
      supplierId: ghanaFeeds.id,
      farmId: sunyaniFarm.id,
      createdById: admin.id,
      status: "DRAFT",
      totalAmount: 2500,
      notes: "Feed restocking draft",
      items: {
        create: [
          { itemId: animalFeed.id, quantity: 50, unitPrice: 50, totalPrice: 2500, quantityReceived: 0 },
        ],
      },
    },
  });

  console.log("  ✅ 4 purchase orders created");

  // ─── Waste Records ──────────────────────────────────────
  console.log("Creating waste records...");

  await prisma.wasteRecord.create({
    data: {
      batchId: dtBatch1.id,
      quantity: 5,
      wasteType: "DAMAGED",
      reason: "Spillage during transport from storage to field",
      reportedById: warehouseManager.id,
      farmId: kumasiFarm.id,
      estimatedValue: 1500,
    },
  });

  await prisma.wasteRecord.create({
    data: {
      batchId: tomatoBatch1.id,
      quantity: 2,
      wasteType: "EXPIRED",
      reason: "Seeds expired before planting season",
      reportedById: warehouseManager.id,
      farmId: sunyaniFarm.id,
      estimatedValue: 50,
    },
  });

  await prisma.wasteRecord.create({
    data: {
      batchId: feedBatch1.id,
      quantity: 5,
      wasteType: "SPOILED",
      reason: "Feed spoiled due to moisture in storage",
      reportedById: warehouseManager.id,
      farmId: sunyaniFarm.id,
      estimatedValue: 250,
    },
  });

  console.log("  ✅ 3 waste records created");

  // ─── Stock Counts ───────────────────────────────────────
  console.log("Creating stock counts...");

  await prisma.stockCount.create({
    data: {
      warehouseId: kumasiMain.id,
      countedById: warehouseManager.id,
      status: "COMPLETED",
      notes: "Monthly physical count — August 2026",
      items: {
        create: [
          { batchId: npkBatch1.id, systemQuantity: 30, countedQuantity: 28, variance: -2, notes: "2 bags missing — investigated" },
          { batchId: ureaBatch1.id, systemQuantity: 35, countedQuantity: 35, variance: 0 },
          { batchId: maizeBatch2.id, systemQuantity: 40, countedQuantity: 40, variance: 0 },
          { batchId: dieselBatch1.id, systemQuantity: 2400, countedQuantity: 2380, variance: -20, notes: "Meter calibration difference" },
          { batchId: shearsBatch1.id, systemQuantity: 10, countedQuantity: 10, variance: 0 },
        ],
      },
    },
  });

  await prisma.stockCount.create({
    data: {
      warehouseId: sunyaniMain.id,
      countedById: warehouseManager.id,
      status: "COMPLETED",
      notes: "Monthly physical count — Sunyani",
      items: {
        create: [
          { batchId: maizeBatch1.id, systemQuantity: 25, countedQuantity: 25, variance: 0 },
          { batchId: feedBatch1.id, systemQuantity: 80, countedQuantity: 78, variance: -2, notes: "2 bags damaged" },
          { batchId: tomatoBatch1.id, systemQuantity: 8, countedQuantity: 8, variance: 0 },
        ],
      },
    },
  });

  console.log("  ✅ 2 stock counts created");

  // ─── Audit Logs ─────────────────────────────────────────
  console.log("Creating audit logs...");

  const auditData = [
    { userId: admin.id, action: "CREATE", entity: "InventoryItem", entityId: npk.id, newValues: { name: "NPK 15-15-15" } },
    { userId: warehouseManager.id, action: "CREATE", entity: "InventoryBatch", entityId: npkBatch1.id, newValues: { batchNumber: "NPK-0826-001", quantity: 50 } },
    { userId: warehouseManager.id, action: "CREATE", entity: "StockTransaction", entityId: npkBatch1.id, newValues: { type: "RECEIVED", quantity: 50 } },
    { userId: farmManager.id, action: "UPDATE", entity: "ResourceRequest", entityId: "req-002", oldValues: { status: "PENDING" }, newValues: { status: "APPROVED" } },
    { userId: warehouseManager.id, action: "UPDATE", entity: "InventoryBatch", entityId: dtBatch1.id, oldValues: { quantityRemaining: 17 }, newValues: { quantityRemaining: 12 } },
    { userId: admin.id, action: "CREATE", entity: "PurchaseOrder", entityId: po1.id, newValues: { orderNumber: "PO-0826-0001" } },
    { userId: warehouseManager.id, action: "UPDATE", entity: "StockCount", entityId: "sc-001", newValues: { status: "COMPLETED" } },
    { userId: admin.id, action: "CREATE", entity: "User", entityId: accountant.id, newValues: { name: "Akua Darko", role: "ACCOUNTANT" } },
    { userId: fieldWorker.id, action: "CREATE", entity: "ResourceRequest", entityId: "req-005", newValues: { requestNumber: "REQ-0826-0005" } },
    { userId: warehouseManager.id, action: "UPDATE", entity: "PurchaseOrder", entityId: po1.id, oldValues: { status: "SHIPPED" }, newValues: { status: "RECEIVED" } },
  ];

  for (const log of auditData) {
    await prisma.auditLog.create({ data: log as any });
  }

  console.log("  ✅ 10 audit logs created");

  console.log("\n🎉 Seed completed successfully!\n");
  console.log("Login credentials:");
  console.log("  Admin:       admin@farmops.com / password123");
  console.log("  Manager:     manager@farmops.com / password123");
  console.log("  Warehouse:   warehouse@farmops.com / password123");
  console.log("  Worker:      worker@farmops.com / password123");
  console.log("  Accountant:  accountant@farmops.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
