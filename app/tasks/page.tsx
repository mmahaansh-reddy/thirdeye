"use client";

import { useState } from "react";
import { actions, useDB } from "@/lib/store";
import { AUTOMATION_RULES, isOverdue } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityLink, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";

export default function TasksPage() {
  const db = useDB();
  const { error, run } = useAction();
  const [filter, setFilter] = useState<"open" | "overdue" | "all">("open");
  const [assignee, setAssignee] = useState("all");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [who, setWho] = useState("");
  if (!db) return <Loading />;

  const label = (ruleId: string) => AUTOMATION_RULES.find((r) => r.id === ruleId)?.label ?? "Manual";
  const rows = db.tasks
    .filter((t) => (filter === "all" ? true : filter === "overdue" ? isOverdue(t) : t.status === "open"))
    .filter((t) => assignee === "all" || t.assigneeId === assignee)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Created automatically from deadlines on every lead, request, quote, booking and change request. They close themselves when the underlying step happens."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect className="w-40" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="all">All (incl. closed)</option>
        </NativeSelect>
        <NativeSelect className="w-52" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">Everyone</option>
          {db.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ErrorText error={error} />
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{label(t.ruleId)}</TableCell>
                  <TableCell>{t.ruleId === "manual" ? "—" : <EntityLink db={db} type={t.entityType} id={t.entityId} />}</TableCell>
                  <TableCell>{userName(db, t.assigneeId)}</TableCell>
                  <TableCell className={isOverdue(t) ? "text-destructive font-medium" : ""}>{formatDate(t.dueAt)}</TableCell>
                  <TableCell>
                    {isOverdue(t) ? (
                      <Badge variant="destructive">overdue</Badge>
                    ) : (
                      <Badge variant={t.status === "open" ? "warning" : "secondary"}>{t.status.replace("_", " ")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => run(actions.completeTask(t.id))}>
                        Done
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                    Nothing here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Manual task</CardTitle>
          <CardDescription>For anything the automatic rules don&apos;t cover.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <Field label="Title">
            <Input className="w-72" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Assignee">
            <NativeSelect className="w-48" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Select</option>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Due">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Button
            onClick={() => {
              if (!title.trim() || !who || !due) return run({ ok: false, error: "Title, assignee and due date are required" });
              run(actions.addTask(title.trim(), who, new Date(due).toISOString()), () => {
                setTitle("");
                setDue("");
              });
            }}
          >
            Add task
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
