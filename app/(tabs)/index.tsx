import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Line, Text as SvgText, G } from "react-native-svg";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { getDashboardStats, getProductionByDateRange } from "@/lib/database";
import type { ProductionLog } from "@/lib/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 160;

type FilterOption = { label: string; weeks: number };
const FILTERS: FilterOption[] = [
  { label: "1 Week", weeks: 1 },
  { label: "2 Weeks", weeks: 2 },
  { label: "Monthly", weeks: 4 },
];

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const maxVal = Math.max(...data, 1);
  const barWidth = (CHART_WIDTH - 40) / Math.max(data.length, 1) - 8;
  const BAR_AREA_HEIGHT = CHART_HEIGHT - 30;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Line x1="30" y1="10" x2="30" y2={BAR_AREA_HEIGHT + 10} stroke={COLORS.cardBorder} strokeWidth="1" />
      <Line x1="30" y1={BAR_AREA_HEIGHT + 10} x2={CHART_WIDTH} y2={BAR_AREA_HEIGHT + 10} stroke={COLORS.cardBorder} strokeWidth="1" />
      {data.map((val, i) => {
        const barH = (val / maxVal) * BAR_AREA_HEIGHT;
        const x = 34 + i * (barWidth + 8);
        const y = 10 + BAR_AREA_HEIGHT - barH;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barH, 0)}
              fill={COLORS.machineColors[i % COLORS.machineColors.length]}
              rx={4}
            />
            <SvgText
              x={x + barWidth / 2}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              fill={COLORS.textSecondary}
              fontSize="9"
              fontFamily="Inter_400Regular"
            >
              {labels[i] || ""}
            </SvgText>
            {val > 0 && (
              <SvgText
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fill={COLORS.text}
                fontSize="10"
                fontFamily="Inter_600SemiBold"
              >
                {val}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

function useCurrentTime() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

type DashStats = Awaited<ReturnType<typeof getDashboardStats>>;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { isLoading, refreshAll } = useApp();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [filter, setFilter] = useState<FilterOption>(FILTERS[0]);
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const currentTime = useCurrentTime();

  const load = useCallback(async () => {
    const s = await getDashboardStats();
    setStats(s);
    const logs = await getProductionByDateRange(filter.weeks);
    buildChartData(logs, filter.weeks);
  }, [filter]);

  function buildChartData(logs: ProductionLog[], weeks: number) {
    const buckets: { [k: string]: number } = {};
    const now = new Date();
    if (weeks <= 2) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        buckets[key] = 0;
      }
      logs.forEach((l) => {
        const d = new Date(l.completedAt);
        const key = `${d.getDate()}/${d.getMonth() + 1}`;
        if (key in buckets) buckets[key] += l.quantity;
      });
    } else {
      for (let i = 3; i >= 0; i--) {
        const key = `Wk${4 - i}`;
        buckets[key] = 0;
      }
      logs.forEach((l) => {
        const d = new Date(l.completedAt);
        const diff = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000));
        const wk = 4 - Math.min(diff, 3);
        const key = `Wk${wk}`;
        if (key in buckets) buckets[key] += l.quantity;
      });
    }
    setChartLabels(Object.keys(buckets));
    setChartData(Object.values(buckets));
  }

  useEffect(() => {
    load();
  }, [load]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const today = new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  if (isLoading || !stats) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 16 }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const totalProd = stats.machineStats.reduce((s, m) => s + m.production, 0);
  const totalQC = stats.machineStats.reduce((s, m) => s + m.qc, 0);
  const totalSales = stats.machineStats.reduce((s, m) => s + m.sales, 0);
  const totalStock = stats.machineStats.reduce((s, m) => s + m.stock, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.company}>ProManage</Text>
          <Text style={styles.subtitle}>{today}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.clockBadge}>
            <Ionicons name="time-outline" size={12} color={COLORS.primaryLight} />
            <Text style={styles.clockText}>{currentTime}</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refreshAll}>
            <Ionicons name="refresh" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.summaryRow}>
          {[
            { label: "Production", value: totalProd, icon: "settings", color: COLORS.primary },
            { label: "QC Done", value: totalQC, icon: "shield-checkmark", color: COLORS.secondary },
            { label: "Sales", value: totalSales, icon: "cart", color: COLORS.warning },
            { label: "Stock", value: totalStock, icon: "cube", color: "#8B5CF6" },
          ].map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: item.color + "22" }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Production Trend</Text>
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.label}
                  style={[styles.filterBtn, filter.label === f.label && styles.filterBtnActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter.label === f.label && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {chartData.length > 0 ? (
            <BarChart data={chartData} labels={chartLabels} />
          ) : (
            <View style={styles.emptyChart}>
              <Ionicons name="bar-chart-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No production data yet</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Machine-wise Report</Text>
        {stats.machineStats.map((ms, idx) => (
          <View key={ms.machine.id} style={styles.machineCard}>
            <View style={styles.machineHeader}>
              <View style={[styles.machineIcon, { backgroundColor: COLORS.machineColors[idx] + "33" }]}>
                <Ionicons name="hardware-chip" size={18} color={COLORS.machineColors[idx]} />
              </View>
              <Text style={styles.machineName}>{ms.machine.name}</Text>
              <View style={[styles.machineBadge, { backgroundColor: COLORS.machineColors[idx] + "22" }]}>
                <Text style={[styles.machineBadgeText, { color: COLORS.machineColors[idx] }]}>
                  {ms.stock} in stock
                </Text>
              </View>
            </View>
            <View style={styles.machineStats}>
              {[
                { label: "Parts", value: ms.parts },
                { label: "Production", value: ms.production },
                { label: "QC", value: ms.qc },
                { label: "Sales", value: ms.sales },
              ].map((stat) => (
                <View key={stat.label} style={styles.machineStat}>
                  <Text style={styles.machineStatValue}>{stat.value}</Text>
                  <Text style={styles.machineStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  company: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  clockText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.primaryLight,
    fontVariant: ["tabular-nums"],
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chartHeader: {
    marginBottom: 12,
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.white,
  },
  emptyChart: {
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
    marginBottom: 12,
  },
  machineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  machineHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  machineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  machineName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
    flex: 1,
  },
  machineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  machineBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  machineStats: {
    flexDirection: "row",
    gap: 6,
  },
  machineStat: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  machineStatValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
  machineStatLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
