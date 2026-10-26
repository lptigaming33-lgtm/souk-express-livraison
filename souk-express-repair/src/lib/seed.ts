import { db } from "@/db";
import {
  profiles,
  serviceZones,
  shops,
  products,
  addresses,
  promotions,
  orders,
  orderItems,
  driverAssignments,
  codRecords,
  loyaltyRecords,
} from "@/db/schema";
import { hashPassword } from "./business-logic";
import { count } from "drizzle-orm";

let isSeeding = false;

export async function ensureSeeded() {
  // Seed data includes public demo credentials and fictional customers/orders.
  // It must never be created automatically in production.
  if (process.env.NODE_ENV === "production" || process.env.SEED_DEMO_DATA !== "true") return;
  if (isSeeding) return;
  try {
    const existing = await db.select({ value: count() }).from(profiles);
    if ((existing[0]?.value ?? 0) > 0) {
      return;
    }

    isSeeding = true;
    const defaultHash = hashPassword("souk2026");

    // 1. Seed Agadir Service Zones
    const insertedZones = await db
      .insert(serviceZones)
      .values([
        {
          nameFr: "Talborjt (Centre-Ville)",
          nameAr: "تالبورجت (وسط المدينة)",
          slug: "talborjt",
          deliveryFeeMad: 12,
          driverPayoutMad: 10,
          estimatedMins: "20-30 min",
          mapQuery: "Talborjt, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Souk El Had & Al Inbiaat",
          nameAr: "سوق الأحد والانبعاث",
          slug: "souk-el-had",
          deliveryFeeMad: 15,
          driverPayoutMad: 12,
          estimatedMins: "25-35 min",
          mapQuery: "Souk El Had, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Hay Dakhla (Université)",
          nameAr: "حي الداخلة (الجامعة)",
          slug: "hay-dakhla",
          deliveryFeeMad: 15,
          driverPayoutMad: 12,
          estimatedMins: "25-35 min",
          mapQuery: "Hay Dakhla, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Hay Salam & Jet Sakane",
          nameAr: "حي السلام وجيت سكن",
          slug: "hay-salam",
          deliveryFeeMad: 18,
          driverPayoutMad: 14,
          estimatedMins: "30-40 min",
          mapQuery: "Hay Salam, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Founty & Marina d'Agadir",
          nameAr: "فونتي ومارينا أكادير",
          slug: "founty-marina",
          deliveryFeeMad: 18,
          driverPayoutMad: 15,
          estimatedMins: "25-35 min",
          mapQuery: "Founty, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Hay Mohammadi",
          nameAr: "الحي المحمدي",
          slug: "hay-mohammadi",
          deliveryFeeMad: 20,
          driverPayoutMad: 16,
          estimatedMins: "30-45 min",
          mapQuery: "Hay Mohammadi, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Tilila & Tikiouine",
          nameAr: "تيليلا وتيكيوين",
          slug: "tilila",
          deliveryFeeMad: 22,
          driverPayoutMad: 18,
          estimatedMins: "35-50 min",
          mapQuery: "Tilila, Agadir, Morocco",
          isActive: true,
        },
        {
          nameFr: "Anza (Corniche Nord)",
          nameAr: "أنزا (الكورنيش الشمالي)",
          slug: "anza",
          deliveryFeeMad: 25,
          driverPayoutMad: 20,
          estimatedMins: "35-50 min",
          mapQuery: "Anza, Agadir, Morocco",
          isActive: true,
        },
      ])
      .returning();

    const zoneTalborjt = insertedZones[0]!;
    const zoneSouk = insertedZones[1]!;
    const zoneDakhla = insertedZones[2]!;
    const zoneSalam = insertedZones[3]!;
    const zoneFounty = insertedZones[4]!;

    // 2. Seed Profiles: 1 Admin, 4 Motorcycle Drivers, 5 Partners, 2 Customers
    const insertedProfiles = await db
      .insert(profiles)
      .values([
        // Admin
        {
          email: "admin@soukexpress.ma",
          phone: "+212661102030",
          fullName: "Tariq Ouhammou (Admin)",
          passwordHash: defaultHash,
          role: "admin",
          currentZone: "Talborjt",
          isOnline: true,
        },
        // 4 Motorcycle Delivery Drivers (Fleet of 4)
        {
          email: "yassine.moto1@soukexpress.ma",
          phone: "+212662110001",
          fullName: "Yassine El Amrani",
          passwordHash: defaultHash,
          role: "driver",
          driverCode: "MOTO-01",
          vehiclePlate: "Agadir 4821-A-33",
          currentZone: "Talborjt (Centre-Ville)",
          isOnline: true,
        },
        {
          email: "karim.moto2@soukexpress.ma",
          phone: "+212662110002",
          fullName: "Karim Bensaid",
          passwordHash: defaultHash,
          role: "driver",
          driverCode: "MOTO-02",
          vehiclePlate: "Agadir 7190-B-33",
          currentZone: "Hay Dakhla (Université)",
          isOnline: true,
        },
        {
          email: "othmane.moto3@soukexpress.ma",
          phone: "+212662110003",
          fullName: "Othmane Tazi",
          passwordHash: defaultHash,
          role: "driver",
          driverCode: "MOTO-03",
          vehiclePlate: "Agadir 3312-A-33",
          currentZone: "Souk El Had & Al Inbiaat",
          isOnline: true,
        },
        {
          email: "mehdi.moto4@soukexpress.ma",
          phone: "+212662110004",
          fullName: "Mehdi Ait Baha",
          passwordHash: defaultHash,
          role: "driver",
          driverCode: "MOTO-04",
          vehiclePlate: "Agadir 9045-D-33",
          currentZone: "Founty & Marina d'Agadir",
          isOnline: false,
        },
        // Partners
        {
          email: "grillades.talborjt@soukexpress.ma",
          phone: "+212528841122",
          fullName: "Hassan Ait Melloul (Dar Tajine)",
          passwordHash: defaultHash,
          role: "partner",
          currentZone: "Talborjt",
          isOnline: true,
        },
        {
          email: "coop.soukelhad@soukexpress.ma",
          phone: "+212528823344",
          fullName: "Fatima Zahra Oulad (Coop Souk El Had)",
          passwordHash: defaultHash,
          role: "partner",
          currentZone: "Souk El Had",
          isOnline: true,
        },
        {
          email: "tacos.dakhla@soukexpress.ma",
          phone: "+212528229900",
          fullName: "Rachid Bouali (Agadir Street Tacos)",
          passwordHash: defaultHash,
          role: "partner",
          currentZone: "Hay Dakhla",
          isOnline: true,
        },
        {
          email: "patisserie.founty@soukexpress.ma",
          phone: "+212528845566",
          fullName: "Nadia Tafarnout (Pâtisserie Tafarnout)",
          passwordHash: defaultHash,
          role: "partner",
          currentZone: "Founty",
          isOnline: true,
        },
        {
          email: "primeur.salam@soukexpress.ma",
          phone: "+212663998877",
          fullName: "Brahim Souss (Primeur Fraîcheur)",
          passwordHash: defaultHash,
          role: "partner",
          currentZone: "Hay Salam",
          isOnline: true,
        },
        // Customers
        {
          email: "salma@client.ma",
          phone: "+212668445566",
          fullName: "Salma Chraibi",
          passwordHash: defaultHash,
          role: "customer",
          currentZone: "Talborjt",
          isOnline: true,
        },
        {
          email: "amine@client.ma",
          phone: "+212669778899",
          fullName: "Amine Berrada",
          passwordHash: defaultHash,
          role: "customer",
          currentZone: "Hay Dakhla",
          isOnline: true,
        },
      ])
      .returning();

    const adminUser = insertedProfiles[0]!;
    const driver1 = insertedProfiles[1]!;
    const driver2 = insertedProfiles[2]!;
    const partner1 = insertedProfiles[5]!;
    const partner2 = insertedProfiles[6]!;
    const partner3 = insertedProfiles[7]!;
    const partner4 = insertedProfiles[8]!;
    const partner5 = insertedProfiles[9]!;
    const customer1 = insertedProfiles[10]!;
    const customer2 = insertedProfiles[11]!;

    // 3. Seed Partner Shops (4 Approved, 1 Pending Admin Approval)
    const insertedShops = await db
      .insert(shops)
      .values([
        {
          ownerId: partner1.id,
          nameFr: "Dar Tajine & Grillades Talborjt",
          nameAr: "دار الطاجين ومشويات تالبورجت",
          category: "restaurants",
          descriptionFr:
            "Tajines berbères au feu de bois, grillades mixtes et couscous traditionnel au cœur de Talborjt.",
          descriptionAr:
            "طواجن أمازيغية على الفحم، مشويات مشكلة وكسكس تقليدي في قلب تالبورجت.",
          imageUrl:
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=900&q=80",
          address: "Place Talborjt, Rue de l'Entraide, Agadir",
          zoneId: zoneTalborjt.id,
          phone: "+212528841122",
          commissionRate: 15,
          prepTimeMins: "25-35 min",
          rating: "4.9",
          isApproved: true,
          isOpen: true,
        },
        {
          ownerId: partner2.id,
          nameFr: "Trésors de Souk El Had (Argan & Amlou)",
          nameAr: "كنوز سوق الأحد (أركان وأملو)",
          category: "souk",
          descriptionFr:
            "Produits authentiques du Souss : Amlou artisanal aux amandes, huile d'argan bio, miel d'euphorbe et épices.",
          descriptionAr:
            "منتجات سوس الأصيلة: أملو بلدي باللوز، زيت أركان حر، عسل الدغموس وتوابل ممتازة.",
          imageUrl:
            "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=80",
          address: "Souk El Had, Porte 6, Agadir",
          zoneId: zoneSouk.id,
          phone: "+212528823344",
          commissionRate: 12,
          prepTimeMins: "15-25 min",
          rating: "4.9",
          isApproved: true,
          isOpen: true,
        },
        {
          ownerId: partner3.id,
          nameFr: "Agadir Street Tacos & Smash Burgers",
          nameAr: "أكادير ستريت تاكوس وبرغر",
          category: "restaurants",
          descriptionFr:
            "Tacos gratinés sauce fromagère maison, smash burgers et paninis livrés chauds à Hay Dakhla et partout à Agadir.",
          descriptionAr:
            "تاكوس غراتيني بصلصة الجبن المنزلية، سماش برغر وبانيني ساخن في حي الداخلة وجميع أنحاء أكادير.",
          imageUrl:
            "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=900&q=80",
          address: "Avenue Al Qods, Hay Dakhla, Agadir",
          zoneId: zoneDakhla.id,
          phone: "+212528229900",
          commissionRate: 15,
          prepTimeMins: "20-30 min",
          rating: "4.7",
          isApproved: true,
          isOpen: true,
        },
        {
          ownerId: partner4.id,
          nameFr: "Boulangerie & Pâtisserie Tafarnout",
          nameAr: "مخبزة وحلويات تفرنوت",
          category: "patisserie",
          descriptionFr:
            "Msemmen chaud, Baghrir, pain Tafarnout traditionnel, cornes de gazelle et jus d'orange pressé du Souss.",
          descriptionAr:
            "مسمن ساخن، بغرير، خبز تفرنوت التقليدي، كعب غزال وعصير برتقال سوس الطبيعي.",
          imageUrl:
            "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
          address: "Boulevard Mohammed V, Founty, Agadir",
          zoneId: zoneFounty.id,
          phone: "+212528845566",
          commissionRate: 14,
          prepTimeMins: "15-20 min",
          rating: "4.8",
          isApproved: true,
          isOpen: true,
        },
        {
          ownerId: partner5.id,
          nameFr: "Panier Fraîcheur Souss (Fruits & Légumes)",
          nameAr: "سلة سوس الطازجة (فواكه وخضر)",
          category: "epicerie",
          descriptionFr:
            "Paniers de fruits et légumes frais récoltés dans la plaine du Souss-Massa.",
          descriptionAr:
            "سلال الفواكه والخضر الطازجة من ضيعات سوس ماسة.",
          imageUrl:
            "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
          address: "Rue 12, Hay Salam, Agadir",
          zoneId: zoneSalam.id,
          phone: "+212663998877",
          commissionRate: 10,
          prepTimeMins: "20-30 min",
          rating: "4.6",
          isApproved: false, // Pending approval so Admin can test shop approval!
          isOpen: true,
        },
      ])
      .returning();

    const shopTajine = insertedShops[0]!;
    const shopSouk = insertedShops[1]!;
    const shopTacos = insertedShops[2]!;
    const shopPatisserie = insertedShops[3]!;
    const shopPending = insertedShops[4]!;

    // 4. Seed Products
    const insertedProducts = await db
      .insert(products)
      .values([
        // Shop 1: Dar Tajine & Grillades Talborjt
        {
          shopId: shopTajine.id,
          nameFr: "Tajine Berbère au Bœuf & Pruneaux",
          nameAr: "طاجين أمازيغي باللحم والبرقوق",
          descriptionFr:
            "Mijoté sur charbon avec amandes grillées, pruneaux caramélisés et 2 pains Tafarnout chauds.",
          descriptionAr:
            "مطهو على الفحم مع اللوز المقلي والبرقوق المعسل وخبز تفرنوت الساخن.",
          priceMad: 65,
          categoryFr: "Tajines",
          categoryAr: "طواجن",
          imageUrl:
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopTajine.id,
          nameFr: "Tajine Poulet Fermier Citron & Olives",
          nameAr: "طاجين الدجاج البلدي بالحمض والزيتون",
          descriptionFr:
            "Poulet beldi tendre aux citrons confits, olives rouges du Souss et frites maison.",
          descriptionAr:
            "دجاج بلدي طري بالليمون المرقد والزيتون الأحمر مع البطاطس المقلية.",
          priceMad: 55,
          categoryFr: "Tajines",
          categoryAr: "طواجن",
          imageUrl:
            "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopTajine.id,
          nameFr: "Assiette Grillades Mixtes Royale",
          nameAr: "طبق مشويات مشكلة ملكي",
          descriptionFr:
            "Brochettes de kefta, dinde marinée, merguez, salade marocaine, riz et Zaalouk.",
          descriptionAr:
            "قطبان كفتة، ديك رومي متبل، مركاز، سلطة مغربية، أرز وزعلوك.",
          priceMad: 75,
          categoryFr: "Grillades",
          categoryAr: "مشويات",
          imageUrl:
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopTajine.id,
          nameFr: "Thé Marocain à la Menthe d'Agadir",
          nameAr: "أتاي مغربي بنعناع أكادير",
          descriptionFr: "Thé vert infusé à la menthe fraîche et pignons.",
          descriptionAr: "شاي أخضر بالنعناع الطري والصنوبر.",
          priceMad: 15,
          categoryFr: "Boissons",
          categoryAr: "مشروبات",
          imageUrl:
            "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },

        // Shop 2: Trésors de Souk El Had
        {
          shopId: shopSouk.id,
          nameFr: "Pot d'Amlou Artisanal aux Amandes (500g)",
          nameAr: "أملو بلدي باللوز الحر (500 غرام)",
          descriptionFr:
            "Préparé avec amandes torréfiées de Tafraout, huile d'argan pure et miel d'oranger.",
          descriptionAr:
            "محضر بلوز تافراوت المحمص، زيت أركان حر وعسل البرتقال.",
          priceMad: 110,
          categoryFr: "Terroir Souss",
          categoryAr: "منتجات سوس",
          imageUrl:
            "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopSouk.id,
          nameFr: "Huile d'Argan Alimentaire Bio (250ml)",
          nameAr: "زيت أركان للأكل بيو (250 مل)",
          descriptionFr:
            "Première pression à froid certifiée par notre coopérative féminine du Souss.",
          descriptionAr:
            "عصرة أولى على البارد من التعاونية النسوية لسوس.",
          priceMad: 95,
          categoryFr: "Terroir Souss",
          categoryAr: "منتجات سوس",
          imageUrl:
            "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopSouk.id,
          nameFr: "Coffret Épices Ras El Hanout & Safran",
          nameAr: "علبة توابل راس الحانوت وزعفران تالوين",
          descriptionFr:
            "Assortiment d'épices fraîchement moulues au Souk El Had + pistils de safran de Taliouine.",
          descriptionAr:
            "تشكيلة توابل مطحونة طازجة في سوق الأحد مع زعفران تالوين الحر.",
          priceMad: 60,
          categoryFr: "Épices",
          categoryAr: "توابل",
          imageUrl:
            "https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },

        // Shop 3: Agadir Street Tacos
        {
          shopId: shopTacos.id,
          nameFr: "Tacos XL Mixte Gratiné Mozzarella",
          nameAr: "تاكوس XL مشكل غراتيني بالموتزاريلا",
          descriptionFr:
            "Poulet mariné, viande hachée, sauce fromagère maison, sauce algérienne et frites.",
          descriptionAr:
            "دجاج متبل، كفتة، صلصة الجبن المنزلية، صلصة جزائرية وبطاطس مقلية.",
          priceMad: 48,
          categoryFr: "Tacos",
          categoryAr: "تاكوس",
          imageUrl:
            "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopTacos.id,
          nameFr: "Double Smash Burger Cheddar + Frites",
          nameAr: "دبل سماش برغر شيدر + بطاطس",
          descriptionFr:
            "2 steaks smashés bœuf local, double cheddar fondu, oignons caramélisés et bun brioché.",
          descriptionAr:
            "قطعتان من اللحم المفروم، جبن شيدر مضاعف، بصل مكرمل وخبز بريوش.",
          priceMad: 52,
          categoryFr: "Burgers",
          categoryAr: "برغر",
          imageUrl:
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },

        // Shop 4: Pâtisserie Tafarnout
        {
          shopId: shopPatisserie.id,
          nameFr: "Pack Ftour / Goûter Beldi (Msemmen & Baghrir)",
          nameAr: "باك فطور / كوتي بلدي (مسمن وبغرير)",
          descriptionFr:
            "4 Msemmens chauds, 4 Baghrirs mille-trous, beurre beldi, miel et 1L de jus d'orange frais.",
          descriptionAr:
            "4 مسمنات ساخنة، 4 بغرير، زبدة بلدية، عسل و1 لتر عصير برتقال طبيعي.",
          priceMad: 45,
          categoryFr: "Boulangerie",
          categoryAr: "مخبوزات",
          imageUrl:
            "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
        {
          shopId: shopPatisserie.id,
          nameFr: "Plateau Pâtisseries Marocaines aux Amandes (500g)",
          nameAr: "بلاطو حلويات اللوز المغربية (500 غرام)",
          descriptionFr:
            "Cornes de gazelle, Briouates au miel, Ghriba bahla et Fekkas aux amandes.",
          descriptionAr:
            "كعب غزال، بريوات بالعسل، غريبة بهلة وفقاص باللوز.",
          priceMad: 85,
          categoryFr: "Pâtisserie",
          categoryAr: "حلويات",
          imageUrl:
            "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },

        // Shop 5 (Pending shop)
        {
          shopId: shopPending.id,
          nameFr: "Panier Familial Souss (8kg Fruits & Légumes)",
          nameAr: "سلة العائلة سوس (8 كلغ فواكه وخضر)",
          descriptionFr:
            "Tomates, pommes de terre, oignons, oranges d'Agadir, bananes et avocats.",
          descriptionAr:
            "طماطم، بطاطس، بصل، برتقال أكادير، موز وأفوكادو.",
          priceMad: 90,
          categoryFr: "Paniers",
          categoryAr: "سلال",
          imageUrl:
            "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80",
          isAvailable: true,
        },
      ])
      .returning();

    const prodTajineBoeuf = insertedProducts[0]!;
    const prodTajinePoulet = insertedProducts[1]!;
    const prodGrillades = insertedProducts[2]!;
    const prodThe = insertedProducts[3]!;
    const prodAmlou = insertedProducts[4]!;
    const prodTacos = insertedProducts[7]!;
    const prodBurger = insertedProducts[8]!;

    // 5. Seed Customer Addresses
    await db.insert(addresses).values([
      {
        userId: customer1.id,
        label: "Maison (Talborjt)",
        zoneId: zoneTalborjt.id,
        streetAddress: "Imm. Atlas, Appt 8, Avenue Hassan II, Talborjt",
        landmark: "En face du Jardin Olhão, près Pharmacie Centrale",
        phone: "+212668445566",
        isDefault: true,
      },
      {
        userId: customer2.id,
        label: "Résidence Dakhla",
        zoneId: zoneDakhla.id,
        streetAddress: "Rue 402, Imm. B, Appt 3, Hay Dakhla",
        landmark: "À côté de la Faculté Ibn Zohr",
        phone: "+212669778899",
        isDefault: true,
      },
    ]);

    // 6. Seed Promotions
    await db.insert(promotions).values([
      {
        code: "BIENVENUE15",
        titleFr: "-15 MAD sur votre commande (dès 60 MAD)",
        titleAr: "خصم 15 درهم على طلبك (ابتداء من 60 درهم)",
        discountMad: 15,
        minOrderMad: 60,
        isActive: true,
        usageCount: 14,
      },
      {
        code: "AGADIR20",
        titleFr: "-20 MAD Spécial Agadir (dès 100 MAD)",
        titleAr: "خصم 20 درهم خاص بأكادير (ابتداء من 100 درهم)",
        discountMad: 20,
        minOrderMad: 100,
        isActive: true,
        usageCount: 8,
      },
      {
        code: "SOUK10",
        titleFr: "-10 MAD sur tout Souk Express (dès 45 MAD)",
        titleAr: "خصم 10 دراهم على جميع الطلبات (ابتداء من 45 درهم)",
        discountMad: 10,
        minOrderMad: 45,
        isActive: true,
        usageCount: 23,
      },
    ]);

    // 7. Seed Loyalty Records (10-stamp card)
    await db.insert(loyaltyRecords).values([
      {
        customerId: customer1.id,
        stampsCount: 8, // 8 out of 10 stamps!
        pointsBalance: 160,
        totalOrdersCompleted: 8,
        rewardsRedeemed: 0,
      },
      {
        customerId: customer2.id,
        stampsCount: 10, // Full 10 stamps ready to redeem for 25 MAD discount!
        pointsBalance: 250,
        totalOrdersCompleted: 10,
        rewardsRedeemed: 1,
      },
    ]);

    // 8. Seed Sample Orders across the lifecycle
    // Order 1: Delivered & Cash Collected by Driver 1 (Yassine)
    const [order1] = await db
      .insert(orders)
      .values({
        orderNumber: "SE-1001",
        customerId: customer1.id,
        shopId: shopSouk.id,
        driverId: driver1.id,
        zoneId: zoneTalborjt.id,
        status: "delivered",
        idempotencyKey: "seed-order-1001",
        subtotalMad: 110,
        deliveryFeeMad: 12,
        discountMad: 10,
        totalMad: 112,
        commissionMad: 13,
        partnerPayoutMad: 97,
        driverEarningMad: 10,
        promoCode: "SOUK10",
        deliveryAddressSnapshot:
          "Imm. Atlas, Appt 8, Avenue Hassan II, Talborjt",
        deliveryZoneSnapshot: "Talborjt (Centre-Ville)",
        deliveryLandmarkSnapshot: "En face du Jardin Olhão",
        customerNameSnapshot: customer1.fullName,
        customerPhoneSnapshot: customer1.phone,
        shopNameSnapshot: shopSouk.nameFr,
        shopAddressSnapshot: shopSouk.address,
        shopPhoneSnapshot: shopSouk.phone,
        orderNotes: "Appeler à l'arrivée svp",
        paymentMethod: "COD",
        paymentStatus: "cash_collected",
        deliveredAt: new Date(Date.now() - 1000 * 60 * 45),
      })
      .returning();

    await db.insert(orderItems).values([
      {
        orderId: order1!.id,
        productId: prodAmlou.id,
        productNameFrSnapshot: prodAmlou.nameFr,
        productNameArSnapshot: prodAmlou.nameAr,
        unitPriceMadSnapshot: 110,
        quantity: 1,
        lineTotalMad: 110,
      },
    ]);

    await db.insert(driverAssignments).values({
      orderId: order1!.id,
      driverId: driver1.id,
      assignedByAdminId: adminUser.id,
      status: "delivered",
      acknowledgedAt: new Date(Date.now() - 1000 * 60 * 75),
      pickedUpAt: new Date(Date.now() - 1000 * 60 * 60),
      onTheWayAt: new Date(Date.now() - 1000 * 60 * 55),
      deliveredAt: new Date(Date.now() - 1000 * 60 * 45),
    });

    await db.insert(codRecords).values({
      orderId: order1!.id,
      driverId: driver1.id,
      expectedAmountMad: 112,
      collectedAmountMad: 112,
      driverEarningMad: 10,
      status: "collected",
      collectedAt: new Date(Date.now() - 1000 * 60 * 45),
      notes: "Espèces encaissées sans problème",
    });

    // Order 2: On the Way (Assigned to Driver 1 Yassine)
    const [order2] = await db
      .insert(orders)
      .values({
        orderNumber: "SE-1002",
        customerId: customer1.id,
        shopId: shopTajine.id,
        driverId: driver1.id,
        zoneId: zoneTalborjt.id,
        status: "on_the_way",
        idempotencyKey: "seed-order-1002",
        subtotalMad: 135,
        deliveryFeeMad: 12,
        discountMad: 0,
        totalMad: 147,
        commissionMad: 20,
        partnerPayoutMad: 115,
        driverEarningMad: 10,
        deliveryAddressSnapshot:
          "Imm. Atlas, Appt 8, Avenue Hassan II, Talborjt",
        deliveryZoneSnapshot: "Talborjt (Centre-Ville)",
        deliveryLandmarkSnapshot: "En face du Jardin Olhão",
        customerNameSnapshot: customer1.fullName,
        customerPhoneSnapshot: customer1.phone,
        shopNameSnapshot: shopTajine.nameFr,
        shopAddressSnapshot: shopTajine.address,
        shopPhoneSnapshot: shopTajine.phone,
        orderNotes: "Pain Tafarnout bien chaud svp",
        paymentMethod: "COD",
        paymentStatus: "unpaid_cod",
      })
      .returning();

    await db.insert(orderItems).values([
      {
        orderId: order2!.id,
        productId: prodTajineBoeuf.id,
        productNameFrSnapshot: prodTajineBoeuf.nameFr,
        productNameArSnapshot: prodTajineBoeuf.nameAr,
        unitPriceMadSnapshot: 65,
        quantity: 1,
        lineTotalMad: 65,
      },
      {
        orderId: order2!.id,
        productId: prodTajinePoulet.id,
        productNameFrSnapshot: prodTajinePoulet.nameFr,
        productNameArSnapshot: prodTajinePoulet.nameAr,
        unitPriceMadSnapshot: 55,
        quantity: 1,
        lineTotalMad: 55,
      },
      {
        orderId: order2!.id,
        productId: prodThe.id,
        productNameFrSnapshot: prodThe.nameFr,
        productNameArSnapshot: prodThe.nameAr,
        unitPriceMadSnapshot: 15,
        quantity: 1,
        lineTotalMad: 15,
      },
    ]);

    await db.insert(driverAssignments).values({
      orderId: order2!.id,
      driverId: driver1.id,
      assignedByAdminId: adminUser.id,
      status: "on_the_way",
      acknowledgedAt: new Date(Date.now() - 1000 * 60 * 25),
      pickedUpAt: new Date(Date.now() - 1000 * 60 * 12),
      onTheWayAt: new Date(Date.now() - 1000 * 60 * 10),
    });

    await db.insert(codRecords).values({
      orderId: order2!.id,
      driverId: driver1.id,
      expectedAmountMad: 147,
      collectedAmountMad: 0,
      driverEarningMad: 10,
      status: "pending",
    });

    // Order 3: Assigned to Driver 2 (Karim Bensaid) in Hay Dakhla
    const [order3] = await db
      .insert(orders)
      .values({
        orderNumber: "SE-1003",
        customerId: customer2.id,
        shopId: shopTacos.id,
        driverId: driver2.id,
        zoneId: zoneDakhla.id,
        status: "assigned",
        idempotencyKey: "seed-order-1003",
        subtotalMad: 100,
        deliveryFeeMad: 15,
        discountMad: 0,
        totalMad: 115,
        commissionMad: 15,
        partnerPayoutMad: 85,
        driverEarningMad: 12,
        deliveryAddressSnapshot: "Rue 402, Imm. B, Appt 3, Hay Dakhla",
        deliveryZoneSnapshot: "Hay Dakhla (Université)",
        deliveryLandmarkSnapshot: "À côté de la Faculté Ibn Zohr",
        customerNameSnapshot: customer2.fullName,
        customerPhoneSnapshot: customer2.phone,
        shopNameSnapshot: shopTacos.nameFr,
        shopAddressSnapshot: shopTacos.address,
        shopPhoneSnapshot: shopTacos.phone,
        orderNotes: "Sauce algérienne supplémentaire",
        paymentMethod: "COD",
        paymentStatus: "unpaid_cod",
      })
      .returning();

    await db.insert(orderItems).values([
      {
        orderId: order3!.id,
        productId: prodTacos.id,
        productNameFrSnapshot: prodTacos.nameFr,
        productNameArSnapshot: prodTacos.nameAr,
        unitPriceMadSnapshot: 48,
        quantity: 1,
        lineTotalMad: 48,
      },
      {
        orderId: order3!.id,
        productId: prodBurger.id,
        productNameFrSnapshot: prodBurger.nameFr,
        productNameArSnapshot: prodBurger.nameAr,
        unitPriceMadSnapshot: 52,
        quantity: 1,
        lineTotalMad: 52,
      },
    ]);

    await db.insert(driverAssignments).values({
      orderId: order3!.id,
      driverId: driver2.id,
      assignedByAdminId: adminUser.id,
      status: "assigned",
    });

    await db.insert(codRecords).values({
      orderId: order3!.id,
      driverId: driver2.id,
      expectedAmountMad: 115,
      collectedAmountMad: 0,
      driverEarningMad: 12,
      status: "pending",
    });

    // Order 4: Preparing by Partner (Awaiting Admin manual driver assignment!)
    const [order4] = await db
      .insert(orders)
      .values({
        orderNumber: "SE-1004",
        customerId: customer1.id,
        shopId: shopTajine.id,
        driverId: null,
        zoneId: zoneTalborjt.id,
        status: "preparing",
        idempotencyKey: "seed-order-1004",
        subtotalMad: 75,
        deliveryFeeMad: 12,
        discountMad: 0,
        totalMad: 87,
        commissionMad: 11,
        partnerPayoutMad: 64,
        driverEarningMad: 10,
        deliveryAddressSnapshot:
          "Imm. Atlas, Appt 8, Avenue Hassan II, Talborjt",
        deliveryZoneSnapshot: "Talborjt (Centre-Ville)",
        deliveryLandmarkSnapshot: "En face du Jardin Olhão",
        customerNameSnapshot: customer1.fullName,
        customerPhoneSnapshot: customer1.phone,
        shopNameSnapshot: shopTajine.nameFr,
        shopAddressSnapshot: shopTajine.address,
        shopPhoneSnapshot: shopTajine.phone,
        orderNotes: "Sans oignons dans la salade svp",
        paymentMethod: "COD",
        paymentStatus: "unpaid_cod",
      })
      .returning();

    await db.insert(orderItems).values([
      {
        orderId: order4!.id,
        productId: prodGrillades.id,
        productNameFrSnapshot: prodGrillades.nameFr,
        productNameArSnapshot: prodGrillades.nameAr,
        unitPriceMadSnapshot: 75,
        quantity: 1,
        lineTotalMad: 75,
      },
    ]);

    // Order 5: Pending Partner confirmation
    const [order5] = await db
      .insert(orders)
      .values({
        orderNumber: "SE-1005",
        customerId: customer2.id,
        shopId: shopTajine.id,
        driverId: null,
        zoneId: zoneDakhla.id,
        status: "pending",
        idempotencyKey: "seed-order-1005",
        subtotalMad: 120,
        deliveryFeeMad: 15,
        discountMad: 15,
        totalMad: 120,
        commissionMad: 18,
        partnerPayoutMad: 102,
        driverEarningMad: 12,
        promoCode: "BIENVENUE15",
        deliveryAddressSnapshot: "Rue 402, Imm. B, Appt 3, Hay Dakhla",
        deliveryZoneSnapshot: "Hay Dakhla (Université)",
        deliveryLandmarkSnapshot: "À côté de la Faculté Ibn Zohr",
        customerNameSnapshot: customer2.fullName,
        customerPhoneSnapshot: customer2.phone,
        shopNameSnapshot: shopTajine.nameFr,
        shopAddressSnapshot: shopTajine.address,
        shopPhoneSnapshot: shopTajine.phone,
        orderNotes: "Merci d'ajouter des olives rouges",
        paymentMethod: "COD",
        paymentStatus: "unpaid_cod",
      })
      .returning();

    await db.insert(orderItems).values([
      {
        orderId: order5!.id,
        productId: prodTajineBoeuf.id,
        productNameFrSnapshot: prodTajineBoeuf.nameFr,
        productNameArSnapshot: prodTajineBoeuf.nameAr,
        unitPriceMadSnapshot: 65,
        quantity: 1,
        lineTotalMad: 65,
      },
      {
        orderId: order5!.id,
        productId: prodTajinePoulet.id,
        productNameFrSnapshot: prodTajinePoulet.nameFr,
        productNameArSnapshot: prodTajinePoulet.nameAr,
        unitPriceMadSnapshot: 55,
        quantity: 1,
        lineTotalMad: 55,
      },
    ]);
  } finally {
    isSeeding = false;
  }
}
