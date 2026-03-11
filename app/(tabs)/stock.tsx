import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  SectionList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { addStock, DEFAULT_MACHINES, MACHINE_PARTS } from "@/lib/database";
import { exportAndShareCSV, formatDate } from "@/lib/exportCsv";

function SimpleDropdown({
  label,
  options,
  selected,
  onSelect,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={ddStyles.label}>{label}</Text>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen(!open)}>
        <Text style={selected ? ddStyles.selected : ddStyles.placeholder}>
          {selected || placeholder || `Select ${label}`}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={ddStyles.list}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[ddStyles.option, selected === opt && ddStyles.optionActive]}
              onPress={() => {
                onSelect(opt);
                setOpen(false);
              }}
            >
              <Text style={[ddStyles.optionText, selected === opt && ddStyles.optionTextActive]}>{opt}</Text>
              {selected === opt && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
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
  selected: { fontSize: 15, fontFamily: "Inter_500Medium", color: COLORS.text },
  placeholder: { fontSize: 15, fontFamily: "Inter_400Regular", color: COLORS.textMuted },
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
  optionActive: { backgroundColor: COLORS.primary + "22" },
  optionText: { fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text },
  optionTextActive: { fontFamily: "Inter_600SemiBold", color: COLORS.primaryLight },
});

export default function StockScreen() {
  const insets = useSafeAreaInsets();
  const { stock, isLoading, refreshStock } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // Success popup state
  const [selectedMachine, setSelectedMachine] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState("");

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const machineOptions = DEFAULT_MACHINES.map((m) => m.name);
  const partOptions = selectedMachine ? (MACHINE_PARTS[selectedMachine] ?? []) : [];

  const filtered = stock.filter(
    (s) =>
      s.partName.toLowerCase().includes(searchText.toLowerCase()) ||
      s.machineCategory.toLowerCase().includes(searchText.toLowerCase())
  );

  const groupedData = useMemo(() => {
    const groups: Record<string, typeof stock> = {};
    filtered.forEach((item) => {
      if (!groups[item.machineCategory]) {
        groups[item.machineCategory] = [];
      }
      groups[item.machineCategory].push(item);
    });
    return Object.keys(groups).map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [filtered]);

  const resetForm = () => {
    setSelectedMachine("");
    setSelectedPart("");
    setQuantity("");
  };

  const handleAdd = async () => {
    if (!selectedMachine) {
      Alert.alert("Error", "Please select a machine");
      return;
    }
    if (!selectedPart) {
      Alert.alert("Error", "Please select a part");
      return;
    }
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      Alert.alert("Error", "Enter a valid quantity");
      return;
    }
    setSubmitting(true);
    try {
      await addStock(selectedPart, selectedMachine, qty);
      await refreshStock();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success modal
      setShowSuccess(true);
      
      // Auto close after 1.5 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setShowModal(false);
        resetForm();
      }, 1500);

    } catch {
      Alert.alert("Error", "Failed to add stock");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    const headers = ["Part Serial Number", "Part Name", "Machine Category", "Quantity", "Last Updated"];
    
    const rows = stock.map((s) => {
      let serialNumber = s.partName;
      let partName = "";
      
      const match = s.partName.match(/^(.+?)\s*\((.+)\)$/);
      if (match) {
        serialNumber = match[1].trim(); 
        partName = match[2].trim();     
      }

      return [serialNumber, partName, s.machineCategory, String(s.quantity), formatDate(s.updatedAt)];
    });
    
    await exportAndShareCSV("stock_report.csv", headers, rows);
  };

  const getStockColor = (qty: number) => {
    if (qty === 0) return COLORS.danger;
    if (qty <= 5) return COLORS.warning;
    return COLORS.secondary;
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Stock</Text>
          <Text style={styles.subtitle}>{stock.length} part types</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleExport}>
            <Ionicons name="share-outline" size={20} color={COLORS.primaryLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setShowModal(true); }}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search parts..."
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : groupedData.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No stock items</Text>
          <Text style={styles.emptyText}>Add parts using the + button</Text>
        </View>
      ) : (
        <SectionList
          sections={groupedData}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          ListFooterComponent={<View style={{ height: 130 }} />} 
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Ionicons name="hardware-chip" size={16} color={COLORS.primaryLight} />
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.stockCard}>
              <View style={styles.stockLeft}>
                <View style={[styles.stockDot, { backgroundColor: getStockColor(item.quantity) }]} />
                <View>
                  <Text style={styles.partName}>{item.partName}</Text>
                </View>
              </View>
              <View style={styles.stockRight}>
                <Text style={[styles.qtyBig, { color: getStockColor(item.quantity) }]}>{item.quantity}</Text>
                <Text style={styles.qtyLabel}>units</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Main Add Stock Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Stock</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <SimpleDropdown
              label="Machine"
              options={machineOptions}
              selected={selectedMachine}
              onSelect={(val) => { setSelectedMachine(val); setSelectedPart(""); }}
              placeholder="Select Machine first"
            />

            <SimpleDropdown
              label="Part"
              options={partOptions}
              selected={selectedPart}
              onSelect={setSelectedPart}
              placeholder={selectedMachine ? "Select Part" : "Select Machine first"}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter quantity"
              placeholderTextColor={COLORS.textMuted}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdd} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitText}>Add to Stock</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Popup Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={72} color={COLORS.secondary} />
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successText}>Stock added successfully</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: COLORS.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, marginHorizontal: 20,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    gap: 8, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.text },
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
    color: COLORS.primaryLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stockCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  stockLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  partName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  stockRight: { alignItems: "flex-end" },
  qtyBig: { fontSize: 24, fontFamily: "Inter_700Bold" },
  qtyLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.textMuted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
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
  label: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.textSecondary,
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", color: COLORS.text,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, alignItems: "center", marginTop: 4,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.white },
  
  // Success Popup Styles
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  successCard: {
    backgroundColor: COLORS.surface,
    padding: 30,
    borderRadius: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    width: "70%",
  },
  successTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});
