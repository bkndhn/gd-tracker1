import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, CheckCircle2, MessageCircle, TrendingUp, Store } from "lucide-react";

const stats = [
  { label: "Requests", value: 128, icon: Package, tone: "bg-primary/15 text-primary" },
  { label: "Packed", value: 96, icon: CheckCircle2, tone: "bg-accent/30 text-accent-foreground" },
  { label: "Moved", value: 74, icon: Truck, tone: "bg-secondary text-secondary-foreground" },
  { label: "Lost sales", value: 31, icon: TrendingUp, tone: "bg-destructive/15 text-destructive" },
];

const chats = [
  { from: "admin", text: "Anna Nagar shop — size 42 stock moved today." },
  { from: "shop", text: "Received, thanks! Need 6 more of size 40." },
  { from: "admin", text: "Packing now, will dispatch by 4 PM." },
];

export default function UiSamples() {
  return (
    <main className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 bg-gradient-to-r from-primary to-accent px-4 py-5 text-primary-foreground shadow-lg">
        <p className="text-xs opacity-80">Sample screens</p>
        <h1 className="text-2xl font-bold">Modern UI preview</h1>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="rounded-2xl p-4 transition active:scale-[0.98]">
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl p-4">
            <h2 className="mb-3 text-lg font-semibold">Request queue</h2>
            {["Size 42 × 6", "Size 40 × 4", "Size 38 × 10"].map((r, i) => (
              <div key={r} className="flex min-h-[56px] items-center justify-between border-b py-2 last:border-0">
                <div className="flex items-center gap-3">
                  <Store className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{r}</p>
                    <p className="text-xs text-muted-foreground">Shop {i + 1} · 10 min ago</p>
                  </div>
                </div>
                <Button size="lg" className="h-11 rounded-xl">Pack</Button>
              </div>
            ))}
          </Card>

          <Card className="flex flex-col rounded-2xl p-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <MessageCircle className="h-5 w-5 text-primary" /> Team chat <Badge variant="secondary">Sample</Badge>
            </h2>
            <div className="flex-1 space-y-2">
              {chats.map((c, i) => (
                <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${c.from === "admin" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {c.text}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input className="h-12 flex-1 rounded-full border bg-background px-4" placeholder="Type a message" />
              <Button size="lg" className="h-12 rounded-full px-6">Send</Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
