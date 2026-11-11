import type { ServiceCategory, Ticket } from "@/lib/types";

export type ServiceDepartmentConfig = {
  slug: string;
  name: string;
  categorySource: "ccg-request" | "service-category" | "combined";
  categories: Array<{ value: string; label: string }>;
  showResponseMetrics: boolean;
};

const serviceCategories: Array<{ value: ServiceCategory; label: string }> = [
  { value: "hardware", label: "Hardware" },
  { value: "software", label: "Software" },
  { value: "network", label: "Network" },
  { value: "microsoft", label: "Microsoft" },
  { value: "security", label: "Security" },
  { value: "other_services", label: "Other services" }
];

const ccgCategories = [
  { value: "unit_rate", label: "Unit rate" },
  { value: "vendor_list", label: "Vendor list" },
  { value: "tor_contracts", label: "TOR / contracts" }
];

export const serviceDepartmentConfigs: Record<string, ServiceDepartmentConfig> = {
  "cost-control": {
    slug: "cost-control",
    name: "CCG",
    categorySource: "ccg-request",
    categories: ccgCategories,
    showResponseMetrics: false
  },
  "it-support": {
    slug: "it-support",
    name: "IT Support",
    categorySource: "service-category",
    categories: serviceCategories,
    showResponseMetrics: true
  },
  "software-csr": {
    slug: "software-csr",
    name: "Software CSR",
    categorySource: "service-category",
    categories: [{ value: "software", label: "Software" }],
    showResponseMetrics: true
  }
};

export const allDepartmentsConfig: ServiceDepartmentConfig = {
  slug: "all",
  name: "All departments",
  categorySource: "combined",
  categories: [...serviceCategories, ...ccgCategories],
  showResponseMetrics: true
};

export function getServiceDepartmentConfig(
  slug: string | null | undefined,
  name: string | null | undefined
): ServiceDepartmentConfig {
  if (slug && serviceDepartmentConfigs[slug]) {
    return serviceDepartmentConfigs[slug];
  }

  return {
    slug: slug ?? "service-team",
    name: name ?? "Service team",
    categorySource: "service-category",
    categories: serviceCategories,
    showResponseMetrics: true
  };
}

export function getServiceTicketCategory(
  ticket: Ticket,
  department: ServiceDepartmentConfig
) {
  return getServiceTicketCategories(ticket, department)[0]
    ?? { value: "", label: "Uncategorized" };
}

export function getServiceTicketCategories(
  ticket: Ticket,
  department: ServiceDepartmentConfig
) {
  const isCcgTicket = department.categorySource === "ccg-request"
    || (department.categorySource === "combined" && Boolean(ticket.ccg_request_type));
  const values = isCcgTicket
    ? ticket.ccg_request_types?.length
      ? ticket.ccg_request_types
      : ticket.ccg_request_type ? [ticket.ccg_request_type] : []
    : ticket.service_category ? [ticket.service_category] : [];

  const categories = values.flatMap((value) => {
    const category = department.categories.find((item) => item.value === value);
    return category ? [category] : [];
  });
  return categories.length ? categories : [{ value: "", label: "Uncategorized" }];
}
