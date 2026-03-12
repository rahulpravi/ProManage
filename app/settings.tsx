import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import COLORS from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import {
  getEmployees,
  addEmployee,
  removeEmployeeDirect,
  getMachines,
  addMachineDirect,
  removeMachineDirect,
  clearSpecificData,
  MACHINE_PARTS,
} from "@/lib/database";
import type { Employee, Machine } from "@/lib/database";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refreshAll } = useApp();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  // Modals state
  const [empModal, setEmpModal] = useState(false);
  const [macModal, setMacModal] = useState(false);

  // Form states
  const [newEmpName, setNewEmpName] = useState("");
  const [newMacName, setNewMacName] = useState("");
  const [macParts, setMacParts] = useState([{ serial: "", name: "" }]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setEmployees(await getEmployees());
    setMachines(await getMachines());
  };

  // --- Employee Actions ---
  const handleAddEmployee = async () => {
    if (!newEmpName.trim()) return;
    await addEmployee(newEmpName);
    setNewEmpName("");
    setEmpModal(false);
    refreshAll();
    loadData();
  };

  const handleDeleteEmployee = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this employee?")) {
        removeEmployeeDirect(id).then(() => { refreshAll(); loadData(); });
      }
      return;
    }
    Alert.alert("Delete Employee", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await removeEmployeeDirect(id);
        refreshAll();
        loadData();
      }},
    ]);
  };

  // --- Machine Actions ---
  const handleAddPartRow = () => {
    setMacParts([...macParts, { serial: "", name: "" }]);
  };

  const handleRemovePartRow = (index: number) => {
    const updated = macParts.filter((_, i) => i !== index);
    setMacParts(updated.length ? updated : [{ serial: "", name: "" }]);
  };

  const handleSaveMachine = async () => {
    if (!newMacName.trim()) {
      if (Platform.OS === 'web') window.alert("Enter Machine Name");
      else Alert.alert("Error", "Enter Machine Name");
      return;
    }
    
    // Format parts as "Serial (Name)"
    const formattedParts = macParts
      .filter((p) => p.serial.trim() || p.name.trim())
      .map((p) => {
        const s = p.serial.trim() || "SN-X";
        const n = p.name.trim() || "Part";
        return `${s} (${n})`;
      });

    // Save machine
    await addMachineDirect(newMacName, newMacName);

    // Save custom parts to memory & storage
    if (formattedParts.length > 0) {
      MACHINE_PARTS[newMacName.trim()] = formattedParts;
      const existingStr = await AsyncStorage.getItem("custom_machine_parts");
      const existing = existingStr ? JSON.parse(existingStr) : {};
      existing[newMacName.trim()] = formattedParts;
      await AsyncStorage.setItem("custom_machine_parts", JSON.stringify(existing));
    }

    setNewMacName("");
    setMacParts([{ serial: "", name: "" }]);
    setMacModal(false);
    refreshAll();
    loadData();
  };

  const handleDeleteMachine = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Are you sure you want to delete this machine?")) {
        removeMachineDirect(id).then(() => { refreshAll(); loadData(); });
      }
      return;
    }
    Alert.alert("Delete Machine", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await removeMachineDirect(id);
        refreshAll();
        loadData();
      }},
    ]);
  };

  // --- Clear Data Actions ---
  const handleClearData = async (type: "stock" | "production" | "qc" | "sales" | "all") => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Clear ${type.toUpperCase()} data? This cannot be undone.`)) {
        clearSpecificData(type).then(() => {
          refreshAll();
          window.alert(`${type.toUpperCase()} data cleared.`);
        });
      }
      return;
    }
    Alert.alert("WARNING", `Clear ${type.toUpperCase()} data? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "CLEAR", style: "destructive", onPress: async () => {
        await clearSpecificData(type);
        refreshAll();
        Alert.alert("Success", `${type.toUpperCase()} data cleared.`);
      }},
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 20 : insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* --- EMPLOYEES SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Employees</Text>
          <TouchableOpacity style={styles.addBtnSmall} onPress={() => setEmpModal(true)}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {employees.length === 0 ? (
            <Text style={styles.emptyText}>No employees added</Text>
          ) : (
            employees.map((e, idx) => (
              <View key={e.id} style={[styles.listItem, idx === employees.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.listText}>{e.name} ({e.code})</Text>
                <TouchableOpacity onPress={() => handleDeleteEmployee(e.id)}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* --- MACHINES SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Machines & Parts</Text>
          <TouchableOpacity style={styles.addBtnSmall} onPress={() => setMacModal(true)}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {machines.length === 0 ? (
            <Text style={styles.emptyText}>No machines added</Text>
          ) : (
            machines.map((m, idx) => (
              <View key={m.id} style={[styles.listItem, idx === machines.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listText}>{m.name}</Text>
                  <Text style={styles.listSubText}>
                    {(MACHINE_PARTS[m.name] || []).length} parts attached
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteMachine(m.id)}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* --- CLEAR DATA SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>Clear App Data</Text>
        </View>
        <Text style={styles.warningText}>Warning: Deleted data cannot be recovered!</Text>
        
        <View style={styles.card}>
          <TouchableOpacity style={styles.clearBtn} onPress={() => handleClearData("stock")}>
            <Text style={styles.clearBtnText}>Clear Stock</Text>
            <Ionicons name="cube-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => handleClearData("production")}>
            <Text style={styles.clearBtnText}>Clear Production</Text>
            <Ionicons name="settings-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => handleClearData("qc")}>
            <Text style={styles.clearBtnText}>Clear QC Logs</Text>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => handleClearData("sales")}>
            <Text style={styles.clearBtnText}>Clear Sales</Text>
            <Ionicons name="cart-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={[styles.clearBtn, { borderBottomWidth: 0 }]} onPress={() => handleClearData("all")}>
            <Text style={[styles.clearBtnText, { fontFamily: "Inter_700Bold" }]}>Factory Reset (Clear All)</Text>
            <Ionicons name="warning-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* --- ADD EMPLOYEE MODAL --- */}
      <Modal visible={empModal} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Employee</Text>
            <TextInput
              style={styles.input}
              placeholder="Employee Name"
              placeholderTextColor={COLORS.textMuted}
              value={newEmpName}
              onChangeText={setNewEmpName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEmpModal(false)}><Text style={styles.btnCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnSubmit} onPress={handleAddEmployee}><Text style={styles.btnSubmitText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- ADD MACHINE MODAL --- */}
      <Modal visible={macModal} animationType="slide" transparent>
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Add Machine & Parts</Text>
              <TouchableOpacity onPress={() => setMacModal(false)}><Ionicons name="close" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>
              <Text style={styles.label}>Machine Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 48Way"
                placeholderTextColor={COLORS.textMuted}
                value={newMacName}
                onChangeText={setNewMacName}
              />

              <Text style={[styles.label, { marginTop: 10 }]}>Parts List</Text>
              {macParts.map((part, index) => (
                <View key={index} style={styles.partRow}>
                  <TextInput
                    style={[styles.input, styles.partInput]}
                    placeholder="SN (e.g 3350)"
                    placeholderTextColor={COLORS.textMuted}
                    value={part.serial}
                    onChangeText={(val) => {
                      const updated = [...macParts];
                      updated[index].serial = val;
                      setMacParts(updated);
                    }}
                  />
                  <TextInput
                    style={[styles.input, styles.partInput, { flex: 1.5 }]}
                    placeholder="Part Name"
                    placeholderTextColor={COLORS.textMuted}
                    value={part.name}
                    onChangeText={(val) => {
                      const updated = [...macParts];
                      updated[index].name = val;
                      setMacParts(updated);
                    }}
                  />
                  <TouchableOpacity style={styles.delPartBtn} onPress={() => handleRemovePartRow(index)}>
                    <Ionicons name="trash" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addPartBtn} onPress={handleAddPartRow}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.secondary} />
                <Text style={styles.addPartText}>Add Another Part</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.submitLargeBtn} onPress={handleSaveMachine}>
                <Text style={styles.btnSubmitText}>Save Machine</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.cardBorder },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontFamily: "Inter_700Bold", color: COLORS.text },
  content: { padding: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: COLORS.text },
  addBtnSmall: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 20 },
  listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  listText: { fontSize: 15, fontFamily: "Inter_500Medium", color: COLORS.text },
  listSubText: { fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.textSecondary, marginTop: 2 },
  emptyText: { padding: 14, textAlign: "center", fontSize: 13, color: COLORS.textMuted, fontFamily: "Inter_400Regular" },
  
  warningText: { fontSize: 12, color: COLORS.danger, fontFamily: "Inter_400Regular", marginBottom: 10, paddingHorizontal: 4 },
  clearBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  clearBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: COLORS.danger },
  divider: { height: 4, backgroundColor: COLORS.background },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "85%", backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.cardBorder },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: COLORS.text, marginBottom: 20 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.surfaceLight, alignItems: "center" },
  btnCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: COLORS.textSecondary },
  btnSubmit: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center" },
  btnSubmitText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: COLORS.white },

  modalOverlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "90%" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" },
  
  // Fixed Parts Row
  partRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  partInput: { flex: 1, marginBottom: 0, marginRight: 8, paddingHorizontal: 10, fontSize: 13 },
  delPartBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.danger + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.danger + "44" },
  
  addPartBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, alignSelf: "flex-start", marginBottom: 20 },
  addPartText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.secondary },
  submitLargeBtn: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, alignItems: "center" },
});
