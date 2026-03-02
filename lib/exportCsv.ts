import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";

export async function exportAndShareCSV(filename: string, headers: string[], rows: string[][]): Promise<void> {
  const csvRows = [headers, ...rows];
  const csvContent = csvRows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");

  if (Platform.OS === "web") {
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = (FileSystem.documentDirectory || "") + filename;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert("Share not available", "Sharing is not supported on this device.");
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: `Share ${filename}`,
    UTI: "public.comma-separated-values-text",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
