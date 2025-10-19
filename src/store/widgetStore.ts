import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { VisualizationSpec } from 'vega-embed';
import type {
  WidgetState,
  BuilderState,
  DataField,
  TabType,
  ValidationError,
  ChartEditPlan,
  StateSnapshot,
} from '@/types';
import { inferFields } from '@/utils/fieldInference';
import { buildSpec, getDefaultBuilderState } from '@/utils/specBuilder';

interface WidgetStore extends WidgetState {
  // Actions
  setData: (data: any[]) => void;
  setDataOnly: (data: any[]) => void; // Update data without regenerating spec
  setBuilderState: (state: Partial<BuilderState>) => void;
  setSpec: (spec: VisualizationSpec, builderState?: Partial<BuilderState>) => void;
  setActiveTab: (tab: TabType) => void;
  setAICommand: (command: string) => void;
  setLastPlan: (plan: ChartEditPlan | null) => void;
  regenerateSpec: () => void;
  addValidationError: (error: ValidationError) => void;
  clearValidationErrors: () => void;
  undo: () => void;
  redo: () => void;
  captureSnapshot: (description?: string) => void;
  reset: () => void;
}

const DEFAULT_DATA = [
  { Category: 'A', Date: '2024-01-01', Sales: 120, Profit: 35, Region: 'West' },
  { Category: 'B', Date: '2024-01-01', Sales: 90, Profit: 22, Region: 'East' },
  { Category: 'A', Date: '2024-02-01', Sales: 150, Profit: 40, Region: 'West' },
  { Category: 'B', Date: '2024-02-01', Sales: 110, Profit: 28, Region: 'East' },
  { Category: 'C', Date: '2024-02-01', Sales: 70, Profit: 15, Region: 'North' },
];

export const useWidgetStore = create<WidgetStore>()(
  immer((set, get) => {
    const initialData = DEFAULT_DATA;
    const initialFields = inferFields(initialData);
    const initialBuilderState = getDefaultBuilderState();
    const initialSpec = buildSpec(initialBuilderState, initialFields);

    return {
      // Initial state
      data: initialData,
      dataFields: initialFields,
      builderState: initialBuilderState,
      vegaSpec: initialSpec,
      activeTab: 'mark', // Default to mark tab (data tab is hidden)
      validationErrors: [],
      history: [],
      historyIndex: -1,
      aiCommand: '',
      lastPlan: null,

      // Actions
      setData: (data: any[]) => {
        set((state) => {
          state.data = data;
          state.dataFields = inferFields(data);
          // Regenerate spec with new data
          state.vegaSpec = buildSpec(state.builderState, state.dataFields);
        });
      },

      setDataOnly: (data: any[]) => {
        set((state) => {
          state.data = data;
          state.dataFields = inferFields(data);
          // Don't regenerate spec - keep the existing custom spec
        });
      },

      setBuilderState: (updates: Partial<BuilderState>) => {
        set((state) => {
          state.builderState = { ...state.builderState, ...updates };
          // Regenerate spec
          state.vegaSpec = buildSpec(state.builderState, state.dataFields);
        });
      },

      setSpec: (spec: VisualizationSpec, builderState?: Partial<BuilderState>) => {
        set((state) => {
          state.vegaSpec = spec;
          if (builderState) {
            state.builderState = { ...state.builderState, ...builderState };
          }
        });
      },

      setActiveTab: (tab: TabType) => {
        set((state) => {
          state.activeTab = tab;
        });
      },

      setAICommand: (command: string) => {
        set((state) => {
          state.aiCommand = command;
        });
      },

      setLastPlan: (plan: ChartEditPlan | null) => {
        set((state) => {
          state.lastPlan = plan;
        });
      },

      regenerateSpec: () => {
        set((state) => {
          state.vegaSpec = buildSpec(state.builderState, state.dataFields);
        });
      },

      addValidationError: (error: ValidationError) => {
        set((state) => {
          state.validationErrors.push(error);
        });
      },

      clearValidationErrors: () => {
        set((state) => {
          state.validationErrors = [];
        });
      },

      captureSnapshot: (description?: string) => {
        set((state) => {
          const snapshot: StateSnapshot = {
            builderState: JSON.parse(JSON.stringify(state.builderState)),
            spec: JSON.parse(JSON.stringify(state.vegaSpec)),
            timestamp: Date.now(),
            description,
          };

          // Remove any snapshots after current index (when undoing and then making new changes)
          state.history = state.history.slice(0, state.historyIndex + 1);

          // Add new snapshot
          state.history.push(snapshot);
          state.historyIndex = state.history.length - 1;

          // Limit history to 50 snapshots
          if (state.history.length > 50) {
            state.history = state.history.slice(-50);
            state.historyIndex = state.history.length - 1;
          }
        });
      },

      undo: () => {
        set((state) => {
          if (state.historyIndex > 0) {
            state.historyIndex--;
            const snapshot = state.history[state.historyIndex];
            state.builderState = JSON.parse(JSON.stringify(snapshot.builderState));
            state.vegaSpec = JSON.parse(JSON.stringify(snapshot.spec));
          }
        });
      },

      redo: () => {
        set((state) => {
          if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const snapshot = state.history[state.historyIndex];
            state.builderState = JSON.parse(JSON.stringify(snapshot.builderState));
            state.vegaSpec = JSON.parse(JSON.stringify(snapshot.spec));
          }
        });
      },

      reset: () => {
        set((state) => {
          const fields = inferFields(state.data);
          const builderState = getDefaultBuilderState();
          const spec = buildSpec(builderState, fields);

          state.builderState = builderState;
          state.vegaSpec = spec;
          state.validationErrors = [];
          state.activeTab = 'mark';
          state.aiCommand = '';
          state.lastPlan = null;
          // Keep history for undo
        });
      },
    };
  })
);
