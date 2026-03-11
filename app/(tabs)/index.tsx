import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Rect,
  Line,
  Polyline,
  Circle,
  Text as SvgText,
  G,
} from "react-native-svg";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  getDashboardStats,
  getProductionByDateRange,
  getSaleLogs,
  DEFAULT_MACHINES,
  MACHINE_PARTS,
} from "@/lib/database";
import type { ProductionLog, SaleLog, StockItem } from "@/lib/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_W = SCREEN_WIDTH - 48;
const CHART_H = 190;
const Y_LEFT = 32;
const BAR_AREA_H = CHART_H - 36;

function useCurrentTime() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function YGridLines({ maxVal, colors }: { maxVal: number; colors: any }) {
  const steps = [0.25, 0.5, 0.75, 1.0];
  return (
    <>
      {steps.map((s) => {
        const y = 10 + BAR_AREA_H * (1 - s);
        const val = Math.round(maxVal * s);
        return (
          <G key={s}>
            <Line
              x1={Y_LEFT}
              y1={y}
              x2={CHART_W}
              y2={y}
              stroke={colors.cardBorder}
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <SvgText
              x={Y_LEFT - 4}
              y={y + 4}
              textAnchor="end"
              fill={colors.textMuted}
              fontSize="8"
              fontFamily="Inter_400Regular"
            >
              {val}
            </SvgText>
          </G>
        );
      })}
    </>
  );
}

function WeeklyGroupedChart({
  weeks,
  data,
  colors,
}: {
  weeks: string[];
  data: number[][];
  colors: any;
}) {
  const MACHINE_COUNT = DEFAULT_MACHINES.length;
  const GROUP_COUNT = weeks.length;
  const GROUP_GAP = 10;
  const BAR_GAP = 2;
  const usableW = CHART_W - Y_LEFT;
  const groupW = (usableW - (GROUP_COUNT - 1) * GROUP_GAP) / GROUP_COUNT;
  const barW = (groupW - (MACHINE_COUNT - 1) * BAR_GAP) / MACHINE_COUNT;

  const allValues = data.flat();
  const maxVal = Math.max(...allValues, 1);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Line
        x1={Y_LEFT}
        y1="10"
        x2={Y_LEFT}
        y2={BAR_AREA_H + 10}
        stroke={colors.cardBorder}
        strokeWidth="1"
      />
      <Line
        x1={Y_LEFT}
        y1={BAR_AREA_H + 10}
        x2={CHART_W}
        y2={BAR_AREA_H + 10}
        stroke={colors.cardBorder}
        strokeWidth="1"
      />
      <YGridLines maxVal={maxVal} colors={colors} />
      {weeks.map((weekLabel, wi) => {
        const groupX = Y_LEFT + wi * (groupW + GROUP_GAP);
        return (
          <G key={weekLabel}>
            {DEFAULT_MACHINES.map((m, mi) => {
              const val = data[wi]?.[mi] ?? 0;
              const barH = (val / maxVal) * BAR_AREA_H;
              const x = groupX + mi * (barW + BAR_GAP);
              const y = 10 + BAR_AREA_H - barH;
              return (
                <G key={mi}>
                  <Rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(barH, 0)}
                    fill={colors.machineColors[mi]}
                    rx="2"
                  />
                </G>
              );
            })}
            <SvgText
              x={groupX + groupW / 2}
              y={CHART_H - 4}
              textAnchor="middle"
              fill={colors.textSecondary}
              fontSize="9"
              fontFamily="Inter_500Medium"
            >
              {weekLabel}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function MonthlyLineChart({
  days,
  production,
  sales,
  colors,
}: {
  days: number[];
  production: number[];
  sales: number[];
  colors: any;
}) {
  const maxVal = Math.max(...production, ...sales, 1);
  const usableW = CHART_W - Y_LEFT;
  const dayCount = days.length;
  const xStep = dayCount > 1 ? usableW / (dayCount - 1) : usableW;

  const getPoints = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = Y_LEFT + i * xStep;
        const y = 10 + BAR_AREA_H - (v / maxVal) * BAR_AREA_H;
        return `${x},${y}`;
      })
      .join(" ");

  const prodPoints = getPoints(production);
  const salePoints = getPoints(sales);

  const labelEvery = Math.ceil(dayCount / 6);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Line
        x1={Y_LEFT}
        y1="10"
        x2={Y_LEFT}
        y2={BAR_AREA_H + 10}
        stroke={colors.cardBorder}
        strokeWidth="1"
      />
      <Line
        x1={Y_LEFT}
        y1={BAR_AREA_H + 10}
        x2={CHART_W}
        y2={BAR_AREA_H + 10}
        stroke={colors.cardBorder}
        strokeWidth="1"
      />
      <YGridLines maxVal={maxVal} colors={colors} />

      <Polyline
        points={prodPoints}
        fill="none"
        stroke={colors.primaryLight}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Polyline
        points={salePoints}
        fill="none"
        stroke={colors.warning}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {days.map((day, i) => {
        const x = Y_LEFT + i * xStep;
        const py = 10 + BAR_AREA_H - (production[i] / maxVal) * BAR_AREA_H;
        const sy = 10 + BAR_AREA_H - (sales[i] / maxVal) * BAR_AREA_H;
        return (
          <G key={day}>
            {production[i] > 0 && (
              <Circle cx={x} cy={py} r="3" fill={colors.primaryLight} />
            )}
            {sales[i] > 0 && (
              <Circle cx={x} cy={sy} r="3" fill={colors.warning} />
            )}
            {i % labelEvery === 0 && (
              <SvgText
                x={x}
                y={CHART_H - 4}
                textAnchor="middle"
                fill={colors.textMuted}
                fontSize="8"
                fontFamily="Inter_400Regular"
              >
                {day}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

type DashStats = Awaited<ReturnType<typeof getDashboardStats>>;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const colors = COLORS; 
  const { refreshAll, isLoading } = useApp();

  const [stats, setStats] = useState<DashStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<number[][]>([]);
  const [weeklyLabels, setWeeklyLabels] = useState<string[]>([]);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([]);
  const [monthlyProd, setMonthlyProd] = useState<number[]>([]);
  const [monthlySales, setMonthlySales] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stockModalMachine, setStockModalMachine] = useState<string | null>(null);

  const currentTime = useCurrentTime();

  const buildWeeklyData = (logs: ProductionLog[]) => {
    const now = new Date();
    const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const data: number[][] = labels.map(() =>
      Array(DEFAULT_MACHINES.length).fill(0),
    );
    logs.forEach((l) => {
      const d = new Date(l.completedAt);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
      const weekIdx = 3 - Math.min(Math.floor(daysAgo / 7), 3);
      const machineIdx = DEFAULT_MACHINES.findIndex((m) => m.name === l.machineName);
      if (machineIdx >= 0) data[weekIdx][machineIdx] += l.quantity;
    });
    setWeeklyLabels(labels);
    setWeeklyData(data);
  };

  const buildMonthlyData = (prodLogs: ProductionLog[], saleLogs: SaleLog[]) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const prod = Array(daysInMonth).fill(0);
    const sale = Array(daysInMonth).fill(0);

    prodLogs.forEach((l) => {
      const d = new Date(l.completedAt);
      if (d.getFullYear() === year && d.getMonth() === month) prod[d.getDate() - 1] += l.quantity;
    });
    saleLogs.forEach((l) => {
      const d = new Date(l.soldAt);
      if (d.getFullYear() === year && d.getMonth() === month) sale[d.getDate() - 1] += l.quantity;
    });
    setMonthlyDays(days);
    setMonthlyProd(prod);
    setMonthlySales(sale);
  };

  const load = useCallback(async () => {
    const [s, saleLogs, prodLogs4Wk] = await Promise.all([
      getDashboardStats(),
      getSaleLogs(),
      getProductionByDateRange(4),
    ]);
    setStats(s);
    buildWeeklyData(prodLogs4Wk);
    buildMonthlyData(s.prodLogs, saleLogs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAll(), load()]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const today = new Date().toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const s = useMemo(() => makeStyles(colors), [colors]);

  if (isLoading || !stats) {
    return (
      <View style={[s.container, { paddingTop: topPad + 16 }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const totalProd = stats.machineStats.reduce((a, m) => a + m.production, 0);
  const totalQC = stats.machineStats.reduce((a, m) => a + m.qc, 0);
  const totalSales = stats.machineStats.reduce((a, m) => a + m.sales, 0);
  const totalStock = stats.machineStats.reduce((a, m) => a + m.stock, 0);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View>
          <Text style={s.company}>ProManage</Text>
          <Text style={s.subtitle}>{today}</Text>
        </View>
        <View style={s.headerRight}>
          <View style={s.clockBadge}>
            <Ionicons name="time-outline" size={12} color={colors.primaryLight} />
            <Text style={s.clockText}>{currentTime}</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color={colors.primaryLight} size="small" />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.primaryLight} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scrollContent}>
        <View style={s.summaryRow}>
          {[
            { label: "Stock", value: totalStock, icon: "cube", color: "#8B5CF6" },
            { label: "Production", value: totalProd, icon: "settings", color: colors.primary },
            { label: "QC Done", value: totalQC, icon: "shield-checkmark", color: colors.secondary },
            { label: "Sales", value: totalSales, icon: "cart", color: colors.warning },
          ].map((item) => (
            <View key={item.label} style={s.summaryCard}>
              <View style={[s.summaryIcon, { backgroundColor: item.color + "22" }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={s.summaryValue}>{item.value}</Text>
              <Text style={s.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.chartCard}>
          <Text style={s.sectionTitle}>Weekly Production</Text>
          <Text style={s.chartSubtitle}>Last 4 weeks · by machine</Text>
          <View style={s.legendRow}>
            {DEFAULT_MACHINES.map((m, i) => (
              <View key={m.id} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: colors.machineColors[i] }]} />
                <Text style={s.legendText}>{m.name}</Text>
              </View>
            ))}
          </View>
          {weeklyData.some((w) => w.some((v) => v > 0)) ? (
            <WeeklyGroupedChart weeks={weeklyLabels} data={weeklyData} colors={colors} />
          ) : (
            <View style={s.emptyChart}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.textMuted} />
              <Text style={s.emptyText}>No production data yet</Text>
            </View>
          )}
        </View>

        <View style={s.chartCard}>
          <Text style={s.sectionTitle}>Monthly Overview</Text>
          <Text style={s.chartSubtitle}>
            {new Date().toLocaleString("default", { month: "long", year: "numeric" })} · Day by day
          </Text>
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.primaryLight }]} />
              <Text style={s.legendText}>Production</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={s.legendText}>Sales</Text>
            </View>
          </View>
          {monthlyProd.some((v) => v > 0) || monthlySales.some((v) => v > 0) ? (
            <MonthlyLineChart days={monthlyDays} production={monthlyProd} sales={monthlySales} colors={colors} />
          ) : (
            <View style={s.emptyChart}>
              <Ionicons name="trending-up-outline" size={32} color={colors.textMuted} />
              <Text style={s.emptyText}>No data this month</Text>
            </View>
          )}
        </View>

        <Text style={s.sectionTitle}>Machine-wise Report</Text>
        {stats.machineStats.map((ms, idx) => {
          // Get stock of the first/main part for this machine
          const machineParts = MACHINE_PARTS[ms.machine.name] ?? [];
          const mainPartName = machineParts[0] ?? "Main Part";
          const mainPartStock = stats?.stock.find(
            (sItem) => sItem.machineCategory === ms.machine.name && sItem.partName === mainPartName
          )?.quantity || 0;

          return (
            <View key={ms.machine.id} style={s.machineCard}>
              <View style={s.machineHeader}>
                <View style={[s.machineIcon, { backgroundColor: colors.machineColors[idx] + "33" }]}>
                  <Ionicons name="hardware-chip" size={18} color={colors.machineColors[idx]} />
                </View>
                <Text style={s.machineName}>{ms.machine.name}</Text>
                
                {/* Changed Badge Text and Icon */}
                <TouchableOpacity
                  style={[s.machineBadge, { backgroundColor: colors.machineColors[idx] + "22" }]}
                  onPress={() => setStockModalMachine(ms.machine.name)}
                >
                  <Text style={[s.machineBadgeText, { color: colors.machineColors[idx] }]}>
                    Stock details ?
                  </Text>
                  <Ionicons name="chevron-down-outline" size={14} color={colors.machineColors[idx]} />
                </TouchableOpacity>
              </View>
              
              <View style={s.machineStats}>
                {[
                  { label: "Stock", value: mainPartStock },
                  { label: "Production", value: ms.production },
                  { label: "QC", value: ms.qc },
                  { label: "Sales", value: ms.sales },
                ].map((stat) => (
                  <View key={stat.label} style={s.machineStat}>
                    <Text style={s.machineStatValue}>{stat.value}</Text>
                    <Text style={s.machineStatLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>

      <Modal visible={!!stockModalMachine} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{stockModalMachine}</Text>
                <Text style={s.modalSubtitle}>Stock Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setStockModalMachine(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              {(MACHINE_PARTS[stockModalMachine ?? ""] ?? []).map((partName) => {
                const foundStock = stats?.stock.find(
                  (sItem) => sItem.machineCategory === stockModalMachine && sItem.partName === partName
                );
                const qty = foundStock ? foundStock.quantity : 0;

                return (
                  <View key={partName} style={s.stockRow}>
                    <View style={s.stockRowLeft}>
                      <Ionicons name="cube" size={16} color={colors.primary} />
                      <Text style={s.stockRowName}>{partName}</Text>
                    </View>
                    <View
                      style={[
                        s.stockQtyBadge,
                        {
                          backgroundColor:
                            qty === 0
                              ? colors.danger + "22"
                              : qty <= 5
                                ? colors.warning + "22"
                                : colors.secondary + "22",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.stockQtyText,
                          {
                            color:
                              qty === 0
                                ? colors.danger
                                : qty <= 5
                                  ? colors.warning
                                  : colors.secondary,
                          },
                        ]}
                      >
                        {qty} units
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 12,
      paddingTop: 8,
    },
    company: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    clockBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    clockText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primaryLight, fontVariant: ["tabular-nums"] as any },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
    summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 10,
      alignItems: "center",
      gap: 3,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    summaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text },
    summaryLabel: { fontSize: 8, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text },
    chartSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2, marginBottom: 10 },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    emptyChart: { height: CHART_H, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textMuted },
    machineCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    machineHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
    machineIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    machineName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, flex: 1 },
    machineBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
    machineBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    machineStats: { flexDirection: "row", gap: 6 },
    machineStat: { flex: 1, backgroundColor: colors.surfaceLight, borderRadius: 10, padding: 8, alignItems: "center" },
    machineStatValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" },
    machineStatLabel: { fontSize: 8, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.text },
    modalSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2 },
    stockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    stockRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    stockRowName: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.text },
    stockQtyBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    stockQtyText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  });
}
