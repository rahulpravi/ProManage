import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  SectionList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { addQCLog, addQCLogDirect } from "@/lib/database";
import type { Employee, ProductionLog } from "@/lib/database";
import { exportAndShareCSV, formatDate } from "@/lib/exportCsv";

function EmpDropdown({
  employees,
  selected,
  onSelect,
  accentColor = COLORS.secondary,
}: {
  employees: Employee[];
  selected: Employee | null;
  onSelect: (e: Employee) => void;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={ddStyles.label}>QC Employee</Text>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen(!open)}>
        <Text style={selected ? ddStyles.selected : ddStyles.placeholder}>
          {selected ? `${selected.name} (${selected.code})` : "Select Employee"}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={ddStyles.list}>
          {employees.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[ddStyles.option, selected?.id === e.id && { backgroundColor: accentColor + "22" }]}
              onPress={() => { onSelect(e); setOpen(false); }}
            >
              <Text style={[ddStyles.optionText, selected?.id === e.id && { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                {e.name} ({e.code})
              </Text>
              {selected?.id === e.id && <Ionicons name="checkmark" size={16} color={accentColor} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function ProdLogDropdown({
  logs,
  selected,
  onSelect,
}: {
  logs: ProductionLog[];
  selected: ProductionLog | null;
  onSelect: (p: ProductionLog) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={ddStyles.label}>Production Batch</Text>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen(!open)}>
        <Text style={selected ? ddStyles.selected : ddStyles.placeholder}>
          {selected ? `${selected.machineName} · Qty ${selected.quantity}` : "Select batch"}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={ddStyles.list}>
          {logs.length === 0 ? (
            <View style={ddStyles.emptyOpt}>
              <Text style={ddStyles.emptyOptText}>No pending batches</Text>
            </View>
          ) : (
            logs.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[ddStyles.option, selected?.id === p.id && ddStyles.optionActive]}
                onPress={() => { onSelect(p); setOpen(false); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[ddStyles.optionText, selected?.id === p.id && ddStyles.optionTextActive]}>
                    {p.machineName} · {p.employeeName}
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "Inter_400Regular" }}>
                    Qty: {p.quantity} · {formatDate(p.completedAt)}
                  </Text>
                </View>
                {selected?.id === p.id && <Ionicons name="checkmark" size={16} color={COLORS.warning} />}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const ddStyles = StyleSheet.create({
  label: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.textSecondary,
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
  },
  trigger: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  selected: { fontSize: 15, fontFamily: "Inter_500Medium", color: COLORS.text },
  placeholder: { fontSize: 15, fontFamily: "Inter_400Regular", color: COLORS.textMuted },
  list: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.cardBorder, overflow: "hidden",
  },
  option: {
    padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  optionActive: { backgroundColor: COLORS.warning + "22" },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text },
  optionTextActive: { fontFamily: "Inter_600SemiBold", color: COLORS.warning },
  emptyOpt: { padding: 14, alignItems: "center" },
  emptyOptText: { fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.textMuted },
});

export default function QCScreen() {
  const insets = useSafeAreaInsets();
  const { employees, productionLogs, qcLogs, refreshQC } = useApp();

  const [selectedLog, setSelectedLog] = useState<ProductionLog | null>(null);
  const [qcEmployee, setQcEmployee] = useState<Employee | null>(null);
  const [serialInputs, setSerialInputs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directEmployee, setDirectEmployee] = useState<Employee | null>(null);
  const [directProdLog, setDirectProdLog] = useState<ProductionLog | null>(null);
  const [selectedDirectSerials, setSelectedDirectSerials] = useState<string[]>([]);
  const [directSubmitting, setDirectSubmitting] = useState(false);

  // New State for recording New Labels
  const [newLabels, setNewLabels] = useState<Record<string, string>>({});

  // Success Popup State
  const [showSuccess, setShowSuccess] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const pendingLogs = productionLogs.filter((p) => p.status === "qc_pending");
  const doneQCLogs = qcLogs.filter((q) => q.status === "passed");

  const groupedPendingLogs = useMemo(() => {
    const groups: Record<string, typeof pendingLogs> = {};
    pendingLogs.forEach((log) => {
      if (!groups[log.machineName]) groups[log.machineName] = [];
      groups[log.machineName].push(log);
    });
    return Object.keys(groups).map((key) => ({ title: key, data: groups[key] }));
  }, [pendingLogs]);

  const groupedDoneLogs = useMemo(() => {
    const groups: Record<string, typeof doneQCLogs> = {};
    doneQCLogs.forEach((log) => {
      if (!groups[log.machineName]) groups[log.machineName] = [];
      groups[log.machineName].push(log);
    });
    return Object.keys(groups).map((key) => ({ title: key, data: groups[key] }));
  }, [doneQCLogs]);

  const openQCForm = (log: ProductionLog) => {
    setSelectedLog(log);
    setSerialInputs(log.serialNumbers.map((sn) => sn));
    setQcEmployee(null);
    setNewLabels({}); // Clear old labels
  };

  const handleSubmitQC = async () => {
    if (!qcEmployee || !selectedLog) return;
    
    setSubmitting(true);
    try {
      // Format serials as "OldSN ➔ NewLabel"
      const finalSerials = serialInputs.map(sn => {
        const newLbl = newLabels[sn]?.trim();
        return newLbl ? `${sn} ➔ ${newLbl}` : sn;
      });

      await addQCLog(selectedLog, qcEmployee, finalSerials);
      await refreshQC();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedLog(null);
        setQcEmployee(null);
        setSerialInputs([]);
        setNewLabels({});
      }, 1500);

    } catch {
      Alert.alert("Error", "Failed to submit QC");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDirectSerial = (sn: string) => {
    setSelectedDirectSerials((prev) =>
      prev.includes(sn) ? prev.filter((s) => s !== sn) : [...prev, sn]
    );
  };

  const handleDirectSubmit = async () => {
    if (!directEmployee) {
      Alert.alert("Error", "Please select a QC employee");
      return;
    }
    if (!directProdLog) {
      Alert.alert("Error", "Please select a production batch");
      return;
    }
    if (selectedDirectSerials.length === 0) {
      Alert.alert("Error", "Please select at least one serial number");
      return;
    }
    setDirectSubmitting(true);
    try {
      // Format serials as "OldSN ➔ NewLabel"
      const finalSerials = selectedDirectSerials.map(sn => {
        const newLbl = newLabels[sn]?.trim();
        return newLbl ? `${sn} ➔ ${newLbl}` : sn;
      });

      await addQCLogDirect(directEmployee, directProdLog, finalSerials);
      await refreshQC();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowDirectModal(false);
        setDirectEmployee(null);
        setDirectProdLog(null);
        setSelectedDirectSerials([]);
        setNewLabels({});
      }, 1500);

    } catch {
      Alert.alert("Error", "Failed to add QC entry");
    } finally {
      setDirectSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (showDone) {
      const headers = ["Product", "Machine", "Quantity", "Serial Numbers & Labels", "QC Date"];
      const rows = doneQCLogs.map((q) => [
        q.productName, q.machineName, String(q.quantity),
        q.serialNumbers.join(", "), formatDate(q.checkedAt),
      ]);
      await exportAndShareCSV("qc_report.csv", headers, rows);
    } else {
      const headers = ["Machine", "Employee", "Quantity", "Serial Numbers", "Production Date"];
      const rows = pendingLogs.map((p) => [
        p.machineName, p.employeeName, String(p.quantity),
        p.serialNumbers.join(", "), formatDate(p.completedAt),
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
          <TouchableOpacity 
            style={styles.addBtn} 
            onPress={() => {
              setDirectEmployee(null);
              setDirectProdLog(null);
              setSelectedDirectSerials([]);
              setNewLabels({});
              setShowDirectModal(true);
            }}
          >
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, !showDone && styles.tabBtnActive]} onPress={() => setShowDone(false)}>
          <Ionicons name="time-outline" size={16} color={!showDone ? COLORS.warning : COLORS.textSecondary} />
          <Text style={[styles.tabText, !showDone && { color: COLORS.warning }]}>Pending ({pendingLogs.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, showDone && styles.tabBtnActive]} onPress={() => setShowDone(true)}>
          <Ionicons name="checkmark-circle-outline" size={16} color={showDone ? COLORS.secondary : COLORS.textSecondary} />
          <Text style={[styles.tabText, showDone && { color: COLORS.secondary }]}>Passed ({doneQCLogs.length})</Text>
        </TouchableOpacity>
      </View>

      {!showDone ? (
        <SectionList
          sections={groupedPendingLogs}
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
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Ionicons name="hardware-chip" size={16} color={COLORS.warning} />
              <Text style={[styles.sectionTitle, { color: COLORS.warning }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pendingCard} onPress={() => openQCForm(item)}>
              <View style={styles.pendingLeft}>
                <View style={styles.pendingIcon}>
                  <Ionicons name="settings-outline" size={20} color={COLORS.warning} />
                </View>
                <View style={{ flex: 1 }}>
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
                <View style={styles.qcArrowBtn}>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.warning} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <SectionList
          sections={groupedDoneLogs}
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
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Ionicons name="hardware-chip" size={16} color={COLORS.secondary} />
              <Text style={[styles.sectionTitle, { color: COLORS.secondary }]}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.doneCard}>
              <View style={styles.doneHeader}>
                <View style={styles.doneIconWrapper}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.secondary} />
                </View>
                <View style={{ flex: 1 }}>
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

      {/* QC Form from Pending List */}
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
                <EmpDropdown employees={employees} selected={qcEmployee} onSelect={setQcEmployee} />
                
                <Text style={ddStyles.label}>Add New Label / Box No. (Optional)</Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {serialInputs.map((sn, idx) => (
                    <View key={idx} style={styles.serialRow}>
                      <View style={[styles.serialIndex, { backgroundColor: COLORS.warning + "22" }]}>
                        <Text style={[styles.serialIndexText, { color: COLORS.warning }]}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.oldSnText}>Orig SN: {sn}</Text>
                        <TextInput
                          style={styles.serialInput}
                          placeholder="Enter New Label"
                          placeholderTextColor={COLORS.textMuted}
                          value={newLabels[sn] || ""}
                          onChangeText={(val) => setNewLabels(prev => ({...prev, [sn]: val}))}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitQC} disabled={submitting}>
                  {submitting ? <ActivityIndicator color={COLORS.white} /> : (
                    <Text style={styles.submitText}>Mark QC Passed</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Direct Add Modal */}
      <Modal visible={showDirectModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Passed Entry</Text>
                <TouchableOpacity onPress={() => setShowDirectModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <EmpDropdown
                employees={employees}
                selected={directEmployee}
                onSelect={(e) => { setDirectEmployee(e); setSelectedDirectSerials([]); setNewLabels({}); }}
                accentColor={COLORS.secondary}
              />

              <ProdLogDropdown
                logs={pendingLogs}
                selected={directProdLog}
                onSelect={(p) => { setDirectProdLog(p); setSelectedDirectSerials([]); setNewLabels({}); }}
              />

              {directProdLog && (
                <>
                  <Text style={ddStyles.label}>
                    Select Serial Numbers ({selectedDirectSerials.length} selected)
                  </Text>
                  <View style={styles.serialCheckList}>
                    {directProdLog.serialNumbers.map((sn) => {
                      const checked = selectedDirectSerials.includes(sn);
                      return (
                        <View key={sn} style={[styles.serialCheckItem, checked && styles.serialCheckItemActive, { flexDirection: 'column', alignItems: 'stretch' }]}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                            onPress={() => toggleDirectSerial(sn)}
                          >
                            <Ionicons
                              name={checked ? "checkbox" : "square-outline"}
                              size={18}
                              color={checked ? COLORS.secondary : COLORS.textMuted}
                            />
                            <Text style={[styles.serialCheckText, checked && { color: COLORS.secondary }]}>
                              {sn}
                            </Text>
                          </TouchableOpacity>
                          
                          {/* Show New Label input only if checked */}
                          {checked && (
                            <TextInput
                              style={[styles.serialInput, { marginTop: 10 }]}
                              placeholder="Enter New Label (Optional)"
                              placeholderTextColor={COLORS.textMuted}
                              value={newLabels[sn] || ""}
                              onChangeText={(val) => setNewLabels(prev => ({...prev, [sn]: val}))}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ height: 12 }} />
                </>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: COLORS.secondary }]}
                onPress={handleDirectSubmit}
                disabled={directSubmitting}
              >
                {directSubmitting ? <ActivityIndicator color={COLORS.white} /> : (
                  <Text style={styles.submitText}>
                    Add {selectedDirectSerials.length} Item{selectedDirectSerials.length !== 1 ? "s" : ""} as Passed
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Success Popup Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={72} color={COLORS.secondary} />
            <Text style={styles.successTitle}>QC Done!</Text>
            <Text style={styles.successText}>QC logged successfully</Text>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: COLORS.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.secondary, alignItems: "center", justifyContent: "center",
  },
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
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.textSecondary },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 120,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  pendingCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: COLORS.warning + "44",
  },
  pendingLeft: { flexDirection: "row", gap: 12, flex: 1 },
  pendingIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.warning + "22", alignItems: "center", justifyContent: "center",
  },
  pendingMeta: { fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.text, marginTop: 2 },
  serialPreview: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  serialTag: { backgroundColor: COLORS.surfaceLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  serialTagText: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  serialMore: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textMuted, alignSelf: "center" },
  pendingRight: { alignItems: "center", gap: 6 },
  pendingQty: { fontSize: 22, fontFamily: "Inter_700Bold", color: COLORS.text },
  qcArrowBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.warning + "22", alignItems: "center", justifyContent: "center",
  },
  doneCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.secondary + "44",
  },
  doneHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  doneIconWrapper: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.secondary + "22", alignItems: "center", justifyContent: "center",
  },
  doneMeta: { fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.text, marginTop: 2 },
  doneSerials: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  doneSerialTag: { backgroundColor: COLORS.secondary + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  doneSerialText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.secondary },
  
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
    alignItems: "center", marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: COLORS.text },
  qcInfo: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  qcInfoText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  qcInfoMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 4 },
  snPreview: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  snPreviewTag: {
    backgroundColor: COLORS.secondary + "22", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.secondary + "44",
  },
  snPreviewText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.secondary },
  serialRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  serialIndex: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 4 },
  serialIndexText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  oldSnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.text, marginBottom: 6, marginLeft: 2 },
  serialInput: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  serialCheckList: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 4,
  },
  serialCheckItem: {
    padding: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  serialCheckItemActive: { backgroundColor: COLORS.secondary + "11" },
  serialCheckText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text, flex: 1 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 12 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.white },
  
  successOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },
  successCard: {
    backgroundColor: COLORS.surface, padding: 30, borderRadius: 24, alignItems: "center",
    gap: 12, borderWidth: 1, borderColor: COLORS.cardBorder, width: "70%",
  },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: COLORS.text, marginTop: 8 },
  successText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, textAlign: "center" },
});
