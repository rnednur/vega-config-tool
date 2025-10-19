import { useWidgetStore } from '@/store/widgetStore';
import type { MarkType, StackMode } from '@/types';

const MARK_TYPES: { value: MarkType; label: string; description: string }[] = [
  { value: 'bar', label: 'Bar', description: 'Bar chart' },
  { value: 'line', label: 'Line', description: 'Line chart' },
  { value: 'area', label: 'Area', description: 'Area chart' },
  { value: 'point', label: 'Point', description: 'Scatter plot' },
  { value: 'circle', label: 'Circle', description: 'Circle marks' },
  { value: 'square', label: 'Square', description: 'Square marks' },
  { value: 'tick', label: 'Tick', description: 'Tick marks' },
  { value: 'rect', label: 'Rect', description: 'Rectangle marks' },
  { value: 'rule', label: 'Rule', description: 'Line rules' },
  { value: 'text', label: 'Text', description: 'Text marks' },
];

export function MarkPanel() {
  const builderState = useWidgetStore((state) => state.builderState);
  const vegaSpec = useWidgetStore((state) => state.vegaSpec);
  const setBuilderState = useWidgetStore((state) => state.setBuilderState);
  const captureSnapshot = useWidgetStore((state) => state.captureSnapshot);

  // Detect if current spec is a complex/custom spec
  const isCustomSpec = !!(
    vegaSpec.facet ||
    vegaSpec.layer ||
    vegaSpec.hconcat ||
    vegaSpec.vconcat ||
    vegaSpec.repeat ||
    (vegaSpec.transform && vegaSpec.transform.length > 3) ||
    (vegaSpec.data && (vegaSpec.data as any).url)
  );

  const handleMarkChange = (markType: MarkType) => {
    captureSnapshot(`Change mark to ${markType}`);
    setBuilderState({
      mark: { ...builderState.mark, type: markType },
    });
  };

  const handlePointToggle = (enabled: boolean) => {
    captureSnapshot(`Toggle point overlay`);
    setBuilderState({
      mark: { ...builderState.mark, point: enabled },
    });
  };

  const handleStackChange = (stacked: StackMode) => {
    captureSnapshot(`Change stacking to ${stacked}`);
    setBuilderState({
      mark: { ...builderState.mark, stacked },
    });
  };

  const canShowPoints = builderState.mark.type === 'line' || builderState.mark.type === 'area';
  const canStack = builderState.mark.type === 'bar' || builderState.mark.type === 'area';

  if (isCustomSpec) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600 font-bold text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800 mb-2">
                Custom Spec - Builder Disabled
              </p>
              <p className="text-xs text-yellow-700 mb-3">
                You're viewing a complex spec (faceted, layered, or with external data) that can't be edited through the builder panels.
              </p>
              <p className="text-xs font-semibold text-yellow-800 mb-1">Options:</p>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                <li>Use the <strong>AI Assistant</strong> tab (GenAI mode) to modify this spec</li>
                <li>Use the <strong>Spec</strong> tab to manually edit the JSON</li>
                <li>Reset to a simple chart to use the builder</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Mark Type</h3>
        <div className="grid grid-cols-2 gap-2">
          {MARK_TYPES.map((mark) => (
            <button
              key={mark.value}
              onClick={() => handleMarkChange(mark.value)}
              className={`p-3 text-left border rounded transition-colors ${
                builderState.mark.type === mark.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              title={mark.description}
            >
              <div className="font-medium text-sm">{mark.label}</div>
              <div className="text-xs text-gray-500">{mark.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3">Mark Options</h3>

        {canShowPoints && (
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={!!builderState.mark.point}
              onChange={(e) => handlePointToggle(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Show points</span>
          </label>
        )}

        {canStack && (
          <div>
            <label className="text-sm font-medium mb-1 block">Stacking</label>
            <select
              value={builderState.mark.stacked ?? 'none'}
              onChange={(e) =>
                handleStackChange(e.target.value === 'none' ? null : (e.target.value as StackMode))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="none">None</option>
              <option value="zero">Zero (stacked)</option>
              <option value="normalize">Normalize (100%)</option>
            </select>
          </div>
        )}

        {!canShowPoints && !canStack && (
          <p className="text-sm text-gray-500">No additional options for this mark type</p>
        )}
      </div>
    </div>
  );
}
