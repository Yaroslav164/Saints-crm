import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StagePlaceholder({
  title,
  description,
  stage,
  items,
}: {
  title: string;
  description: string;
  stage: string;
  items: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="rounded-xl border-slate-800 bg-slate-900">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">Planned for {stage}</CardTitle>
          <CardDescription className="text-xs">
            The app shell, dashboard and data layer are already wired for this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
