import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Page provisoire de l'espace connecté, en attendant la phase qui la construit. */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">{title}</h1>
          </CardTitle>
          <CardDescription>Cette page sera disponible prochainement (phase {phase}).</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
