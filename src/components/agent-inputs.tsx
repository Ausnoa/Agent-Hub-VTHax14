import type { ReportForm } from "../lib/contracts/ui";

export default function AgentInputs({ schema, values, onChange }: {
  schema: ReportForm;
  values: { company: string; notes: string };
  onChange: (name: "company" | "notes", value: string) => void;
}) {
  return <>
    <h2>{schema.title}</h2>
    {schema.fields.map((field) => <div key={field.name}>
      <label htmlFor={field.name}>{field.label}</label>
      {field.type === "textarea"
        ? <textarea id={field.name} rows={8} value={values[field.name]} maxLength={field.maxLength} onChange={(event) => onChange(field.name, event.target.value)} />
        : <input id={field.name} value={values[field.name]} maxLength={field.maxLength} onChange={(event) => onChange(field.name, event.target.value)} />}
    </div>)}
  </>;
}
