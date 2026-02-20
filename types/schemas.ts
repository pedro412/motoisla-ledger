import { z } from "zod";

export const PurchaseImportSchema = z.object({
  supplier: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoiceRef: z.string().optional().default(""),
  subtotalNet: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  totalGross: z.number().nonnegative(),
  taxRate: z.number().default(0.16),
  rawText: z.string().min(10),
  defaultOwnerId: z.string().min(1),
});

export const SaleCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.enum(["STORE", "ONLINE", "OTHER"]),
  notes: z.string().optional().default(""),
  terminalPayment: z.boolean().default(false),
  threeMonthsNoInterest: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        lotId: z.string().min(1),
        sku: z.string().min(1),
        qty: z.number().positive(),
        unitPriceGross: z.number().nonnegative(),
        discountGross: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
});
