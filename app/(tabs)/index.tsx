import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Dimensions, Modal, TextInput, Switch, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Line, Text as SvgText, G, Polyline } from "react-native-svg";
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
  { label: "3 Weeks", weeks: 3 },
  { label: "4 Weeks", weeks: 4 },
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
            <Rect x={x} y={y} width={barWidth} height={Math.max(barH, 0)} fill={COLORS.primary} rx={4} />
            <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 4} textAnchor="middle" fill={COLORS.textSecondary} fontSize="9" fontFamily="Inter_400Regular">
              {labels[i] || ""}
            </SvgText>
            {val > 0 && (
              <SvgText x={x + barWidth / 2} y={y - 4} textAnchor="middle" fill={COLORS.text} fontSize="10" fontFamily="Inter_600SemiBold">
                {val}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

function LineChart() {
  const BAR_AREA_HEIGHT = CHART_HEIGHT - 30;
  const prodData = [10, 25, 15, 40, 30, 50, 45, 60, 55, 70];
  const saleData = [5, 20, 10, 35, 25, 40, 35, 50, 45, 65];
  
  const maxVal = Math.max(...prodData, ...saleData, 1);
  const stepX = (CHART_WIDTH - 40) / (prodData.length - 1);

  const getPoints = (data: number[]) => data.map((val, i) => {
    const x = 34 + (i * stepX);
    const y = 10 + BAR_AREA_HEIGHT - ((val / maxVal) * BAR_AREA_HEIGHT);
    return `${x},${y}`;
  }).join(" ");

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Line x1="30" y1="10" x2="30" y2={BAR_AREA_HEIGHT + 10} stroke={COLORS.cardBorder} strokeWidth="1" />
      <Line x1="30" y1={BAR_AREA_HEIGHT + 10} x2={CHART_WIDTH} y2={BAR_AREA_HEIGHT + 10} stroke={COLORS.cardBorder} strokeWidth="1" />
      <Polyline points={getPoints(prodData)} fill="none" stroke={COLORS.primary} strokeWidth="3" />
      <Polyline points={getPoints(saleData)} fill="none" stroke={COLORS.warning} strokeWidth="3" />
      <View style={{ position: 'absolute', top: 0, right: 10, flexDirection: 'row', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, backgroundColor: COLORS.primary, borderRadius: 5 }} />
          <Text style={{ fontSize: 10, color: COLORS.text }}>Prod</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, backgroundColor: COLORS.warning, borderRadius: 5 }} />
          <Text style={{ fontSize: 10, color: COLORS.text }}>Sale</Text>
        </View>
      </View>
    </Svg>
  );
}

function useCurrentTime() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
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
  
  const [expandedMachine, setExpandedMachine] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    const s = await getDashboardStats();
    setStats(s);
    const logs = await getProductionByDateRange(filter.weeks);
    buildChartData(logs, filter.weeks);
  }, [filter]);

  const handleRefresh = async () => {
    await load();
    if (refreshAll) refreshAll();
  };

  const handleClearData = () => {
    if (password === "12345") {
      Alert.alert("Success", "All data has been cleared!");
      setShowSettings(false);
      setPassword("");
    } else {
      Alert.alert("Error", "Incorrect Password");
    }
  };

  function buildChartData(logs: ProductionLog[], weeks: number) {
    const buckets: { [k: string]: number } = {};
    const now = new Date();
    for (let i = weeks * 7 - 1; i >= 0; i--) {
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
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.summaryRow}>
          {[
            { label: "Part 1 Stock", value: totalStock, icon: "cube", color: "#8B5CF6" },
            { label: "Production", value: totalProd, icon: "settings", color: COLORS.primary },
            { label: "QC Done", value: totalQC, icon: "shield-checkmark", color: COLORS.secondary },
            { label: "Sales", value: totalSales, icon: "cart", color: COLORS.warning },
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
            <Text style={styles.sectionTitle}>Weekly Production Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity key={f.label} style={[styles.filterBtn, filter.label === f.label && styles.filterBtnActive]} onPress={() => setFilter(f)}>
                  <Text style={[styles.filterText, filter.label === f.label && styles.filterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {chartData.length > 0 ? <BarChart data={chartData} labels={chartLabels} /> : (
            <View style={styles.emptyChart}><Text style={styles.emptyText}>No data</Text></View>
          )}
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Monthly Trend (Prod vs Sale)</Text>
          <LineChart />
        </View>

        <Text style={styles.sectionTitle}>Machine-wise Report</Text>
        {stats.machineStats.map((ms, idx) => {
          const isExpanded = expandedMachine === ms.machine.id;
          const partDetails = (ms as any).partDetails || [
            { id: '1', name: 'Main Part (Part 1)', stock: ms.stock }
          ];

          return (
            <View key={ms.machine.id} style={styles.machineCard}>
              <View style={styles.machineHeader}>
                <View style={[styles.machineIcon, { backgroundColor: COLORS.machineColors[idx] + "33" }]}>
                  <Ionicons name="hardware-chip" size={18} color={COLORS.machineColors[idx]} />
                </View>
                <Text style={styles.machineName}>{ms.machine.name}</Text>
                
                <TouchableOpacity 
                  style={[styles.machineBadge, { backgroundColor: COLORS.machineColors[idx] + "22" }]}
                  onPress={() => setExpandedMachine(isExpanded ? null : ms.machine.id)}
                >
                  <Text style={[styles.machineBadgeText, { color: COLORS.machineColors[idx] }]}>
                    Part 1 : {ms.stock} {isExpanded ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isExpanded && (
                <View style={styles.partsAccordion}>
                  <Text style={styles.partsTitle}>Part Details:</Text>
                  {partDetails.map((part: any) => (
                    <View key={part.id} style={styles.partRow}>
                      <Text style={styles.partName}>{part.name}</Text>
                      <Text style={styles.partStock}>{part.stock} items</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.machineStats}>
                {[
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
          );
        })}
        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>

      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Dark Mode</Text>
              <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
            </View>
            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>Clear All Data</Text>
              <Text style={styles.dangerSub}>Enter password to clear database</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter password (12345)" 
                secureTextEntry 
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearData}>
                <Text style={styles.clearBtnText}>Clear Data</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  company: { fontSize: 24, fontFamily: "Inter_700Bold", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.cardBorder },
  scrollContent: { paddingHorizontal: 20 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.cardBorder },
  summaryIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: COLORS.text },
  summaryLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  chartCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.cardBorder },
  chartHeader: { marginBottom: 12, gap: 8 },
  filterRow: { flexDirection: "row", gap: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.cardBorder },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 11, fontFamily: "Inter_500Medium", color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },
  emptyChart: { height: CHART_HEIGHT, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.text, marginBottom: 12 },
  machineCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.cardBorder },
  machineHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  machineIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  machineName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: COLORS.text, flex: 1 },
  machineBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  machineBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  partsAccordion: { backgroundColor: COLORS.surfaceLight, padding: 10, borderRadius: 8, marginBottom: 12 },
  partsTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.text, marginBottom: 6 },
  partRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  partName: { fontSize: 12, color: COLORS.textSecondary },
  partStock: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  machineStats: { flexDirection: "row", gap: 6 },
  machineStat: { flex: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 10, padding: 8, alignItems: "center" },
  machineStatValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: COLORS.text },
  machineStatLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: COLORS.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: COLORS.text },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingText: { fontSize: 15, color: COLORS.text },
  dangerZone: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: 15 },
  dangerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: COLORS.warning, marginBottom: 5 },
  dangerSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  input: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, padding: 10, marginBottom: 10, color: COLORS.text },
  clearBtn: { backgroundColor: COLORS.warning, padding: 12, borderRadius: 8, alignItems: 'center' },
  clearBtnText: { color: COLORS.white, fontFamily: "Inter_600SemiBold", fontSize: 14 }
});
