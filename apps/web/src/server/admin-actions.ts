"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const s = await auth();
  if (s?.user.roleCode !== "Administrator") throw new Error("forbidden");
  return s;
}

function required(v: FormData, k: string): string {
  const raw = v.get(k);
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) throw new Error(`This field is required: ${k}`);
  return s;
}

function optional(v: FormData, k: string): string | null {
  const raw = v.get(k);
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || null;
}

export async function createUserAction(fd: FormData) {
  const s = await requireAdmin();
  const fullName = required(fd, "fullName");
  const email    = required(fd, "email").toLowerCase();
  const roleId   = Number(required(fd, "roleId"));
  const password = required(fd, "password");
  const uid      = optional(fd, "uid");
  const mobile   = optional(fd, "mobile");
  const jobTitle = optional(fd, "jobTitle");

  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const hash = await bcrypt.hash(password, 10);
  await db.insert(schema.users).values({
    oidcSub:      `local:${email}`,
    uid,
    fullName,
    email,
    mobile,
    jobTitle,
    roleId,
    isActive:     true,
    passwordHash: hash,
  });

  await db.insert(schema.auditLog).values({
    eventType: "user.create",
    actorUserId: s.user.id,
    targetEntity: "user",
    afterValue: { fullName, email, roleId },
    outcome: "success",
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserAction(userId: string, fd: FormData) {
  const s = await requireAdmin();
  const fullName = required(fd, "fullName");
  const email    = required(fd, "email").toLowerCase();
  const roleId   = Number(required(fd, "roleId"));
  const uid      = optional(fd, "uid");
  const mobile   = optional(fd, "mobile");
  const jobTitle = optional(fd, "jobTitle");
  const isActive = fd.get("isActive") === "on";
  const newPassword = optional(fd, "password");

  const patch: Record<string, unknown> = {
    fullName, email, roleId, uid, mobile, jobTitle, isActive,
    updatedAt: new Date(),
  };
  if (newPassword) {
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
    patch.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await db.update(schema.users).set(patch).where(eq(schema.users.id, userId));

  await db.insert(schema.auditLog).values({
    eventType: "user.update",
    actorUserId: s.user.id,
    targetEntity: "user",
    targetId: userId,
    afterValue: { fullName, email, roleId, isActive },
    outcome: "success",
  });

  revalidatePath("/admin/users");
  redirect(`/admin/users/${userId}`);
}

export async function updateRoleAction(roleId: number, fd: FormData) {
  const s = await requireAdmin();
  const name        = required(fd, "name");
  const description = optional(fd, "description");
  const isActive    = fd.get("isActive") === "on";

  await db.update(schema.roles)
    .set({ name, description, isActive })
    .where(eq(schema.roles.id, roleId));

  await db.insert(schema.auditLog).values({
    eventType: "role.update",
    actorUserId: s.user.id,
    targetEntity: "role",
    afterValue: { id: roleId, name, description, isActive },
    outcome: "success",
  });

  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}

export async function updateFeatureFlagAction(key: string, fd: FormData) {
  const s = await requireAdmin();
  const isEnabled    = fd.get("isEnabled") === "on";
  const numeric      = optional(fd, "numericValue");
  const description  = optional(fd, "description");

  await db.update(schema.featureFlags)
    .set({
      isEnabled,
      numericValue: numeric !== null && numeric !== "" ? numeric : null,
      description,
      updatedAt: new Date(),
      updatedBy: s.user.id,
    })
    .where(eq(schema.featureFlags.key, key));

  await db.insert(schema.auditLog).values({
    eventType: "system_setting.update",
    actorUserId: s.user.id,
    targetEntity: "feature_flag",
    afterValue: { key, isEnabled, numericValue: numeric, description },
    outcome: "success",
  });

  revalidatePath("/admin/system-settings");
  redirect("/admin/system-settings");
}

export async function createProductAction(fd: FormData) {
  const s = await requireAdmin();
  const productCode = required(fd, "productCode");
  const productName = required(fd, "productName");
  const categoryId  = Number(required(fd, "categoryId"));
  const subCategoryRaw = optional(fd, "subCategoryId");
  const subCategoryId  = subCategoryRaw ? Number(subCategoryRaw) : null;
  const retailPrice = optional(fd, "retailPrice") ?? "0";
  const costPrice   = optional(fd, "costPrice");
  const defaultTaxPct = optional(fd, "defaultTaxPct") ?? "0";
  const description   = optional(fd, "description");

  await db.insert(schema.products).values({
    productCode,
    productName,
    categoryId,
    subCategoryId,
    retailPrice,
    costPrice,
    defaultTaxPct,
    description,
    isActive: true,
  });

  await db.insert(schema.auditLog).values({
    eventType: "product.create",
    actorUserId: s.user.id,
    targetEntity: "product",
    afterValue: { productCode, productName, categoryId },
    outcome: "success",
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

type PickListKind =
  | "organizationTypes" | "salutations" | "designations" | "rejectionReasons"
  | "productCategories" | "quotationTypes" | "fundSources";

export async function updatePickListAction(kind: PickListKind, id: number, fd: FormData) {
  const s = await requireAdmin();
  const name     = required(fd, "name");
  const isActive = fd.get("isActive") === "on";

  const table =
    kind === "organizationTypes" ? schema.organizationTypes :
    kind === "salutations"       ? schema.salutations :
    kind === "designations"      ? schema.designations :
    kind === "rejectionReasons"  ? schema.rejectionReasons :
    kind === "productCategories" ? schema.productCategories :
    kind === "quotationTypes"    ? schema.quotationTypes :
    kind === "fundSources"       ? schema.fundSources : null;
  if (!table) throw new Error("unknown pick list");

  // fundSources has no isActive column — guard it.
  if (kind === "fundSources") {
    await db.update(schema.fundSources).set({ name }).where(eq(schema.fundSources.id, id));
  } else {
    await (db.update(table as any).set({ name, isActive }) as any).where(eq((table as any).id, id));
  }

  await db.insert(schema.auditLog).values({
    eventType: "picklist.update",
    actorUserId: s.user.id,
    targetEntity: `picklist.${kind}`,
    afterValue: { id, name, isActive },
    outcome: "success",
  });

  revalidatePath(`/admin/pick-lists/${kind}`);
  redirect(`/admin/pick-lists/${kind}`);
}
