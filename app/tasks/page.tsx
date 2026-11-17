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
import type { DB, Task } from "@/lib/types";
import { DataList, type Column } from "@/components/data-list";
import { Empty, EntityLink, ErrorText, Field, Loading, PageHeader, useAction, userName } from "@/components/common";

function taskColumns(db: DB, label: (ruleId: string) => string, run: ReturnType<typeof useAction>["run"]): Column<Task>[] {
  return [
    {
      header: "Task",
      card: "title",
      cell: (t) => (
        <div>
          <div className="font-medium">{t.title}</div>
          <div className="text-muted-foreground text-xs">{label(t.ruleId)}</div>
        </div>
      ),
    },
    { header: "Record", stop: true, cell: (t) => (t.ruleId === "manual" ? "—" : <EntityLink db={db} type={t.entityType} id={t.entityId} />) },
    { header: "Assignee", cell: (t) => userName(db, t.assigneeId) },
    { header: "Due", cell: (t) => <span className={isOverdue(t) ? "text-destructive font-medium" : ""}>{formatDate(t.dueAt)}</span> },
    {
      header: "Status",
      cell: (t) =>
        isOverdue(t) ? <Badge variant="destructive">overdue</Badge> : <Badge variant={t.status === "open" ? "warning" : "secondary"}>{t.status.replace("_", " ")}</Badge>,
    },
    {
      header: "Action",
      stop: true,
      cell: (t) =>
        t.status === "open" ? (
          <Button size="sm" variant="outline" onClick={() => run(actions.completeTask(t.id))}>
            Done
          </Button>
        ) : null,
    },
  ];
}

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
      {rows.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <DataList rows={rows} columns={taskColumns(db, label, run)} rowKey={(t) => t.id} breakpoint="lg" />
      )}

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
