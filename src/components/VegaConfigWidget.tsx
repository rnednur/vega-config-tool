import { useEffect, useState } from 'react';
import { useWidgetStore } from '@/store/widgetStore';
import { ChartPreview } from './ChartPreview';
import { DataPanel } from './panels/DataPanel';
import { MarkPanel } from './panels/MarkPanel';
import { EncodingsPanel } from './panels/EncodingsPanel';
import { AIPanel } from './panels/AIPanel';
import { SpecPanel } from './panels/SpecPanel';
import type { VegaWidgetConfig, TabType } from '@/types';
import { jsPDF } from 'jspdf';

const TABS: { id: TabType; label: string }[] = [
  // { id: 'data', label: 'Data' }, // Commented out - can be re-enabled if needed
  { id: 'mark', label: 'Mark' },
  { id: 'encodings', label: 'Encodings' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'spec', label: 'Spec' },
];

export function VegaConfigWidget({ data, builderState: initialBuilderState, callbacks }: VegaWidgetConfig) {
  const activeTab = useWidgetStore((state) => state.activeTab);
  const setActiveTab = useWidgetStore((state) => state.setActiveTab);
  const setData = useWidgetStore((state) => state.setData);
  const setBuilderState = useWidgetStore((state) => state.setBuilderState);
  const vegaSpec = useWidgetStore((state) => state.vegaSpec);
  const chartData = useWidgetStore((state) => state.data);
  const undo = useWidgetStore((state) => state.undo);
  const redo = useWidgetStore((state) => state.redo);
  const historyIndex = useWidgetStore((state) => state.historyIndex);
  const history = useWidgetStore((state) => state.history);

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Initialize data and builder state from props
  useEffect(() => {
    if (data) {
      setData(data);
    }
  }, [data, setData]);

  useEffect(() => {
    if (initialBuilderState) {
      setBuilderState(initialBuilderState);
    }
  }, [initialBuilderState, setBuilderState]);

  // Call callbacks when spec changes
  useEffect(() => {
    if (callbacks?.onSpecChange) {
      callbacks.onSpecChange(vegaSpec);
    }
  }, [vegaSpec, callbacks]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) undo();
  };

  const handleRedo = () => {
    if (canRedo) redo();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  return (
    <div className="w-full h-full flex flex-col font-sans">
      {/* Header */}
      <div className="border-b border-gray-300 px-4 py-3 bg-gray-50">
        <h2 className="text-lg font-semibold">Vega Chart Configuration</h2>
        <p className="text-sm text-gray-600">Configure your chart using the panels below or use AI commands</p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Toggle button when panel is collapsed */}
        {isPanelCollapsed && (
          <button
            onClick={() => setIsPanelCollapsed(false)}
            className="absolute left-0 top-0 z-20 w-4 h-8 flex items-center justify-center text-gray-800 hover:bg-gray-100 rounded transition-colors"
            title="Show panel"
          >
            ›
          </button>
        )}

        {/* Left panel - Controls */}
        {!isPanelCollapsed && (
          <div className="w-96 border-r border-gray-300 flex flex-col relative">
            {/* Toggle button - aligned with tabs */}
            <button
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              className="absolute right-0 top-0 z-20 w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-100 transition-colors"
              title="Hide panel"
            >
              ‹
            </button>

            {/* Tabs */}
            <div className="flex border-b border-gray-300 overflow-x-auto pr-10">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                      : 'bg-gray-50 text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'data' && <DataPanel />}
              {activeTab === 'mark' && <MarkPanel />}
              {activeTab === 'encodings' && <EncodingsPanel />}
              {activeTab === 'ai' && <AIPanel />}
              {activeTab === 'spec' && <SpecPanel />}
            </div>
          </div>
        )}

        {/* Right panel - Preview */}
        <div className="flex-1 flex flex-col">
          <div className="border-b border-gray-300 px-4 py-2 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Chart Preview</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const json = JSON.stringify(vegaSpec, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'vega-spec.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                title="Download Vega-Lite spec as JSON"
              >
                📄 JSON
              </button>
              <button
                onClick={() => {
                  try {
                    // Find the canvas element from the Vega chart
                    const canvas = document.querySelector('#vega-chart-container canvas') as HTMLCanvasElement;
                    if (!canvas) {
                      alert('Chart not rendered yet. Please wait for the chart to load.');
                      return;
                    }

                    // Get the canvas as a data URL
                    const imgData = canvas.toDataURL('image/png');

                    // Create PDF with appropriate dimensions (using locally installed jsPDF)
                    const pdf = new jsPDF({
                      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                      unit: 'px',
                      format: [canvas.width, canvas.height]
                    });

                    // Add the image to PDF
                    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

                    // Download the PDF
                    pdf.save('chart.pdf');
                  } catch (error) {
                    console.error('PDF export error:', error);
                    alert('PDF export failed. The chart may not be rendered yet or there was an error.');
                  }
                }}
                className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                title="Download as PDF file"
              >
                📕 PDF
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <ChartPreview spec={vegaSpec} data={chartData} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-300 px-4 py-2 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Cmd/Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>

        <div className="text-xs text-gray-600">
          {chartData.length} rows • {Object.keys(chartData[0] || {}).length} columns
        </div>
      </div>
    </div>
  );
}
