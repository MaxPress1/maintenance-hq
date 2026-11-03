import { z } from "zod";

export const WORK_TYPES = [
  "planned",
  "emergency",
  "unplanned",
  "preventive",
  "damage_recovery",
  "improvement",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  planned: "Планова",
  emergency: "Аварійна",
  unplanned: "Позапланова",
  preventive: "Профілактична",
  damage_recovery: "Відновлення після пошкодження",
  improvement: "Покращення",
};

export const WORK_ORDER_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  critical: "Критичний",
  high: "Високий",
  medium: "Середній",
  low: "Низький",
};

export const WORK_ORDER_STATUSES = [
  "new",
  "estimating",
  "pending_approval",
  "scheduled",
  "in_progress",
  "waiting_materials",
  "waiting_contractor",
  "review",
  "completed",
  "canceled",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  new: "Нова заявка",
  estimating: "На оцінці",
  pending_approval: "Очікує погодження",
  scheduled: "Запланована",
  in_progress: "У роботі",
  waiting_materials: "Очікує матеріалів",
  waiting_contractor: "Очікує зовнішнього виконавця",
  review: "На перевірці",
  completed: "Завершена",
  canceled: "Скасована",
};

export const REPORTED_URGENCIES = ["critical", "high", "medium", "low", "unknown"] as const;
export type ReportedUrgency = (typeof REPORTED_URGENCIES)[number];

export const REPORTED_URGENCY_LABELS: Record<ReportedUrgency, string> = {
  critical: "Аварійна / Термінова",
  high: "Висока",
  medium: "Звичайна",
  low: "Низька",
  unknown: "Не вказано",
};

export const ATTACHMENT_PHASES = ["before", "during", "after", "general"] as const;
export type AttachmentPhase = (typeof ATTACHMENT_PHASES)[number];

export const ATTACHMENT_PHASE_LABELS: Record<AttachmentPhase, string> = {
  before: "До ремонту",
  during: "Під час робіт",
  after: "Після ремонту",
  general: "Загальне",
};

export interface WorkOrder {
  id: string;
  number: number;
  title: string;
  description: string;
  asset_id: string;
  work_type: WorkType;
  reported_urgency: ReportedUrgency;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  author_id: string | null;
  source: "internal" | "public";
  responsible_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  deadline: string | null;
  actual_start_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_result: string;
  planned_cost: number;
  approved_budget: number;
  actual_cost: number;
  version: number;
  created_at: string;
  updated_at: string;
  asset?: { id: string; name: string; type: string; site_id: string; site?: { name: string } };
  responsible?: { id: string; display_name: string };
  author?: { id: string; display_name: string };
  completed_by_profile?: { id: string; display_name: string };
  assignments?: { user_id: string; user?: { id: string; display_name: string } }[];
}

export interface WorkOrderComment {
  id: string;
  work_order_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: { display_name: string };
}

export interface Attachment {
  id: string;
  record_type: "asset" | "work_order" | "finance";
  record_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  phase: AttachmentPhase;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { display_name: string };
}

// Status transitions state machine
export const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  new: ["estimating", "pending_approval", "scheduled", "in_progress", "canceled"],
  estimating: ["pending_approval", "scheduled", "in_progress", "canceled"],
  pending_approval: ["scheduled", "in_progress", "canceled"],
  scheduled: ["in_progress", "waiting_materials", "waiting_contractor", "canceled"],
  in_progress: ["waiting_materials", "waiting_contractor", "review", "completed", "canceled"],
  waiting_materials: ["in_progress", "review", "canceled"],
  waiting_contractor: ["in_progress", "review", "canceled"],
  review: ["completed", "in_progress", "canceled"],
  completed: ["in_progress"], // Reopening allowed by coordinator
  canceled: ["new"], // Reopening allowed
};

export const ACTIVE_STATUSES: readonly WorkOrderStatus[] = [
  "scheduled",
  "in_progress",
  "waiting_materials",
  "waiting_contractor",
  "review",
  "completed",
];

export function canTransitionWorkOrder(
  currentStatus: WorkOrderStatus,
  targetStatus: WorkOrderStatus,
  userRoles: string[],
  isResponsibleOrAssigned: boolean,
  hasResponsible: boolean
): { allowed: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowedTargets.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Перехід зі статусу "${WORK_ORDER_STATUS_LABELS[currentStatus]}" у статус "${WORK_ORDER_STATUS_LABELS[targetStatus]}" недозволений.`,
    };
  }

  const isCoordinator = userRoles.includes("administrator") || userRoles.includes("coordinator");
  const isWorker = userRoles.includes("worker");

  if (!isCoordinator && !isWorker) {
    return { allowed: false, reason: "Недостатньо прав для зміни статусу заявки." };
  }

  // Active statuses require responsible
  if (ACTIVE_STATUSES.includes(targetStatus) && !hasResponsible) {
    return {
      allowed: false,
      reason: "Для переведення в активний статус обов'язково має бути призначений відповідальний.",
    };
  }

  // Worker-specific transition limits
  if (!isCoordinator && isWorker) {
    if (!isResponsibleOrAssigned) {
      return { allowed: false, reason: "Виконавець може змінювати статус лише призначених йому робіт." };
    }

    // Workers can only trigger execution-related transitions
    const workerAllowedFromTo: [WorkOrderStatus, WorkOrderStatus][] = [
      ["scheduled", "in_progress"],
      ["in_progress", "waiting_materials"],
      ["in_progress", "waiting_contractor"],
      ["in_progress", "review"],
      ["waiting_materials", "in_progress"],
      ["waiting_contractor", "in_progress"],
      ["waiting_materials", "review"],
      ["waiting_contractor", "review"],
    ];

    const canDo = workerAllowedFromTo.some(
      ([from, to]) => from === currentStatus && to === targetStatus
    );

    if (!canDo) {
      return {
        allowed: false,
        reason: `Виконавець не має прав для переходу "${WORK_ORDER_STATUS_LABELS[currentStatus]}" → "${WORK_ORDER_STATUS_LABELS[targetStatus]}".`,
      };
    }
  }

  return { allowed: true };
}

// Validation schemas
export const workOrderCreateSchema = z.object({
  title: z.string().trim().min(1, "Вкажіть назву роботи").max(200, "Назва занадто довга"),
  description: z.string().trim().max(5000, "Опис занадто довгий").default(""),
  asset_id: z.string().uuid("Оберіть дійсний об'єкт"),
  work_type: z.enum(WORK_TYPES).default("unplanned"),
  reported_urgency: z.enum(REPORTED_URGENCIES).default("medium"),
  priority: z.enum(WORK_ORDER_PRIORITIES).default("medium"),
  responsible_id: z.string().uuid().nullable().optional().or(z.literal("")).transform((v) => v || null),
  planned_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Невірний формат дати").nullable().optional().or(z.literal("")).transform((v) => v || null),
  planned_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Невірний формат дати").nullable().optional().or(z.literal("")).transform((v) => v || null),
  deadline: z.string().datetime().nullable().optional().or(z.literal("")).transform((v) => v || null),
  planned_cost: z.coerce.number().min(0, "Планова вартість не може бути від'ємною").default(0),
}).refine(
  (data) => {
    if (data.planned_start_date && data.planned_end_date) {
      return data.planned_end_date >= data.planned_start_date;
    }
    return true;
  },
  { message: "Дата завершення не може бути раніше дати початку", path: ["planned_end_date"] }
);

export const emergencyReportSchema = z.object({
  asset_id: z.string().uuid("Оберіть об'єкт"),
  description: z.string().trim().min(3, "Опишіть проблему (мінімум 3 символи)").max(4000),
  reported_urgency: z.enum(["critical", "high", "medium", "low"]).default("critical"),
  contact: z.string().trim().max(200).optional().default(""),
});

export const publicReportSchema = z.object({
  token: z.string().min(10, "Недійсний токен"),
  description: z.string().trim().min(5, "Детально опишіть проблему (мінімум 5 символів)").max(4000),
  reported_urgency: z.enum(["critical", "high", "medium", "low"]).default("high"),
  contact_info: z.string().trim().max(200).optional().default(""),
});

export const workOrderCompleteSchema = z.object({
  completion_result: z.string().trim().min(1, "Вкажіть результат виконання робіт").max(4000),
  completed_at: z.string().datetime().default(() => new Date().toISOString()),
});

export const workOrderCommentSchema = z.object({
  work_order_id: z.string().uuid(),
  content: z.string().trim().min(1, "Коментар не може бути порожнім").max(4000, "Коментар занадто довгий"),
});
