export const reportForm = {
  title: "Start a new briefing",
  submitLabel: "Run agent",
  fields: [
    { name: "company", label: "Company", type: "text", maxLength: 120 },
    { name: "notes", label: "Source notes", type: "textarea", maxLength: 12000 },
  ],
} as const;
export type ReportForm = typeof reportForm;
