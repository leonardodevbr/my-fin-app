import { create } from 'zustand'
import { format } from 'date-fns'

function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

export interface AppState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  selectedMonth: string
  setSelectedMonth: (month: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  selectedMonth: currentMonthKey(),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}))
