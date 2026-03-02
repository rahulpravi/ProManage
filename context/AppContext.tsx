import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  initializeDefaults,
  getMachines,
  getEmployees,
  getStock,
  getMaterialRequests,
  getProductionLogs,
  getQCLogs,
  getSaleLogs,
  Machine,
  Employee,
  StockItem,
  MaterialRequest,
  ProductionLog,
  QCLog,
  SaleLog,
} from "@/lib/database";

interface AppContextValue {
  machines: Machine[];
  employees: Employee[];
  stock: StockItem[];
  materialRequests: MaterialRequest[];
  productionLogs: ProductionLog[];
  qcLogs: QCLog[];
  saleLogs: SaleLog[];
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  refreshStock: () => Promise<void>;
  refreshProduction: () => Promise<void>;
  refreshQC: () => Promise<void>;
  refreshSales: () => Promise<void>;
  refreshEmployees: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [qcLogs, setQCLogs] = useState<QCLog[]>([]);
  const [saleLogs, setSaleLogs] = useState<SaleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await initializeDefaults();
      const [m, e, s, mr, pl, ql, sl] = await Promise.all([
        getMachines(),
        getEmployees(),
        getStock(),
        getMaterialRequests(),
        getProductionLogs(),
        getQCLogs(),
        getSaleLogs(),
      ]);
      setMachines(m);
      setEmployees(e);
      setStock(s);
      setMaterialRequests(mr);
      setProductionLogs(pl);
      setQCLogs(ql);
      setSaleLogs(sl);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshStock = useCallback(async () => {
    const s = await getStock();
    setStock(s);
  }, []);

  const refreshProduction = useCallback(async () => {
    const [pl, mr] = await Promise.all([getProductionLogs(), getMaterialRequests()]);
    setProductionLogs(pl);
    setMaterialRequests(mr);
  }, []);

  const refreshQC = useCallback(async () => {
    const [ql, pl] = await Promise.all([getQCLogs(), getProductionLogs()]);
    setQCLogs(ql);
    setProductionLogs(pl);
  }, []);

  const refreshSales = useCallback(async () => {
    const [sl, ql] = await Promise.all([getSaleLogs(), getQCLogs()]);
    setSaleLogs(sl);
    setQCLogs(ql);
  }, []);

  const refreshEmployees = useCallback(async () => {
    const e = await getEmployees();
    setEmployees(e);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <AppContext.Provider
      value={{
        machines,
        employees,
        stock,
        materialRequests,
        productionLogs,
        qcLogs,
        saleLogs,
        isLoading,
        refreshAll,
        refreshStock,
        refreshProduction,
        refreshQC,
        refreshSales,
        refreshEmployees,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
