"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CHART_PALETTE,
  colorForSubmissionStatus,
} from "@/components/setup/chart-colors";

type CategoryDatum = { categoryId: string; name: string; count: number };

export function DashboardCharts({
  submissionsByStatus,
  submissionsByCategory,
}: {
  submissionsByStatus: Record<string, number>;
  submissionsByCategory: CategoryDatum[];
}) {
  const statusData = Object.entries(submissionsByStatus).map(
    ([name, count]) => ({ name, count }),
  );
  const categoryData = submissionsByCategory.map((row) => ({
    name: row.name,
    count: row.count,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Submissions by status</CardTitle>
          <CardDescription>Current abstract pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          {statusData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No submission data yet.
            </p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={48}
                    paddingAngle={2}
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={colorForSubmissionStatus(entry.name, index)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value ?? 0, "Count"]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(214 20% 90%)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submissions by category</CardTitle>
          <CardDescription>Volume per category</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No category breakdown yet.
            </p>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ left: 0, right: 8 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(214 20% 90%)",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {categoryData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
