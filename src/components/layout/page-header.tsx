export default function PageHeader({ eyebrow, title, description, action, headingLevel = 1 }: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return <div className="page-header">
    <div className="eyebrow"><span className="line" />{eyebrow}</div>
    <div className="page-header-row">
      <div>
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  </div>;
}
