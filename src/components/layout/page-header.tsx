export default function PageHeader({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}) {
  return <div className="page-header">
    <div className="eyebrow"><span className="line" />{eyebrow}</div>
    <div className="page-header-row">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  </div>;
}
