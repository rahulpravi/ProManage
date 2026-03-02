import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { markPartialSale } from "@/lib/database";
import type { QCLog } from "@/lib/database";
import { exportAndShareCSV, formatDate } from "@/lib/exportCsv";

type SaleGroup = {
  machineName: string;
  productName: string;
  totalQty: number;
  allSerials: string[];
  qcLogs: QCLog[];
};

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const { qcLogs, saleLogs, refreshSales } = useApp();

  const [showSold, setShowSold] = useState(false);
  const [sellGroup, setSellGroup] = useState<SaleGroup | null>(null);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [selling, setSelling] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const soldLogs = saleLogs.slice().reverse();

  const readyGroups = useMemo<SaleGroup[]>(() => {
    const passedLogs = qcLogs.filter((q) => q.status === "passed");
    const map: Record<string, SaleGroup> = {};
    for (const log of passedLogs) {
      if (!map[log.machineName]) {
        map[log.machineName] = {
          machineName: log.machineName,
          productName: log.productName,
          totalQty: 0,
          allSerials: [],
          qcLogs: [],
        };
      }
      map[log.machineName].totalQty += log.quantity;
      map[log.machineName].allSerials.push(...log.serialNumbers);
      map[log.machineName].qcLogs.push(log);
    }
    return Object.values(map);
  }, [qcLogs]);

  const totalReadyQty = readyGroups.reduce((s, g) => s + g.totalQty, 0);
  const totalRevenue = saleLogs.reduce((sum, s) => sum + s.quantity, 0);

  const openSellModal = (group: SaleGroup) => {
    setSellGroup(group);
    setSelectedSerials([]);
  };

  const toggleSerial = (sn: string) => {
    setSelectedSerials((prev) =>
      prev.includes(sn) ? prev.filter((s) => s !== sn) : [...prev, sn]
    );
  };

  const selectAll = () => {
    if (sellGroup) setSelectedSerials([...sellGroup.allSerials]);
  };

  const clearAll = () => setSelectedSerials([]);

  const handleSell = async () => {
    if (!sellGroup || selectedSerials.length === 0) {
      Alert.alert("Error", "Please select at least one serial number");
      return;
    }
    setSelling(true);
    try {
      await markPartialSale(sellGroup.machineName, selectedSerials, sellGroup.qcLogs);
      await refreshSales();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSellGroup(null);
      setSelectedSerials([]);
    } catch {
      Alert.alert("Error", "Failed to mark as sold");
    } finally {
      setSelling(false);
    }
  };

  const handleExport = async () => {
    if (showSold) {
      const headers = ["Product", "Machine", "Quantity", "Serial Numbers", "Sold Date"];
      const rows = saleLogs.map((s) => [
        s.productName, s.machineName, String(s.quantity),
        s.serialNumbers.join(", "), formatDate(s.soldAt),
      ]);
      await exportAndShareCSV("sales_report.csv", headers, rows);
    } else {
      const headers = ["Machine", "Quantity", "Serial Numbers"];
      const rows = readyGroups.map((g) => [
        g.machineName, String(g.totalQty), g.allSerials.join(", "),
      ]);
      await exportAndShareCSV("ready_for_sale.csv", headers, rows);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sales</Text>
          <Text style={styles.subtitle}>{totalRevenue} units sold total</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
            <Ionicons name="share-outline" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={20} color={COLORS.warning} />
          <Text style={styles.statValue}>{totalReadyQty}</Text>
          <Text style={styles.statLabel}>Ready</Text>
        </View>
        <View style={[styles.statCard, { flex: 2 }]}>
          <Ionicons name="trending-up" size={20} color={COLORS.secondary} />
          <Text style={styles.statValue}>{totalRevenue}</Text>
          <Text style={styles.statLabel}>Units Sold</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          <Text style={styles.statValue}>{saleLogs.length}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, !showSold && styles.tabBtnActive]}
          onPress={() => setShowSold(false)}
        >
          <Ionicons name="cube-outline" size={16} color={!showSold ? COLORS.warning : COLORS.textSecondary} />
          <Text style={[styles.tabText, !showSold && { color: COLORS.warning }]}>
            Ready ({readyGroups.length} machines)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, showSold && styles.tabBtnActive]}
          onPress={() => setShowSold(true)}
        >
          <Ionicons name="checkmark-done-outline" size={16} color={showSold ? COLORS.secondary : COLORS.textSecondary} />
          <Text style={[styles.tabText, showSold && { color: COLORS.secondary }]}>
            Sold ({saleLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {!showSold ? (
        <FlatList
          data={readyGroups}
          keyExtractor={(item) => item.machineName}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No items ready</Text>
              <Text style={styles.emptyText}>QC-passed items appear here</Text>
            </View>
          }
          renderItem={({ item: group }) => (
            <View style={styles.saleCard}>
              <View style={styles.saleLeft}>
                <View style={styles.saleIcon}>
                  <Ionicons name="hardware-chip" size={18} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.saleName}>{group.machineName}</Text>
                  <Text style={styles.saleMeta}>{group.qcLogs.length} batch(es) · Total qty: {group.totalQty}</Text>
                  <View style={styles.serialRow}>
                    {group.allSerials.slice(0, 4).map((sn, i) => (
                      <View key={i} style={styles.snTag}>
                        <Text style={styles.snTagText}>{sn}</Text>
                      </View>
                    ))}
                    {group.allSerials.length > 4 && (
                      <Text style={styles.snMore}>+{group.allSerials.length - 4} more</Text>
                    )}
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sellBtn}
                onPress={() => openSellModal(group)}
              >
                <Ionicons name="cart" size={14} color={COLORS.white} />
                <Text style={styles.sellText}>Sell</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={soldLogs}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No sales yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.soldCard}>
              <View style={styles.soldHeader}>
                <View style={styles.soldIcon}>
                  <Ionicons name="checkmark-done" size={18} color={COLORS.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.soldName}>{item.productName}</Text>
                  <Text style={styles.soldMeta}>{formatDate(item.soldAt)}</Text>
                </View>
                <View style={styles.soldQtyBadge}>
                  <Text style={styles.soldQtyText}>{item.quantity}</Text>
                  <Text style={styles.soldQtyLabel}>units</Text>
                </View>
              </View>
              <View style={styles.serialRow}>
                {item.serialNumbers.map((sn, i) => (
                  <View key={i} style={styles.soldSnTag}>
                    <Text style={styles.soldSnText}>{sn}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!sellGroup} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Sell — {sellGroup?.machineName}</Text>
                  <Text style={styles.modalSubtitle}>{selectedSerials.length} of {sellGroup?.totalQty} selected</Text>
                </View>
                <TouchableOpacity onPress={() => setSellGroup(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.selectActions}>
                <TouchableOpacity style={styles.selectActionBtn} onPress={selectAll}>
                  <Text style={styles.selectActionText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectActionBtn} onPress={clearAll}>
                  <Text style={styles.selectActionText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <Text style={[ddStyles.label, { marginBottom: 8 }]}>Choose Serial Numbers to Sell</Text>
              <View style={styles.serialCheckList}>
                {(sellGroup?.allSerials ?? []).map((sn) => {
                  const checked = selectedSerials.includes(sn);
                  return (
                    <TouchableOpacity
                      key={sn}
                      style={[styles.serialCheckItem, checked && styles.serialCheckItemActive]}
                      onPress={() => toggleSerial(sn)}
                    >
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={20}
                        color={checked ? COLORS.warning : COLORS.textMuted}
                      />
                      <Text style={[styles.serialCheckText, checked && { color: COLORS.warning, fontFamily: "Inter_600SemiBold" }]}>
                        {sn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 16 }} />

              <TouchableOpacity
                style={[styles.submitBtn, selectedSerials.length === 0 && { opacity: 0.5 }]}
                onPress={handleSell}
                disabled={selling || selectedSerials.length === 0}
              >
                {selling ? <ActivityIndicator color={COLORS.white} /> : (
                  <Text style={styles.submitText}>
                    Confirm Sale of {selectedSerials.length} unit{selectedSerials.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const ddStyles = StyleSheet.create({
  label: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: COLORS.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: COLORS.text },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  tabBar: {
    flexDirection: "row", marginHorizontal: 20, marginBottom: 16,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", paddingVertical: 9, borderRadius: 9, gap: 6,
  },
  tabBtnActive: { backgroundColor: COLORS.surfaceLight },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium", color: COLORS.textSecondary },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 100,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  saleCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderColor: COLORS.warning + "44", gap: 12,
  },
  saleLeft: { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  saleIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.warning + "22", alignItems: "center", justifyContent: "center",
  },
  saleName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  saleMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  serialRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  snTag: { backgroundColor: COLORS.surfaceLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  snTagText: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  snMore: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textMuted, alignSelf: "center" },
  sellBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 4,
  },
  sellText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.white },
  soldCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.secondary + "44",
  },
  soldHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  soldIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.secondary + "22", alignItems: "center", justifyContent: "center",
  },
  soldName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  soldMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  soldQtyBadge: {
    alignItems: "center", backgroundColor: COLORS.secondary + "22",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  soldQtyText: { fontSize: 20, fontFamily: "Inter_700Bold", color: COLORS.secondary },
  soldQtyLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: COLORS.secondary },
  soldSnTag: { backgroundColor: COLORS.secondary + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  soldSnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.secondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, maxHeight: "90%",
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: COLORS.cardBorder,
    borderRadius: 2, alignSelf: "center", marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: COLORS.text },
  modalSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  selectActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  selectActionBtn: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 8, paddingHorizontal: 14,
    paddingVertical: 7, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  selectActionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.primaryLight },
  serialCheckList: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  serialCheckItem: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  serialCheckItemActive: { backgroundColor: COLORS.warning + "11" },
  serialCheckText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text, flex: 1 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: "center" },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.white },
});
