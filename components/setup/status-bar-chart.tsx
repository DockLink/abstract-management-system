"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Horizontal bar chart for the event dashboard. Loaded lazily (next/dynamic). */
export default function StatusBarChart({ data }: { data: Array<{ label: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* The figure is aria-hidden (a visually hidden table carries the data), so
          turn off recharts' keyboard layer or it leaves a focusable hidden SVG. */}
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 36, bottom: 0, left: 0 }}
        barCategoryGap={12}
        accessibilityLayer={false}
      >
        <XAxis type="number" hide allowDecimals={false} domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="label" hide />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          formatter={(v) => [v ?? 0, "Abstracts"]}
          contentStyle={{
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
          }}
          labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
        />
        <Bar dataKey="count" fill="var(--brand-ink)" radius={[0, 4, 4, 0]} minPointSize={2} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" style={{ fill: "var(--foreground)", fontSize: 14, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
