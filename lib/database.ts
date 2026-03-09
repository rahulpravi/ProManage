import AsyncStorage from "@react-native-async-storage/async-storage";

export type Machine = {
  id: string;
  name: string;
  category: string;
};

export type Part = {
  id: string;
  name: string;
  machineCategory: string;
  quantity: number;
  addedAt: string;
};

export type Employee = {
  id: string;
  name: string;
  code: string;
};

export type StockItem = {
  id: string;
  partName: string;
  machineCategory: string;
  quantity: number;
  updatedAt: string;
};

export type MaterialRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  machineId: string;
  machineName: string;
  partId: string;
  partName: string;
  quantity: number;
  serialNumbers: string[];
  requestedAt: string;
};

export type ProductionLog = {
  id: string;
  employeeId: string;
  employeeName: string;
  machineId: string;
  machineName: string;
  quantity: number;
  serialNumbers: string[];
  completedAt: string;
  status: "completed" | "qc_pending" | "qc_done" | "sold";
};

export type QCLog = {
  id: string;
  productionLogId: string;
  employeeId: string;
  employeeName: string;
  productName: string;
  machineName: string;
  quantity: number;
  serialNumbers: string[];
  checkedAt: string;
  status: "passed" | "failed";
};

export type SaleLog = {
  id: string;
  qcLogId: string;
  productName: string;
  machineName: string;
  quantity: number;
  serialNumbers: string[];
  soldAt: string;
};

const KEYS = {
  MACHINES: "machines",
  EMPLOYEES: "employees",
  STOCK: "stock",
  MATERIAL_REQUESTS: "material_requests",
  PRODUCTION_LOGS: "production_logs",
  QC_LOGS: "qc_logs",
  SALE_LOGS: "sale_logs",
};

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function getItem<T>(key: string): Promise<T[]> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

async function setItem<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export const DEFAULT_MACHINES: Machine[] = [
  { id: '1', name: '48Way', category: '48Way' },
  { id: '2', name: '4Way', category: '4Way' },
  { id: '3', name: '3WayOBC', category: '3WayOBC' },
  { id: '4', name: '38 WAY SHROUD', category: '38 WAY SHROUD' },
  { id: '5', name: 'FORD SPACER ASSEMBLY', category: 'FORD SPACER' },
];

export const MACHINE_PARTS: Record<string, string[]> = {
  '48Way': [
    '33508166 (Housing)',
    '33503364 (White Seal)',
    '33508170 (Grey Cover)',
    '33514062 (Brown Cover)',
    '33507962 (Orange Seal)',
    '35501888 (Lock Lever)'
  ],
  '4Way': [
    '12162187 (Housing)',
    '12040756 (Blue Seal)',
    '12110186 (Orange Seal)'
  ],
  '3WayOBC': [
    '35516812 (Housing)',
    '13885872 (SEAL CMPR BLU)'
  ],
  '38 WAY SHROUD': [
    '33514472 (Shroud Left)',
    '33509741 (Bush)',
    '33509739 (Insert)',
    '33503323 (Gasket)'
  ],
  'FORD SPACER': [
    '33514982 (Black Housing)',
    '33514978 (Spacer)'
  ]
};

export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Rahul", code: "R" },
  { id: "e2", name: "Jaya", code: "J" },
];
export async function initializeDefaults(): Promise<void> {
  const machines = await getItem<Machine>(KEYS.MACHINES);
  if (machines.length === 0) {
    await setItem(KEYS.MACHINES, DEFAULT_MACHINES);
  }
  const employees = await getItem<Employee>(KEYS.EMPLOYEES);
  if (employees.length === 0) {
    await setItem(KEYS.EMPLOYEES, DEFAULT_EMPLOYEES);
  }
}

export async function getMachines(): Promise<Machine[]> {
  return getItem<Machine>(KEYS.MACHINES);
}

export async function getEmployees(): Promise<Employee[]> {
  return getItem<Employee>(KEYS.EMPLOYEES);
}

export async function addEmployee(name: string): Promise<Employee> {
  const employees = await getItem<Employee>(KEYS.EMPLOYEES);
  const code = name.trim().charAt(0).toUpperCase();
  const emp: Employee = { id: genId(), name: name.trim(), code };
  employees.push(emp);
  await setItem(KEYS.EMPLOYEES, employees);
  return emp;
}

export async function getStock(): Promise<StockItem[]> {
  return getItem<StockItem>(KEYS.STOCK);
}

export async function addStock(partName: string, machineCategory: string, quantity: number): Promise<StockItem> {
  const stock = await getItem<StockItem>(KEYS.STOCK);
  const existing = stock.find(
    (s) => s.partName.toLowerCase() === partName.toLowerCase() && s.machineCategory === machineCategory
  );
  if (existing) {
    existing.quantity += quantity;
    existing.updatedAt = new Date().toISOString();
    await setItem(KEYS.STOCK, stock);
    return existing;
  }
  const item: StockItem = {
    id: genId(),
    partName: partName.trim(),
    machineCategory,
    quantity,
    updatedAt: new Date().toISOString(),
  };
  stock.push(item);
  await setItem(KEYS.STOCK, stock);
  return item;
}

export async function deductStock(partName: string, machineCategory: string, quantity: number): Promise<boolean> {
  const stock = await getItem<StockItem>(KEYS.STOCK);
  const item = stock.find(
    (s) => s.partName.toLowerCase() === partName.toLowerCase() && s.machineCategory === machineCategory
  );
  if (!item || item.quantity < quantity) return false;
  item.quantity -= quantity;
  item.updatedAt = new Date().toISOString();
  await setItem(KEYS.STOCK, stock);
  return true;
}

export async function getMaterialRequests(): Promise<MaterialRequest[]> {
  return getItem<MaterialRequest>(KEYS.MATERIAL_REQUESTS);
}

export async function addMaterialRequest(
  employee: Employee,
  machine: Machine,
  part: StockItem,
  quantity: number,
  serialNumbers: string[]
): Promise<MaterialRequest | null> {
  const deducted = await deductStock(part.partName, part.machineCategory, quantity);
  if (!deducted) return null;
  const requests = await getItem<MaterialRequest>(KEYS.MATERIAL_REQUESTS);
  const req: MaterialRequest = {
    id: genId(),
    employeeId: employee.id,
    employeeName: employee.name,
    machineId: machine.id,
    machineName: machine.name,
    partId: part.id,
    partName: part.partName,
    quantity,
    serialNumbers,
    requestedAt: new Date().toISOString(),
  };
  requests.push(req);
  await setItem(KEYS.MATERIAL_REQUESTS, requests);
  return req;
}

export async function getProductionLogs(): Promise<ProductionLog[]> {
  return getItem<ProductionLog>(KEYS.PRODUCTION_LOGS);
}

export async function addProductionLog(
  employee: Employee,
  machine: Machine,
  quantity: number,
  serialNumbers: string[]
): Promise<ProductionLog> {
  const logs = await getItem<ProductionLog>(KEYS.PRODUCTION_LOGS);
  const log: ProductionLog = {
    id: genId(),
    employeeId: employee.id,
    employeeName: employee.name,
    machineId: machine.id,
    machineName: machine.name,
    quantity,
    serialNumbers,
    completedAt: new Date().toISOString(),
    status: "qc_pending",
  };
  logs.push(log);
  await setItem(KEYS.PRODUCTION_LOGS, logs);
  return log;
}

export async function getQCLogs(): Promise<QCLog[]> {
  return getItem<QCLog>(KEYS.QC_LOGS);
}

export async function addQCLog(
  productionLog: ProductionLog,
  employee: Employee,
  serialNumbers: string[]
): Promise<QCLog> {
  const logs = await getItem<QCLog>(KEYS.QC_LOGS);
  const qcSerials = serialNumbers.map((sn) => `${sn}-${employee.code}`);
  const qcLog: QCLog = {
    id: genId(),
    productionLogId: productionLog.id,
    employeeId: employee.id,
    employeeName: employee.name,
    productName: productionLog.machineName,
    machineName: productionLog.machineName,
    quantity: productionLog.quantity,
    serialNumbers: qcSerials,
    checkedAt: new Date().toISOString(),
    status: "passed",
  };
  logs.push(qcLog);
  await setItem(KEYS.QC_LOGS, logs);

  const prodLogs = await getItem<ProductionLog>(KEYS.PRODUCTION_LOGS);
  const idx = prodLogs.findIndex((p) => p.id === productionLog.id);
  if (idx >= 0) {
    prodLogs[idx].status = "qc_done";
    await setItem(KEYS.PRODUCTION_LOGS, prodLogs);
  }
  return qcLog;
}

export async function addQCLogDirect(
  employee: Employee,
  productionLog: ProductionLog,
  selectedSerials: string[]
): Promise<QCLog> {
  const logs = await getItem<QCLog>(KEYS.QC_LOGS);
  const qcSerials = selectedSerials.map((sn) => `${sn}-${employee.code}`);
  const qcLog: QCLog = {
    id: genId(),
    productionLogId: productionLog.id,
    employeeId: employee.id,
    employeeName: employee.name,
    productName: productionLog.machineName,
    machineName: productionLog.machineName,
    quantity: selectedSerials.length,
    serialNumbers: qcSerials,
    checkedAt: new Date().toISOString(),
    status: "passed",
  };
  logs.push(qcLog);
  await setItem(KEYS.QC_LOGS, logs);

  const prodLogs = await getItem<ProductionLog>(KEYS.PRODUCTION_LOGS);
  const idx = prodLogs.findIndex((p) => p.id === productionLog.id);
  if (idx >= 0) {
    const remaining = prodLogs[idx].serialNumbers.filter((sn) => !selectedSerials.includes(sn));
    if (remaining.length === 0) {
      prodLogs[idx].status = "qc_done";
    } else {
      prodLogs[idx].serialNumbers = remaining;
      prodLogs[idx].quantity = remaining.length;
    }
    await setItem(KEYS.PRODUCTION_LOGS, prodLogs);
  }
  return qcLog;
}

export async function getSaleLogs(): Promise<SaleLog[]> {
  return getItem<SaleLog>(KEYS.SALE_LOGS);
}

export async function markAsSold(qcLog: QCLog): Promise<SaleLog> {
  const saleLogs = await getItem<SaleLog>(KEYS.SALE_LOGS);
  const sale: SaleLog = {
    id: genId(),
    qcLogId: qcLog.id,
    productName: qcLog.productName,
    machineName: qcLog.machineName,
    quantity: qcLog.quantity,
    serialNumbers: qcLog.serialNumbers,
    soldAt: new Date().toISOString(),
  };
  saleLogs.push(sale);
  await setItem(KEYS.SALE_LOGS, saleLogs);

  const qcLogs = await getItem<QCLog>(KEYS.QC_LOGS);
  const idx = qcLogs.findIndex((q) => q.id === qcLog.id);
  if (idx >= 0) {
    qcLogs[idx].status = "failed";
    await setItem(KEYS.QC_LOGS, qcLogs);
  }
  return sale;
}

export async function markPartialSale(
  machineName: string,
  selectedSerials: string[],
  groupQCLogs: QCLog[]
): Promise<SaleLog> {
  const saleLogs = await getItem<SaleLog>(KEYS.SALE_LOGS);
  const sale: SaleLog = {
    id: genId(),
    qcLogId: groupQCLogs.map((q) => q.id).join(","),
    productName: machineName,
    machineName,
    quantity: selectedSerials.length,
    serialNumbers: selectedSerials,
    soldAt: new Date().toISOString(),
  };
  saleLogs.push(sale);
  await setItem(KEYS.SALE_LOGS, saleLogs);

  const allQCLogs = await getItem<QCLog>(KEYS.QC_LOGS);
  for (const groupLog of groupQCLogs) {
    const idx = allQCLogs.findIndex((q) => q.id === groupLog.id);
    if (idx < 0) continue;
    const remaining = allQCLogs[idx].serialNumbers.filter((sn) => !selectedSerials.includes(sn));
    if (remaining.length === 0) {
      allQCLogs[idx].status = "failed";
    } else {
      allQCLogs[idx].serialNumbers = remaining;
      allQCLogs[idx].quantity = remaining.length;
    }
  }
  await setItem(KEYS.QC_LOGS, allQCLogs);
  return sale;
}

export async function getProductionByDateRange(weeks: number): Promise<ProductionLog[]> {
  const logs = await getItem<ProductionLog>(KEYS.PRODUCTION_LOGS);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  return logs.filter((l) => new Date(l.completedAt) >= cutoff);
}

export async function getDashboardStats() {
  const [prodLogs, qcLogs, saleLogs, stock, materialRequests] = await Promise.all([
    getProductionLogs(),
    getQCLogs(),
    getSaleLogs(),
    getStock(),
    getMaterialRequests(),
  ]);

  const machineStats = DEFAULT_MACHINES.map((m) => {
    const prods = prodLogs.filter((p) => p.machineName === m.name);
    const qcs = qcLogs.filter((q) => q.machineName === m.name);
    const sales = saleLogs.filter((s) => s.machineName === m.name);
    const parts = stock.filter((s) => s.machineCategory === m.category);
    const totalStock = parts.reduce((sum, p) => sum + p.quantity, 0);
    const totalProd = prods.reduce((sum, p) => sum + p.quantity, 0);
    const totalQC = qcs.reduce((sum, q) => sum + q.quantity, 0);
    const totalSales = sales.reduce((sum, s) => sum + s.quantity, 0);
    return {
      machine: m,
      parts: parts.length,
      stock: totalStock,
      production: totalProd,
      qc: totalQC,
      sales: totalSales,
    };
  });

  return { machineStats, prodLogs, qcLogs, saleLogs, stock, materialRequests };
}
