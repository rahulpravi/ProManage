import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  FlatList,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { addMaterialRequest, addProductionLog } from "@/lib/database";
import type { Employee, Machine, StockItem } from "@/lib/database";
import { exportAndShareCSV, formatDate } from "@/lib/exportCsv";

type ActiveTab = "request" | "complete";

function Dropdown<T extends { id: string }>({
  label,
  items,
  selected,
  onSelect,
  getLabel,
}: {
  label: string;
  items: T[];
  selected: T | null;
  onSelect: (item: T) => void;
  getLabel: (item: T) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={ddStyles.label}>{label}</Text>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen(!open)}>
        <Text style={selected ? ddStyles.selected : ddStyles.placeholder}>
          {selected ? getLabel(selected) : `Select ${label}`}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={ddStyles.list}>
          {items.length === 0 ? (
            <View style={ddStyles.emptyOption}>
              <Text style={ddStyles.emptyOptionText}>No items available</Text>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[ddStyles.option, selected?.id === item.id && ddStyles.optionActive]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text style={[ddStyles.optionText, selected?.id === item.id && ddStyles.optionTextActive]}>
                  {getLabel(item)}
                </Text>
                {selected?.id === item.id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
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
  optionActive: { backgroundColor: COLORS.primary + "22" },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text },
  optionTextActive: { fontFamily: "Inter_600SemiBold", color: COLORS.primaryLight },
  emptyOption: { padding: 14, alignItems: "center" },
  emptyOptionText: { fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.textMuted },
});

export default function ProductionScreen() {
  const insets = useSafeAreaInsets();
  const { employees, machines, stock, materialRequests, productionLogs, refreshProduction, refreshStock } = useApp();

  const [activeTab, setActiveTab] = useState<ActiveTab>("request");
  const [showFormModal, setShowFormModal] = useState(false); // Modal for adding new entry

  // Form States
  const [reqEmployee, setReqEmployee] = useState<Employee | null>(null);
  const [reqMachine, setReqMachine] = useState<Machine | null>(null);
  const [reqPart, setReqPart] = useState<StockItem | null>(null);
  const [reqSubmitting, setReqSubmitting] = useState(false);

  const [compEmployee, setCompEmployee] = useState<Employee | null>(null);
  const [compMachine, setCompMachine] = useState<Machine | null>(null);
  const [compSubmitting, setCompSubmitting] = useState(false);

  // Auto-Update Serial & Quantity Logic
  const [currentSerial, setCurrentSerial] = useState("");
  const [addedSerials, setAddedSerials] = useState<string[]>([]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const filteredStock = reqMachine
    ? stock.filter((s) => s.machineCategory === reqMachine.category && s.quantity > 0)
    : stock.filter((s) => s.quantity > 0);

  // Add a single serial number
  const handleAddSerial = () => {
    if (!currentSerial.trim()) return;
    if (addedSerials.includes(currentSerial.trim())) {
      Alert.alert("Error", "This Serial Number is already added.");
      return;
    }
    setAddedSerials([...addedSerials, currentSerial.trim()]);
    setCurrentSerial(""); // Clear input
  };

  // Remove a serial number
  const handleRemoveSerial = (serial: string) => {
    setAddedSerials(addedSerials.filter((s) => s !== serial));
  };

  const handleMaterialRequest = async () => {
    if (!reqEmployee || !reqMachine || !reqPart) {
      Alert.alert("Error", "Please select all fields");
      return;
    }
    const qty = addedSerials.length;
    if (qty <= 0) {
      Alert.alert("Error", "Please add at least one Serial Number");
      return;
    }
    if (qty > reqPart.quantity) {
      Alert.alert("Insufficient Stock", `Only ${reqPart.quantity} units available`);
      return;
    }
    setReqSubmitting(true);
    try {
      const result = await addMaterialRequest(reqEmployee, reqMachine, reqPart, qty, addedSerials);
      if (!result) {
        Alert.alert("Error", "Insufficient stock");
        return;
      }
      await Promise.all([refreshProduction(), refreshStock()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReqEmployee(null);
      setReqMachine(null);
      setReqPart(null);
      setAddedSerials([]);
      setShowFormModal(false); // Close Modal
      Alert.alert("Success", "Material request submitted");
    } catch {
      Alert.alert("Error", "Failed to submit request");
    } finally {
      setReqSubmitting(false);
    }
  };

  const handleProductionComplete = async () => {
    if (!compEmployee || !compMachine) {
      Alert.alert("Error", "Please select employee and machine");
      return;
    }
    const qty = addedSerials.length;
    if (qty <= 0) {
      Alert.alert("Error", "Please add at least one Serial Number");
      return;
    }
    setCompSubmitting(true);
    try {
      await addProductionLog(compEmployee, compMachine, qty, addedSerials);
      await refreshProduction();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCompEmployee(null);
      setCompMachine(null);
      setAddedSerials([]);
      setShowFormModal(false); // Close Modal
      Alert.alert("Success", "Production log saved");
    } catch {
      Alert.alert("Error", "Failed to save production log");
    } finally {
      setCompSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (activeTab === "request") {
      const headers = ["Employee", "Machine", "Part", "Quantity", "Serial Numbers", "Date"];
      const rows = materialRequests.map((r) => [
        r.employeeName, r.machineName, r.partName,
        String(r.quantity), (r.serialNumbers || []).join(", "), formatDate(r.requestedAt),
      ]);
      await exportAndShareCSV("material_requests.csv", headers, rows);
    } else {
      const headers = ["Employee", "Machine", "Quantity", "Serial Numbers", "Date"];
      const rows = productionLogs.map((p) => [
        p.employeeName, p.machineName, String(p.quantity),
        p.serialNumbers.join(", "), formatDate(p.completedAt),
      ]);
      await exportAndShareCSV("production_logs.csv", headers, rows);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Production</Text>
          <Text style={styles.subtitle}>{productionLogs.length} logs</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
            <Ionicons name="share-outline" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
          {/* Add Button -> Opens Modal */}
          <TouchableOpacity style={styles.addBtn} onPress={() => { setAddedSerials([]); setShowFormModal(true); }}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(["request", "complete"] as ActiveTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Ionicons
              name={t === "request" ? "cart-outline" : "checkmark-circle-outline"}
              size={16}
              color={activeTab === t ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "request" ? "Material Request" : "Production Complete"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main List (Always visible now) */}
      {activeTab === "request" ? (
        <FlatList
          data={materialRequests.slice().reverse()}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No records yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <View style={[styles.historyIcon, { backgroundColor: COLORS.primary + "22" }]}>
                  <Ionicons name="cart-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{item.partName}</Text>
                  <Text style={styles.historyMeta}>{item.employeeName} • {item.machineName}</Text>
                  {(item.serialNumbers || []).length > 0 && (
                    <Text style={styles.historySerials} numberOfLines={1}>
                      SN: {(item.serialNumbers || []).join(", ")}
                    </Text>
                  )}
                  <Text style={styles.historyDate}>{formatDate(item.requestedAt)}</Text>
                </View>
              </View>
              <View style={styles.historyQty}>
                <Text style={styles.historyQtyText}>{item.quantity}</Text>
                <Text style={styles.historyQtyLabel}>qty</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={productionLogs.slice().reverse()}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No records yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <View style={[styles.historyIcon, { backgroundColor: COLORS.secondary + "22" }]}>
                  <Ionicons name="settings-outline" size={18} color={COLORS.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{item.machineName}</Text>
                  <Text style={styles.historyMeta}>{item.employeeName}</Text>
                  <Text style={styles.historySerials} numberOfLines={1}>
                    SN: {item.serialNumbers.join(", ")}
                  </Text>
                  <Text style={styles.historyDate}>{formatDate(item.completedAt)}</Text>
                </View>
              </View>
              <View style={styles.historyQty}>
                <Text style={styles.historyQtyText}>{item.quantity}</Text>
                <Text style={styles.historyQtyLabel}>qty</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Form Modal */}
      <Modal visible={showFormModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeTab === "request" ? "New Material Request" : "New Production Log"}
              </Text>
              <TouchableOpacity onPress={() => setShowFormModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {activeTab === "request" ? (
                <>
                  <Dropdown
                    label="Employee"
                    items={employees}
                    selected={reqEmployee}
                    onSelect={setReqEmployee}
                    getLabel={(e) => e.name}
                  />
                  <Dropdown
                    label="Machine"
                    items={machines}
                    selected={reqMachine}
                    onSelect={(m) => { setReqMachine(m); setReqPart(null); }}
                    getLabel={(m) => m.name}
                  />
                  <Dropdown
                    label="Part"
                    items={filteredStock}
                    selected={reqPart}
                    onSelect={setReqPart}
                    getLabel={(p) => `${p.partName} (${p.quantity} available)`}
                  />

                  {/* Serial Number & Auto Quantity Block */}
                  <View style={styles.serialBlock}>
                    <View style={styles.qtyHeader}>
                      <Text style={ddStyles.label}>Total Quantity</Text>
                      <Text style={styles.autoQty}>{addedSerials.length}</Text>
                    </View>
                    
                    {addedSerials.length > 0 && (
                      <View style={styles.serialsList}>
                        {addedSerials.map((sn, idx) => (
                          <TouchableOpacity key={idx} style={styles.serialTag} onPress={() => handleRemoveSerial(sn)}>
                            <Text style={styles.serialTagText}>{sn}</Text>
                            <Ionicons name="close-circle" size={14} color={COLORS.danger} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View style={styles.addSerialRow}>
                      <TextInput
                        style={styles.serialInput}
                        placeholder="Enter Serial Number"
                        placeholderTextColor={COLORS.textMuted}
                        value={currentSerial}
                        onChangeText={setCurrentSerial}
                      />
                      <TouchableOpacity style={styles.addSerialBtn} onPress={handleAddSerial}>
                        <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.submitBtn} onPress={handleMaterialRequest} disabled={reqSubmitting}>
                    {reqSubmitting ? <ActivityIndicator color={COLORS.white} /> : (
                      <Text style={styles.submitText}>Submit Request</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Dropdown
                    label="Employee"
                    items={employees}
                    selected={compEmployee}
                    onSelect={setCompEmployee}
                    getLabel={(e) => e.name}
                  />
                  <Dropdown
                    label="Machine"
                    items={machines}
                    selected={compMachine}
                    onSelect={setCompMachine}
                    getLabel={(m) => m.name}
                  />

                  {/* Serial Number & Auto Quantity Block */}
                  <View style={styles.serialBlock}>
                    <View style={styles.qtyHeader}>
                      <Text style={ddStyles.label}>Total Quantity</Text>
                      <Text style={[styles.autoQty, { color: COLORS.secondary }]}>{addedSerials.length}</Text>
                    </View>
                    
                    {addedSerials.length > 0 && (
                      <View style={styles.serialsList}>
                        {addedSerials.map((sn, idx) => (
                          <TouchableOpacity key={idx} style={styles.serialTag} onPress={() => handleRemoveSerial(sn)}>
                            <Text style={styles.serialTagText}>{sn}</Text>
                            <Ionicons name="close-circle" size={14} color={COLORS.danger} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View style={styles.addSerialRow}>
                      <TextInput
                        style={styles.serialInput}
                        placeholder="Enter Serial Number"
                        placeholderTextColor={COLORS.textMuted}
                        value={currentSerial}
                        onChangeText={setCurrentSerial}
                      />
                      <TouchableOpacity style={[styles.addSerialBtn, { backgroundColor: COLORS.secondary }]} onPress={handleAddSerial}>
                        <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: COLORS.secondary }]} onPress={handleProductionComplete} disabled={compSubmitting}>
                    {compSubmitting ? <ActivityIndicator color={COLORS.white} /> : (
                      <Text style={styles.submitText}>Mark Production Complete</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
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
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
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
  tabBtnActive: { backgroundColor: COLORS.primary + "22" },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primaryLight, fontFamily: "Inter_600SemiBold" },
  
  // Modal Styles
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
  
  // Serial Logic Styles
  serialBlock: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16,
  },
  qtyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  autoQty: { fontSize: 24, fontFamily: "Inter_700Bold", color: COLORS.primary },
  serialsList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  serialTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.danger + "22", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  serialTagText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.danger },
  addSerialRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  serialInput: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 10, padding: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  addSerialBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, alignItems: "center", marginTop: 4,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.white },
  
  // List Styles
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 120, // Bottom navigation padding
  },
  historyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  historyLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  historyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  historyName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  historyMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  historySerials: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textMuted, marginTop: 2 },
  historyDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textMuted, marginTop: 2 },
  historyQty: { alignItems: "center" },
  historyQtyText: { fontSize: 22, fontFamily: "Inter_700Bold", color: COLORS.text },
  historyQtyLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textMuted },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
});
