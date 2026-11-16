"use client";

import { useState } from "react";
import { actions, currentUser, useDB } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { AUTOMATION_RULES } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorText, Field, Loading, PageHeader, useAction } from "@/components/common";

const SLA_LABELS: Record<keyof Settings["sla"], string> = {
  firstContactHours: "First contact on a new lead",
  quoteHours: "First quote after request",
  quoteFollowUpHours: "Follow-up after quote sent",
  sellerAcceptHours: "Seller acceptance",
  confirmationHours: "Confirmation to customer",
  advancePaymentHours: "Advance payment after confirmation",
};

export default function SettingsPage() {
  const db = useDB();
  const { error, run } = useAction();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  if (!db) return <Loading />;
  const s = draft ?? db.settings;
  const isAdmin = currentUser(db).role === "admin";
  const patch = (p: Partial<Settings>) => {
    setSaved(false);
    setDraft({ ...s, ...p });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `thirdeye-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHeader title="Rules & settings" description={isAdmin ? "Changes are audited." : "Read-only: switch to the Admin user to change rules."} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pre-sales routing</CardTitle>
            <CardDescription>Exactly one role may hand requests to pre-sales. Everyone else is blocked, and the attempt is logged.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Role allowed to route">
              <NativeSelect
                disabled={!isAdmin}
                value={s.presalesRoutingRole}
                onChange={(e) => patch({ presalesRoutingRole: e.target.value as Settings["presalesRoutingRole"] })}
              >
                <option value="sales">Sales</option>
                <option value="seller">Seller</option>
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Advance required (% of booking value)">
              <Input disabled={!isAdmin} type="number" value={s.advancePct} onChange={(e) => patch({ advancePct: Number(e.target.value) })} />
            </Field>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Follow-up deadlines (hours)</CardTitle>
            <CardDescription>Automatic rules: {AUTOMATION_RULES.map((r) => r.label).join(" · ")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(SLA_LABELS) as (keyof Settings["sla"])[]).map((k) => (
              <Field key={k} label={SLA_LABELS[k]}>
                <Input
                  disabled={!isAdmin}
                  type="number"
                  min={1}
                  value={s.sla[k]}
                  onChange={(e) => patch({ sla: { ...s.sla, [k]: Number(e.target.value) } })}
                />
              </Field>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          disabled={!isAdmin || !draft}
          onClick={() =>
            run(actions.updateSettings({ presalesRoutingRole: s.presalesRoutingRole, sla: s.sla, advancePct: s.advancePct }), () => {
              setDraft(null);
              setSaved(true);
            })
          }
        >
          Save rules
        </Button>
        <Button variant="outline" onClick={exportData}>
          Export all data (JSON)
        </Button>
        {saved && <span className="text-success text-sm">Saved.</span>}
      </div>
      <div className="mt-2">
        <ErrorText error={error} />
      </div>
      <p className="text-muted-foreground mt-6 text-xs">
        Data is stored in this browser only (localStorage) until a database is connected. Export regularly if you are entering real data.
      </p>
    </>
  );
}
