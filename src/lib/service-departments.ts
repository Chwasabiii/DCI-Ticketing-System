import type { ServiceCategory, Ticket } from "@/lib/types";

export type ServiceDepartmentConfig = {
  slug: string;
  name: string;
  categorySource: "ccg-request" | "service-category";
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

export const serviceDepartmentConfigs: Record<string, ServiceDepartmentConfig> = {
  "cost-control": {
    slug: "cost-control",
    name: "CCG",
    categorySource: "ccg-request",
    categories: [
      { value: "unit_rate", label: "Unit rate" },
      { value: "vendor_list", label: "Vendor list" },
      { value: "tor_contracts", label: "TOR / contracts" }
    ],
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
  const value = department.categorySource === "ccg-request"
    ? ticket.ccg_request_type
    : ticket.service_category;

  return department.categories.find((category) => category.value === value)
    ?? { value: "", label: "Uncategorized" };
}
