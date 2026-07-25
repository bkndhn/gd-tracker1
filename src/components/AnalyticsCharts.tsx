import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, Tooltip } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';

interface GDEntry {
  id: string;
  created_at: string;
  shop_id: string;
  notes: string;
  shops: { name: string } | null;
  categories: { name: string } | null;
  sizes: { size: string } | null;
  customer_types: { name: string } | null;
}


interface AnalyticsChartsProps {
  entries: GDEntry[];
}

// Color palette for charts using CSS variables where possible
const COLORS = [
  'hsl(221, 83%, 53%)', // blue
  'hsl(262, 83%, 58%)', // purple
  'hsl(330, 81%, 60%)', // pink
  'hsl(142, 71%, 45%)', // green
  'hsl(38, 92%, 50%)',  // orange
  'hsl(0, 72%, 51%)',   // red
  'hsl(199, 89%, 48%)', // cyan
  'hsl(47, 96%, 53%)',  // yellow
];

export const AnalyticsCharts = ({ entries }: AnalyticsChartsProps) => {
  // Prepare data for charts
  const chartData = useMemo(() => {
    // By Shop
    const byShop: Record<string, number> = {};
    // By Category
    const byCategory: Record<string, number> = {};
    // By Day (last 7 days)
    const byDay: Record<string, number> = {};
    
    const now = new Date();
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      last7Days.push(key);
      byDay[key] = 0;
    }
    
    entries.forEach(entry => {
      const shopName = entry.shops?.name || 'Unknown';
      const categoryName = entry.categories?.name || 'Unknown';
      const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
      
      byShop[shopName] = (byShop[shopName] || 0) + 1;
      byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;
      
      if (byDay[entryDate] !== undefined) {
        byDay[entryDate] = (byDay[entryDate] || 0) + 1;
      }
    });
    
    const shopData = Object.entries(byShop)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    
    const categoryData = Object.entries(byCategory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    
    const trendData = last7Days.map(date => {
      const d = new Date(date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      return {
        date: dayName,
        fullDate: date,
        count: byDay[date] || 0
      };
    });
    
    return { shopData, categoryData, trendData };
  }, [entries]);

  const shopChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    chartData.shopData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length]
      };
    });
    return config;
  }, [chartData.shopData]);

  const categoryChartConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    chartData.categoryData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length]
      };
    });
    return config;
  }, [chartData.categoryData]);

  if (entries.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">No data available for analytics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Weekly Trend Line Chart */}
      <Card className="xl:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Weekly GD Trend
          </CardTitle>
          <CardDescription>Last 7 days entry count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{payload[0].payload.fullDate}</p>
                          <p className="text-sm text-muted-foreground">
                            Entries: <span className="font-bold text-primary">{payload[0].value}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(221, 83%, 53%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(221, 83%, 53%)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By Shop Bar Chart */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            By Shop
          </CardTitle>
          <CardDescription>Top shops by entry count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData.shopData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11 }}
                  width={80}
                  tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{payload[0].payload.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Entries: <span className="font-bold text-primary">{payload[0].value}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(221, 83%, 53%)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By Category Pie Chart */}
      <Card className="lg:col-span-1 xl:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-4 w-4" />
            By Category
          </CardTitle>
          <CardDescription>Distribution of entries by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="name"
                  label={({ name, percent }) => 
                    `${name.length > 8 ? name.slice(0, 8) + '...' : name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {chartData.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{payload[0].name}</p>
                          <p className="text-sm text-muted-foreground">
                            Entries: <span className="font-bold text-primary">{payload[0].value}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
