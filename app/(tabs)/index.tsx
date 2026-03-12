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
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText, G, Path } from "react-native-svg";
import { useRouter } from "expo-router";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  getDashboardStats,
  getProductionByDateRange,
  getSaleLogs,
  DEFAULT_MACHINES,
  MACHINE_PARTS,
  getMachines,
} from "@/lib/database";
import type { ProductionLog, SaleLog, Machine } from "@/lib/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// ഗ്രാഫ് ബോക്സിന് പുറത്ത് പോകാതിരിക്കാൻ വീതി അഡ്ജസ്റ്റ് ചെയ്തു
const CHART_W = SCREEN_WIDTH - 80; 
const CHART_H = 190;
const Y_LEFT = 32;
const BAR_AREA_H = CHART_H - 36;

function useCurrentTime() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
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
            <Line x1={Y_LEFT} y1={y} x2={CHART_W} y2={y} stroke={colors.cardBorder} strokeWidth="0.5" strokeDasharray="3,3" />
            <SvgText x={Y_LEFT - 4} y={y + 4} textAnchor="end" fill={colors.textMuted} fontSize="8" fontFamily="Inter_400Regular">{val}</SvgText>
          </G>
        );
      })}
    </>
  );
}

// പുതിയ പൈ ഡയഗ്രം (Pie Chart) കോഡ്
function MachinePieChart({ data, colors, machines }: { data: number[][]; colors: any; machines: Machine[] }) {
  // ഓരോ മെഷീന്റെയും ആകെ പ്രൊഡക്ഷൻ കണ്ടുപിടിക്കുന്നു
  const machineTotals = machines.map((_, mi) => data.reduce((sum, weekData) => sum + (weekData[mi] || 0), 0));
  const total = machineTotals.reduce((a, b) => a + b, 0);

  const radius = 70; // വലിപ്പം
  const cx = CHART_W / 2;
  const cy = CHART_H / 2;

  if (total === 0) return null;

  let currentAngle = -90; // മുകളിൽ നിന്ന് തുടങ്ങാൻ

  return (
    <Svg width={CHART_W} height={CHART_H}>
      {machineTotals.map((val, i) => {
        if (val === 0) return null;
        
        const sliceAngle = (val / total) * 360;
        const largeArcFlag = sliceAngle > 180 ? 1 : 0;
        
        const startAngleRad = (currentAngle * Math.PI) / 180;
        const endAngleRad = ((currentAngle + sliceAngle) * Math.PI) / 180;
        
        const x1 = cx + radius * Math.cos(startAngleRad);
        const y1 = cy + radius * Math.sin(startAngleRad);
        const x2 = cx + radius * Math.cos(endAngleRad);
        const y2 = cy + radius * Math.sin(endAngleRad);

        const pathData = val === total 
          ? "" // 100% ആണെങ്കിൽ Circle ഉപയോഗിക്കും
          : [
              `M ${cx} ${cy}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `Z`
            ].join(" ");

        const prevAngle = currentAngle;
        currentAngle += sliceAngle;

        // ശതമാനം (Percentage) എഴുതാനുള്ള സ്ഥലം 
        const labelAngleRad = ((prevAngle + sliceAngle / 2) * Math.PI) / 180;
        const labelX = cx + (radius * 0.65) * Math.cos(labelAngleRad);
        const labelY = cy + (radius * 0.65) * Math.sin(labelAngleRad);

        return (
          <G key={i}>
            {val === total ? (
              <Circle cx={cx} cy={cy} r={radius} fill={colors.machineColors[i % colors.machineColors.length]} />
            ) : (
              <Path d={pathData} fill={colors.machineColors[i % colors.machineColors.length]} />
            )}
            {/* 5% ൽ കൂടുതൽ ആണെങ്കിൽ മാത്രം ശതമാനം കാണിക്കുക */}
            {val / total > 0.05 && (
              <SvgText x={labelX} y={labelY + 4} fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
                  {Math.round((val / total) * 100)}%
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

function MonthlyLineChart({ days, production, sales, colors }: { days: number[]; production: number[]; sales: number[]; colors: any }) {
  const maxVal = Math.max(...production, ...sales, 1);
  const usableW = CHART_W - Y_LEFT - 15; // കുറച്ച് സ്ഥലം വലതുവശത്ത് ഒഴിച്ചിട്ടു
  const dayCount = days.length;
  const xStep = dayCount > 1 ? usableW / (dayCount - 1) : usableW;

  const getPoints = (vals: number[]) =>
    vals.map((v, i) => `${Y_LEFT + i * xStep},${10 + BAR_AREA_H - (v / maxVal) * BAR_AREA_H}`).join(" ");

  const labelEvery = Math.ceil(dayCount / 6);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Line x1={Y_LEFT} y1="10" x2={Y_LEFT} y2={BAR_AREA_H + 10} stroke={colors.cardBorder} strokeWidth="1" />
      <Line x1={Y_LEFT} y1={BAR_AREA_H + 10} x2={CHART_W} y2={BAR_AREA_H + 10} stroke={colors.cardBorder} strokeWidth="1" />
      <YGridLines maxVal={maxVal} colors={colors} />
      <Polyline points={getPoints(production)} fill="none" stroke={colors.primaryLight} strokeWidth="2.5" strokeLinejoin="round" />
      <Polyline points={getPoints(sales)} fill="none" stroke={colors.warning} strokeWidth="2.5" strokeLinejoin="round" />
      {days.map((day, i) => {
        const x = Y_LEFT + i * xStep;
        return (
          <G key={day}>
            {production[i] > 0 && <Circle cx={x} cy={10 + BAR_AREA_H - (production[i] / maxVal) * BAR_AREA_H} r="3" fill={colors.primaryLight} />}
            {sales[i] > 0 && <Circle cx={x} cy={10 + BAR_AREA_H - (sales[i] / maxVal) * BAR_AREA_H} r="3" fill={colors.warning} />}
            {i % labelEvery === 0 && <SvgText x={x} y={CHART_H - 4} textAnchor="middle" fill={colors.textMuted} fontSize="8" fontFamily="Inter_400Regular">{day}</SvgText>}
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
  const router = useRouter(); 

  const [stats, setStats] = useState<DashStats | null>(null);
  const [macList, setMacList] = useState<Machine[]>([]);
  const [weeklyData, setWeeklyData] = useState<number[][]>([]);
  const [weeklyLabels, setWeeklyLabels] = useState<string[]>([]);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([]);
  const [monthlyProd, setMonthlyProd] = useState<number[]>([]);
  const [monthlySales, setMonthlySales] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const [stockModalMachine, setStockModalMachine] = useState<string | null>(null);
  
  // Menu & Password States
  const [showMenuPopup, setShowMenuPopup] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [password, setPassword] = useState("");

  const currentTime = useCurrentTime();

  const load = useCallback(async () => {
    const [s, saleLogs, prodLogs4Wk, macs] = await Promise.all([
      getDashboardStats(),
      getSaleLogs(),
      getProductionByDateRange(4),
      getMachines()
    ]);
    setStats(s);
    setMacList(macs);
    
    const now = new Date();
    const wLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const wData: number[][] = wLabels.map(() => Array(macs.length).fill(0));
    prodLogs4Wk.forEach((l) => {
      const d = new Date(l.completedAt);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
      const weekIdx = 3 - Math.min(Math.floor(daysAgo / 7), 3);
      const machineIdx = macs.findIndex((m) => m.name === l.machineName);
      if (machineIdx >= 0) wData[weekIdx][machineIdx] += l.quantity;
    });
    setWeeklyLabels(wLabels);
    setWeeklyData(wData);

    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const mProd = Array(daysInMonth).fill(0);
    const mSale = Array(daysInMonth).fill(0);
    s.prodLogs.forEach((l) => {
      const d = new Date(l.completedAt);
      if (d.getFullYear() === year && d.getMonth() === month) mProd[d.getDate() - 1] += l.quantity;
    });
    saleLogs.forEach((l) => {
      const d = new Date(l.soldAt);
      if (d.getFullYear() === year && d.getMonth() === month) mSale[d.getDate() - 1] += l.quantity;
    });
    setMonthlyDays(mDays);
    setMonthlyProd(mProd);
    setMonthlySales(mSale);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setShowMenuPopup(false);
    setRefreshing(true);
    await Promise.all([refreshAll(), load()]);
    setRefreshing(false);
  };

  const handlePasswordSubmit = () => {
    if (password === "devil@123") {
      setShowPasswordModal(false);
      setPassword("");
      router.push("/settings"); 
    } else {
      if (Platform.OS === 'web') window.alert("Incorrect Password");
      else Alert.alert("Incorrect Password", "Access denied.");
    }
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const today = new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
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
      {/* HEADER */}
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
          <TouchableOpacity style={s.refreshBtn} onPress={() => setShowMenuPopup(true)}>
            <Ionicons name="settings" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scrollContent}>
        {/* DASHBOARD CONTENT */}
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

        {/* PIE CHART SECTION */}
        <View style={s.chartCard}>
          <Text style={s.sectionTitle}>Weekly Production</Text>
          <Text style={s.chartSubtitle}>Last 4 weeks · by machine</Text>
          <View style={s.legendRow}>
            {macList.map((m, i) => (
              <View key={m.id} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: colors.machineColors[i % colors.machineColors.length] }]} />
                <Text style={s.legendText}>{m.name}</Text>
              </View>
            ))}
          </View>
          {weeklyData.some((w) => w.some((v) => v > 0)) ? (
            <MachinePieChart data={weeklyData} colors={colors} machines={macList} />
          ) : (
            <View style={s.emptyChart}>
              <Ionicons name="pie-chart-outline" size={32} color={colors.textMuted} />
              <Text style={s.emptyText}>No production data yet</Text>
            </View>
          )}
        </View>

        {/* LINE CHART SECTION */}
        <View style={s.chartCard}>
          <Text style={s.sectionTitle}>Monthly Overview</Text>
          <Text style={s.chartSubtitle}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })} · Day by day</Text>
          <View style={s.legendRow}>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.primaryLight }]} /><Text style={s.legendText}>Production</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.warning }]} /><Text style={s.legendText}>Sales</Text></View>
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
          const machineParts = MACHINE_PARTS[ms.machine.name] ?? [];
          const mainPartName = machineParts[0] ?? "Main Part";
          const mainPartStock = stats?.stock.find(
            (sItem) => sItem.machineCategory === ms.machine.name && sItem.partName === mainPartName
          )?.quantity || 0;

          return (
            <View key={ms.machine.id} style={s.machineCard}>
              <View style={s.machineHeader}>
                <View style={[s.machineIcon, { backgroundColor: colors.machineColors[idx % colors.machineColors.length] + "33" }]}>
                  <Ionicons name="hardware-chip" size={18} color={colors.machineColors[idx % colors.machineColors.length]} />
                </View>
                <Text style={s.machineName}>{ms.machine.name}</Text>
                <TouchableOpacity style={[s.machineBadge, { backgroundColor: colors.machineColors[idx % colors.machineColors.length] + "22" }]} onPress={() => setStockModalMachine(ms.machine.name)}>
                  <Text style={[s.machineBadgeText, { color: colors.machineColors[idx % colors.machineColors.length] }]}>Stock details ?</Text>
                  <Ionicons name="chevron-down-outline" size={14} color={colors.machineColors[idx % colors.machineColors.length]} />
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
      </ScrollView>

      {/* --- MENU POPUP MODAL --- */}
      <Modal visible={showMenuPopup} animationType="fade" transparent>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenuPopup(false)}>
          <View style={s.menuCard}>
            <Text style={s.menuTitle}>Menu</Text>
            
            <TouchableOpacity style={s.menuItem} onPress={handleRefresh}>
              <View style={[s.menuIconBox, { backgroundColor: colors.primaryLight + "22" }]}>
                <Ionicons name="refresh" size={20} color={colors.primaryLight} />
              </View>
              <Text style={s.menuItemText}>Refresh Data</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenuPopup(false); setShowPasswordModal(true); }}>
              <View style={[s.menuIconBox, { backgroundColor: colors.warning + "22" }]}>
                <Ionicons name="settings" size={20} color={colors.warning} />
              </View>
              <Text style={s.menuItemText}>Admin Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenuPopup(false); setShowAboutModal(true); }}>
              <View style={[s.menuIconBox, { backgroundColor: colors.secondary + "22" }]}>
                <Ionicons name="information-circle" size={20} color={colors.secondary} />
              </View>
              <Text style={s.menuItemText}>About App</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- PASSWORD MODAL --- */}
      <Modal visible={showPasswordModal} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
          <View style={s.passOverlay}>
            <View style={s.passCard}>
              <Ionicons name="lock-closed" size={40} color={colors.danger} style={{ marginBottom: 10 }} />
              <Text style={s.passTitle}>Admin Access</Text>
              <Text style={s.passSubtitle}>Enter password to open settings</Text>
              <TextInput
                style={s.passInput}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <View style={s.passActions}>
                <TouchableOpacity style={s.passBtnCancel} onPress={() => { setShowPasswordModal(false); setPassword(""); }}>
                  <Text style={s.passBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.passBtnSubmit} onPress={handlePasswordSubmit}>
                  <Text style={s.passBtnTextSubmit}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- ABOUT APP MODAL --- */}
      <Modal visible={showAboutModal} animationType="slide">
        <View style={[s.fullScreenContainer, { paddingTop: topPad }]}>
          <View style={s.fullScreenHeader}>
            <TouchableOpacity style={s.backIconBtn} onPress={() => setShowAboutModal(false)}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.fullScreenTitle}>About App</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ alignItems: "center", padding: 20, paddingTop: 40 }}>
            <View style={s.aboutIconBox}>
              <Ionicons name="cube-outline" size={60} color={colors.primaryLight} />
            </View>
            <Text style={s.aboutTitle}>ProManage</Text>
            <Text style={s.aboutVersion}>Version 1.0.0</Text>
            
            <View style={s.aboutCard}>
              <Text style={s.aboutDesc}>
                A complete factory management system to track stock, production, quality control, and sales efficiently.
              </Text>
            </View>

            <View style={s.aboutCard}>
              <Text style={s.aboutSub}>Developed By</Text>
              <Text style={s.aboutName}>Rahul</Text>
              <Text style={s.aboutRole}>Creator & Developer</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- STOCK DETAILS MODAL --- */}
      <Modal visible={!!stockModalMachine} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{stockModalMachine}</Text>
                <Text style={s.modalSubtitle}>Stock Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setStockModalMachine(null)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              {(MACHINE_PARTS[stockModalMachine ?? ""] ?? []).map((partName) => {
                const foundStock = stats?.stock.find((sItem) => sItem.machineCategory === stockModalMachine && sItem.partName === partName);
                const qty = foundStock ? foundStock.quantity : 0;
                return (
                  <View key={partName} style={s.stockRow}>
                    <View style={s.stockRowLeft}>
                      <Ionicons name="cube" size={16} color={colors.primary} />
                      <Text style={s.stockRowName}>{partName}</Text>
                    </View>
                    <View style={[s.stockQtyBadge, { backgroundColor: qty === 0 ? colors.danger + "22" : qty <= 5 ? colors.warning + "22" : colors.secondary + "22" }]}>
                      <Text style={[s.stockQtyText, { color: qty === 0 ? colors.danger : qty <= 5 ? colors.warning : colors.secondary }]}>{qty} units</Text>
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
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
    company: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    clockBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.cardBorder },
    clockText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primaryLight, fontVariant: ["tabular-nums"] as any },
    refreshBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cardBorder },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
    summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, alignItems: "center", gap: 3, borderWidth: 1, borderColor: colors.cardBorder },
    summaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text },
    summaryLabel: { fontSize: 8, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    chartCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder },
    sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text },
    chartSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2, marginBottom: 10 },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.textSecondary },
    emptyChart: { height: CHART_H, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textMuted },
    machineCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder },
    machineHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
    machineIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    machineName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text, flex: 1 },
    machineBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
    machineBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    machineStats: { flexDirection: "row", gap: 6 },
    machineStat: { flex: 1, backgroundColor: colors.surfaceLight, borderRadius: 10, padding: 8, alignItems: "center" },
    machineStatValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" },
    machineStatLabel: { fontSize: 8, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 2 },
    
    // Bottom Sheet / Overlays
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
    
    // Popup Menu Styles
    menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
    menuCard: { width: 260, backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder, elevation: 5, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
    menuTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text, marginBottom: 20, textAlign: "center" },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 15, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 8, borderRadius: 12, backgroundColor: colors.surfaceLight },
    menuIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    menuItemText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text },

    // Password Modal Styles
    passOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
    passCard: { backgroundColor: colors.surface, padding: 24, borderRadius: 20, width: "80%", alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder },
    passTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.text },
    passSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
    passInput: { backgroundColor: colors.background, width: "100%", borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 20, textAlign: "center" },
    passActions: { flexDirection: "row", gap: 10, width: "100%" },
    passBtnCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.surfaceLight, alignItems: "center" },
    passBtnTextCancel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.textSecondary },
    passBtnSubmit: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.danger, alignItems: "center" },
    passBtnTextSubmit: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.white },

    // Full Screen About Styles
    fullScreenContainer: { flex: 1, backgroundColor: colors.background },
    fullScreenHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    backIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.cardBorder },
    fullScreenTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text },

    aboutIconBox: { width: 100, height: 100, borderRadius: 24, backgroundColor: colors.primaryLight + "22", alignItems: "center", justifyContent: "center", marginBottom: 20 },
    aboutTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text },
    aboutVersion: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 4, marginBottom: 40 },
    aboutCard: { backgroundColor: colors.surface, padding: 24, borderRadius: 16, width: "100%", alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder },
    aboutDesc: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.text, textAlign: "center", lineHeight: 24 },
    aboutSub: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
    aboutName: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.primaryLight },
    aboutRole: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textMuted, marginTop: 4 },
  });
}
