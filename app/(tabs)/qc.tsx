import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { addQCLog } from "@/lib/database";
import type { Employee, ProductionLog } from "@/lib/database";
import { exportAndShareCSV, formatDate } from "@/lib/exportCsv";

function EmployeeDropdown({
  employees,
  selected,
  onSelect,
}: {
  employees: Employee[];
  selected: Employee | null;
  onSelect: (e: Employee) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={ddStyles.label}>QC Employee</Text>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen(!open)}>
        <Text style={selected ? ddStyles.selected : ddStyles.placeholder}>
          {selected ? selected.name : "Select QC Employee"}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={ddStyles.list}>
          {employees.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[ddStyles.option, selected?.id === e.id && ddStyles.optionActive]}
              onPress={() => {
                onSelect(e);
                setOpen(false);
              }}
            >
              <Text style={[ddStyles.optionText, selected?.id === e.id && ddStyles.optionTextActive]}>
                {e.name} ({e.code})
              </Text>
              {selected?.id === e.id && <Ionicons name="checkmark" size={16} color={COLORS.secondary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const ddStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trigger: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  selected: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: COLORS.text,
  },
  placeholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
  },
  list: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  option: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  optionActive: {
    backgroundColor: COLORS.secondary + "22",
  },
  optionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: COLORS.text,
  },
  optionTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: COLORS.secondary,
  },
});

export default function QCScreen() {
  const insets = useSafeAreaInsets();
  const { employees, productionLogs, qcLogs, refreshQC } = useApp();

  const [selectedLog, setSelectedLog] = useState<ProductionLog | null>(null);
  const [qcEmployee, setQcEmployee] = useState<Employee | null>(null);
  const [serialInputs, setSerialInputs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const pendingLogs = productionLogs.filter((p) => p.status === "qc_pending");
  const doneQCLogs = qcLogs.filter((q) => q.status === "passed");

  const openQCForm = (log: ProductionLog) => {
    setSelectedLog(log);
    setSerialInputs(log.serialNumbers.map((sn) => sn));
    setQcEmployee(null);
  };

  const handleSubmitQC = async () => {
    if (!qcEmployee) {
      Alert.alert("Error", "Please select QC employee");
      return;
    }
    if (!selectedLog) return;
    const filled = serialInputs.filter((s) => s.trim() !== "");
    if (filled.length === 0) {
      Alert.alert("Error", "Enter at least one serial number");
      return;
    }
    setSubmitting(true);
    try {
      await addQCLog(selectedLog, qcEmployee, serialInputs);
      await refreshQC();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedLog(null);
      setQcEmployee(null);
      setSerialInputs([]);
    } catch {
      Alert.alert("Error", "Failed to submit QC");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (showDone) {
      const headers = ["Product", "Machine", "Quantity", "Serial Numbers", "QC Date"];
      const rows = doneQCLogs.map((q) => [
        q.productName,
        q.machineName,
        String(q.quantity),
        q.serialNumbers.join(", "),
        formatDate(q.checkedAt),
      ]);
      await exportAndShareCSV("qc_report.csv", headers, rows);
    } else {
      const headers = ["Machine", "Employee", "Quantity", "Serial Numbers", "Production Date"];
      const rows = pendingLogs.map((p) => [
        p.machineName,
        p.employeeName,
        String(p.quantity),
        p.serialNumbers.join(", "),
        formatDate(p.completedAt),
      ]);
      await exportAndShareCSV("qc_pending.csv", headers, rows);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quality Check</Text>
          <Text style={styles.subtitle}>{pendingLogs.length} pending</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
            <Ionicons name="share-outline" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, !showDone && styles.tabBtnActive]}
          onPress={() => setShowDone(false)}
        >
          <Ionicons name="time-outline" size={16} color={!showDone ? COLORS.warning : COLORS.textSecondary} />
          <Text style={[styles.tabText, !showDone && { color: COLORS.warning }]}>
            Pending ({pendingLogs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, showDone && styles.tabBtnActive]}
          onPress={() => setShowDone(true)}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={showDone ? COLORS.secondary : COLORS.textSecondary} />
          <Text style={[styles.tabText, showDone && { color: COLORS.secondary }]}>
            Passed ({doneQCLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {!showDone ? (
        <FlatList
          data={pendingLogs}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No pending QC</Text>
              <Text style={styles.emptyText}>Production complete items appear here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pendingCard} onPress={() => openQCForm(item)}>
              <View style={styles.pendingLeft}>
                <View style={styles.pendingIcon}>
                  <Ionicons name="settings-outline" size={20} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingMachine}>{item.machineName}</Text>
                  <Text style={styles.pendingMeta}>{item.employeeName} • {formatDate(item.completedAt)}</Text>
                  <View style={styles.serialPreview}>
                    {item.serialNumbers.slice(0, 3).map((sn, i) => (
                      <View key={i} style={styles.serialTag}>
                        <Text style={styles.serialTagText}>{sn}</Text>
                      </View>
                    ))}
                    {item.serialNumbers.length > 3 && (
                      <Text style={styles.serialMore}>+{item.serialNumbers.length - 3} more</Text>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.pendingRight}>
                <Text style={styles.pendingQty}>{item.quantity}</Text>
                <View style={styles.qcBtn}>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.warning} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={doneQCLogs.slice().reverse()}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No QC passed items</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.doneCard}>
              <View style={styles.doneHeader}>
                <View style={styles.doneIconWrapper}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doneName}>{item.productName}</Text>
                  <Text style={styles.doneMeta}>{formatDate(item.checkedAt)} • Qty: {item.quantity}</Text>
                </View>
              </View>
              <View style={styles.doneSerials}>
                {item.serialNumbers.map((sn, i) => (
                  <View key={i} style={styles.doneSerialTag}>
                    <Text style={styles.doneSerialText}>{sn}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!selectedLog} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>QC Check</Text>
              <TouchableOpacity onPress={() => setSelectedLog(null)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedLog && (
              <>
                <View style={styles.qcInfo}>
                  <Text style={styles.qcInfoText}>{selectedLog.machineName}</Text>
                  <Text style={styles.qcInfoMeta}>
                    Produced by {selectedLog.employeeName} • Qty: {selectedLog.quantity}
                  </Text>
                </View>

                <EmployeeDropdown employees={employees} selected={qcEmployee} onSelect={setQcEmployee} />

                {qcEmployee && (
                  <>
                    <Text style={ddStyles.label}>Serial Numbers (auto-formatted)</Text>
                    <View style={styles.snPreview}>
                      {serialInputs.map((sn, i) => (
                        <View key={i} style={styles.snPreviewTag}>
                          <Text style={styles.snPreviewText}>
                            {sn}-{qcEmployee.code}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.snHint}>
                      Serial numbers will be formatted as: [number]-{qcEmployee.code}
                    </Text>
                  </>
                )}

                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  {serialInputs.map((sn, idx) => (
                    <View key={idx} style={styles.serialRow}>
                      <View style={styles.serialIndex}>
                        <Text style={styles.serialIndexText}>{idx + 1}</Text>
                      </View>
                      <TextInput
                        style={styles.serialInput}
                        placeholder={`Serial #${idx + 1}`}
                        placeholderTextColor={COLORS.textMuted}
                        value={sn}
                        onChangeText={(val) => {
                          const updated = [...serialInputs];
                          updated[idx] = val;
                          setSerialInputs(updated);
                        }}
                      />
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitQC} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitText}>Mark QC Passed</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 9,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: COLORS.surfaceLight,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 100,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  pendingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.warning + "44",
  },
  pendingLeft: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  pendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.warning + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingMachine: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  pendingMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  serialPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  serialTag: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  serialTagText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  serialMore: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
    alignSelf: "center",
  },
  pendingRight: {
    alignItems: "center",
    gap: 6,
  },
  pendingQty: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
  qcBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.warning + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  doneCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.secondary + "44",
  },
  doneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  doneIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.secondary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  doneName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  doneMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  doneSerials: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  doneSerialTag: {
    backgroundColor: COLORS.secondary + "22",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneSerialText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
  qcInfo: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  qcInfoText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  qcInfoMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  snPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  snPreviewTag: {
    backgroundColor: COLORS.secondary + "22",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.secondary + "44",
  },
  snPreviewText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.secondary,
  },
  snHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  serialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  serialIndex: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.secondary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  serialIndexText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.secondary,
  },
  serialInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  submitBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.white,
  },
});
