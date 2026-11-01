import { Card } from "@/components/ui/card";

const ACCOUNTS = [
  { email: "admin@saints.com", role: "Admin" },
  { email: "ivanov@saints.com", role: "Buyer" },
  { email: "petrov@saints.com", role: "Buyer" },
  { email: "sidorov@saints.com", role: "Buyer" },
];

/** Seed accounts (prisma/seed.ts) so the demo can be opened without typing. */
export function DemoAccounts() {
  return (
    <Card className="bg-muted/40 p-4">
      <p className="text-xs font-medium text-muted-foreground">
        Demo accounts — password <span className="font-mono text-foreground">saints2026</span>
      </p>
      <ul className="mt-2 space-y-1">
        {ACCOUNTS.map((account) => (
          <li key={account.email} className="flex items-center justify-between gap-3 text-xs">
            <span className="font-mono text-foreground/80">{account.email}</span>
            <span className="text-muted-foreground">{account.role}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
